"""
SIMOGRANTS Evaluator — Evaluation Engine

Main orchestrator that runs all 4 stakeholder agents in parallel,
parses their structured JSON responses, detects tensions, and
computes aggregated scores.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
import httpx

from .models import (
    DimensionScore,
    EvaluationResult,
    StakeholderEvaluation,
    Tension,
    STAKEHOLDER_DIMENSIONS,
)
from .prompts import build_system_prompt, build_user_message, JSON_REPAIR_PROMPT
from .tension import detect_tensions
from .bradley_terry import bradley_terry_aggregate, generate_pairwise_comparisons

logger = logging.getLogger(__name__)


class EvaluationEngine:
    """
    Multi-stakeholder evaluation engine for Ethereum public goods projects.

    Runs 4 stakeholder agents (developer, user, funder, ecosystem) in parallel
    via asyncio, parses structured JSON responses, detects tensions, and
    computes aggregated scores.
    """

    STAKEHOLDERS: list[str] = ["developer", "user", "funder", "ecosystem"]

    # Default weights for aggregation (equal by default)
    DEFAULT_WEIGHTS: dict[str, float] = {
        "developer": 0.25,
        "user": 0.25,
        "funder": 0.25,
        "ecosystem": 0.25,
    }

    # LLM parameters
    MAX_RETRIES: int = 3
    BASE_BACKOFF: float = 1.0  # seconds
    MAX_TOKENS: int = 2048
    TEMPERATURE: float = 0.3  # Low temperature for consistent scoring

    def __init__(
        self,
        api_key: str,
        model: str = "asi1-mini",
        weights: Optional[dict[str, float]] = None,
        tension_threshold: int = 35,
    ) -> None:
        """
        Initialize the evaluation engine.

        Args:
            api_key: Anthropic API key.
            model: Model to use for LLM calls.
            weights: Optional stakeholder weights for aggregation.
            tension_threshold: Spread threshold for tension detection.
        """
        self._api_key = api_key
        self._model = model
        self._provider = "asi1" if model.startswith("asi1") else "anthropic"
        self._client = anthropic.AsyncAnthropic(api_key=api_key) if self._provider == "anthropic" else None
        self._weights = weights or self.DEFAULT_WEIGHTS.copy()
        self._tension_threshold = tension_threshold

        # Validate weights
        total = sum(self._weights.values())
        if abs(total - 1.0) > 0.01:
            logger.warning("Weights sum to %.3f, normalizing to 1.0", total)
            self._weights = {k: v / total for k, v in self._weights.items()}

    async def evaluate_project(
        self,
        profile_data: dict[str, Any],
        project_id: Optional[str] = None,
    ) -> EvaluationResult:
        """
        Run all 4 stakeholder agents and aggregate into a single result.

        Args:
            profile_data: Project profile data dictionary.
            project_id: Optional explicit project ID; inferred from data otherwise.

        Returns:
            EvaluationResult with stakeholder evaluations, aggregated scores,
            tensions, and metadata.
        """
        pid = project_id or profile_data.get("project_id", profile_data.get("id", "unknown"))
        logger.info("Starting evaluation for project %s", pid)
        start = time.monotonic()

        # -------------------------------------------------------------------
        # 1. Run all 4 stakeholder agents in parallel
        # -------------------------------------------------------------------
        tasks = [
            self._run_stakeholder(agent_type, profile_data, pid)
            for agent_type in self.STAKEHOLDERS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect successful evaluations, log failures
        evaluations: list[StakeholderEvaluation] = []
        for agent_type, result in zip(self.STAKEHOLDERS, results):
            if isinstance(result, Exception):
                logger.error(
                    "Stakeholder %s failed for project %s: %s",
                    agent_type, pid, result,
                )
            else:
                evaluations.append(result)

        if not evaluations:
            raise RuntimeError(
                f"All stakeholder agents failed for project {pid}. Cannot produce evaluation."
            )

        logger.info(
            "Got %d/%d stakeholder evaluations for %s",
            len(evaluations), len(self.STAKEHOLDERS), pid,
        )

        # -------------------------------------------------------------------
        # 2. Detect tensions
        # -------------------------------------------------------------------
        tensions = detect_tensions(evaluations, threshold=self._tension_threshold)

        # -------------------------------------------------------------------
        # 3. Compute aggregated scores
        # -------------------------------------------------------------------
        aggregated = self._aggregate_scores(evaluations)
        overall = self._compute_overall_score(evaluations)

        # -------------------------------------------------------------------
        # 4. Data completeness
        # -------------------------------------------------------------------
        data_completeness = self._compute_data_completeness(evaluations, profile_data)

        elapsed = time.monotonic() - start
        logger.info("Evaluation for %s completed in %.1fs", pid, elapsed)

        return EvaluationResult(
            project_id=pid,
            stakeholder_evaluations=evaluations,
            aggregated_scores=aggregated,
            overall_score=overall,
            tensions=tensions,
            data_completeness=data_completeness,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )

    async def _run_stakeholder(
        self,
        agent_type: str,
        profile_data: dict[str, Any],
        project_id: str,
    ) -> StakeholderEvaluation:
        """
        Run a single stakeholder agent via LLM call with retry logic.

        Args:
            agent_type: One of 'developer', 'user', 'funder', 'ecosystem'.
            profile_data: Project data to evaluate.
            project_id: Project identifier.

        Returns:
            StakeholderEvaluation parsed from the LLM response.

        Raises:
            RuntimeError: If all retries are exhausted.
        """
        system_prompt = build_system_prompt(agent_type)
        user_message = build_user_message(profile_data)
        expected_dims = STAKEHOLDER_DIMENSIONS[agent_type]

        last_error: Optional[Exception] = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                logger.debug(
                    "Calling LLM for %s agent, attempt %d/%d",
                    agent_type, attempt, self.MAX_RETRIES,
                )

                # Build messages
                messages = [{"role": "user", "content": user_message}]

                # On retry after JSON parse failure, append repair prompt
                if attempt > 1 and last_error and "JSON" in str(last_error):
                    messages.append({
                        "role": "assistant",
                        "content": "I apologize for the formatting error. Let me provide the correct JSON:",
                    })
                    messages.append({
                        "role": "user",
                        "content": JSON_REPAIR_PROMPT,
                    })

                if self._provider == "anthropic":
                    response = await self._client.messages.create(
                        model=self._model,
                        max_tokens=self.MAX_TOKENS,
                        temperature=self.TEMPERATURE,
                        system=system_prompt,
                        messages=messages,
                    )
                    raw_text = response.content[0].text
                else:
                    raw_text = await self._call_asi1(system_prompt, messages)
                parsed = self._parse_llm_response(raw_text, agent_type, expected_dims)

                return StakeholderEvaluation(
                    agent_type=agent_type,
                    project_id=project_id,
                    scores=parsed["scores"],
                    overall_narrative=parsed["overall_narrative"],
                    confidence=parsed["confidence"],
                    evaluated_at=datetime.now(timezone.utc).isoformat(),
                )

            except json.JSONDecodeError as e:
                last_error = RuntimeError(f"JSON parse error from {agent_type}: {e}")
                logger.warning(
                    "JSON parse error from %s (attempt %d): %s",
                    agent_type, attempt, e,
                )
            except anthropic.APIError as e:
                last_error = e
                logger.warning(
                    "API error from %s (attempt %d): %s",
                    agent_type, attempt, e,
                )
            except Exception as e:
                last_error = e
                logger.warning(
                    "Unexpected error from %s (attempt %d): %s",
                    agent_type, attempt, e,
                )

            # Exponential backoff
            if attempt < self.MAX_RETRIES:
                backoff = self.BASE_BACKOFF * (2 ** (attempt - 1))
                logger.debug("Backing off %.1fs before retry", backoff)
                await asyncio.sleep(backoff)

        raise RuntimeError(
            f"Stakeholder agent '{agent_type}' failed after {self.MAX_RETRIES} "
            f"retries for project {project_id}. Last error: {last_error}"
        )

    async def _call_asi1(self, system_prompt: str, messages: list[dict[str, Any]]) -> str:
        payload_messages = [{"role": "system", "content": system_prompt}] + messages
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.asi1.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": payload_messages,
                    "max_tokens": self.MAX_TOKENS,
                    "temperature": self.TEMPERATURE,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _parse_llm_response(
        self,
        raw_text: str,
        agent_type: str,
        expected_dims: list[str],
    ) -> dict[str, Any]:
        """
        Parse and validate the LLM's JSON response.

        Args:
            raw_text: Raw text from the LLM.
            agent_type: The agent type for context in error messages.
            expected_dims: List of expected dimension keys.

        Returns:
            Parsed dict with 'scores', 'overall_narrative', and 'confidence'.

        Raises:
            json.JSONDecodeError: If JSON parsing fails.
            ValueError: If the response doesn't match the expected schema.
        """
        # Strip any markdown code fences the LLM may have wrapped around JSON
        cleaned = raw_text.strip()
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        cleaned = cleaned.strip()

        data = json.loads(cleaned)

        # Validate structure
        if "scores" not in data:
            raise ValueError(f"Missing 'scores' key in {agent_type} response")

        scores_raw = data["scores"]
        parsed_scores: dict[str, DimensionScore] = {}

        for dim in expected_dims:
            if dim not in scores_raw:
                raise ValueError(
                    f"Missing dimension '{dim}' in {agent_type} response. "
                    f"Got: {list(scores_raw.keys())}"
                )

            dim_data = scores_raw[dim]
            score_val = int(dim_data.get("score", -1))
            justification = str(dim_data.get("justification", ""))

            if not (0 <= score_val <= 100):
                raise ValueError(
                    f"Score for '{dim}' from {agent_type} out of range: {score_val}"
                )

            parsed_scores[dim] = DimensionScore(
                score=score_val,
                justification=justification,
            )

        narrative = str(data.get("overall_narrative", "No narrative provided."))
        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        return {
            "scores": parsed_scores,
            "overall_narrative": narrative,
            "confidence": confidence,
        }

    def _aggregate_scores(
        self,
        evaluations: list[StakeholderEvaluation],
    ) -> dict[str, float]:
        """
        Compute weighted average scores per dimension.

        Each dimension is owned by one stakeholder, so the weight is
        the stakeholder's weight. The resulting dict maps every scored
        dimension to a weighted score.
        """
        aggregated: dict[str, float] = {}

        for ev in evaluations:
            weight = self._weights.get(ev.agent_type, 0.25)
            for dim_name, dim_score in ev.scores.items():
                # Since each dimension typically belongs to one agent,
                # we just apply the agent's weight as a scaling factor.
                # For cross-agent dimensions (if any), we'd average.
                if dim_name in aggregated:
                    # Multiple agents scored same dimension — average
                    aggregated[dim_name] = (aggregated[dim_name] + dim_score.score) / 2.0
                else:
                    aggregated[dim_name] = float(dim_score.score)

        return {k: round(v, 2) for k, v in aggregated.items()}

    def _compute_overall_score(
        self,
        evaluations: list[StakeholderEvaluation],
    ) -> float:
        """
        Compute a single overall score (0-100) via weighted mean of agent means.
        """
        if not evaluations:
            return 0.0

        weighted_sum = 0.0
        weight_sum = 0.0

        for ev in evaluations:
            w = self._weights.get(ev.agent_type, 0.25)
            weighted_sum += ev.mean_score * w
            weight_sum += w

        if weight_sum == 0:
            return 0.0

        return round(weighted_sum / weight_sum, 2)

    def _compute_data_completeness(
        self,
        evaluations: list[StakeholderEvaluation],
        profile_data: dict[str, Any],
    ) -> float:
        """
        Estimate data completeness from agent confidence and profile fields.
        """
        # Agent confidence average
        if evaluations:
            avg_confidence = sum(e.confidence for e in evaluations) / len(evaluations)
        else:
            avg_confidence = 0.0

        # Profile field coverage (how many of the expected keys are present and non-empty)
        expected_keys = [
            "project_id", "name", "description", "github_url",
            "funding_history", "team", "metrics", "category",
        ]
        present = sum(
            1 for k in expected_keys
            if k in profile_data and profile_data[k]
        )
        field_coverage = present / len(expected_keys) if expected_keys else 0.0

        # Blend: 60% agent confidence, 40% field coverage
        completeness = 0.6 * avg_confidence + 0.4 * field_coverage
        return round(min(1.0, max(0.0, completeness)), 3)

    async def evaluate_batch(
        self,
        profiles: list[dict[str, Any]],
        max_concurrent: int = 3,
    ) -> list[EvaluationResult]:
        """
        Evaluate multiple projects with concurrency control.

        Args:
            profiles: List of project profile dicts.
            max_concurrent: Max number of projects to evaluate simultaneously.

        Returns:
            List of EvaluationResults.
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _eval_with_semaphore(profile: dict) -> Optional[EvaluationResult]:
            async with semaphore:
                try:
                    return await self.evaluate_project(profile)
                except Exception as e:
                    pid = profile.get("project_id", profile.get("id", "unknown"))
                    logger.error("Batch evaluation failed for %s: %s", pid, e)
                    return None

        tasks = [_eval_with_semaphore(p) for p in profiles]
        results = await asyncio.gather(*tasks)
        return [r for r in results if r is not None]

    async def rank_projects(
        self,
        evaluation_results: list[EvaluationResult],
    ) -> dict[str, float]:
        """
        Rank a set of evaluated projects using Bradley-Terry aggregation.

        Args:
            evaluation_results: List of completed evaluations.

        Returns:
            Dict of project_id -> BT strength parameter.
        """
        if len(evaluation_results) < 2:
            logger.warning("Need >= 2 projects for BT ranking")
            return {}

        # Build score dict
        project_scores = {
            er.project_id: er.overall_score
            for er in evaluation_results
        }

        # Generate pairwise comparisons
        comparisons = generate_pairwise_comparisons(project_scores)

        # Run BT
        rankings = bradley_terry_aggregate(comparisons)

        # Update results with BT rank
        for er in evaluation_results:
            er.bradley_terry_rank = rankings.get(er.project_id)

        return rankings
