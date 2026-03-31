"""
SIMOGRANTS configuration management.
Loads from environment variables with sensible defaults.
"""

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    # API
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = field(default_factory=lambda: ["*"])

    # Collector
    collector_timeout: int = 30
    collector_max_concurrent: int = 7
    collector_cache_ttl_hours: int = 24

    # API Keys (from environment — NEVER log these)
    asi1_api_key: str = ""
    github_token: str = ""
    etherscan_api_key: str = ""
    web3_storage_token: str = ""
    base_rpc_url: str = "https://mainnet.base.org"
    synthesis_api_key: str = ""

    # Evaluator
    evaluator_model: str = "asi1-mini"
    evaluator_temperature: float = 0.3
    evaluator_max_tokens: int = 4096
    tension_threshold: int = 35

    # Mechanism
    matching_pool: float = 100000.0
    pheromone_initial: float = 5.0
    pheromone_min: float = 0.0
    pheromone_max: float = 10.0
    pheromone_decay_rate: float = 0.2
    pheromone_deposit_rate: float = 0.5
    pagerank_damping: float = 0.85
    anti_goodhart_active_dims: int = 8

    # Blockchain
    chain_id: int = 8453
    contract_address: str = ""
    gas_limit: int = 500000

    # Database
    database_url: str = "sqlite:///simogrants.db"

    @classmethod
    def from_env(cls) -> "Settings":
        """Load settings from environment variables."""
        return cls(
            asi1_api_key=os.environ.get("ASI1_API_KEY", ""),
            github_token=os.environ.get("GITHUB_TOKEN", ""),
            etherscan_api_key=os.environ.get("ETHERSCAN_API_KEY", ""),
            web3_storage_token=os.environ.get("WEB3_STORAGE_TOKEN", ""),
            base_rpc_url=os.environ.get("BASE_RPC_URL", "https://mainnet.base.org"),
            synthesis_api_key=os.environ.get("SYNTHESIS_API_KEY", ""),
            matching_pool=float(os.environ.get("MATCHING_POOL", "100000")),
        )


# Singleton settings instance
settings = Settings.from_env()
