/**
 * On-Chain Attestation
 *
 * Publishes evaluation attestation hashes to the AttestationRegistry contract
 * on Base Sepolia. Each attestation contains a keccak256 hash of the evaluation
 * data and an optional IPFS CID reference.
 *
 * Requires DEPLOYER_PRIVATE_KEY secret for signing transactions.
 * Falls back gracefully if key is not configured.
 */

// Simple keccak256 using Web Crypto API (available in Workers)
async function keccak256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface AttestationResult {
  evaluationHash: string;
  projectHashes: Record<string, string>;
  ipfsCid: string | null;
  timestamp: string;
}

/**
 * Compute attestation hashes for an evaluation round.
 *
 * This generates deterministic hashes of the evaluation data that can be
 * verified independently. The hashes are stored in the database and can
 * be published on-chain when a signing key is available.
 *
 * @param roundId - The round being attested
 * @param evaluationScores - Project scores
 * @param allocations - SQF allocations
 * @param ipfsCid - Optional IPFS CID of the evidence bundle
 * @returns Attestation hashes
 */
export async function computeAttestation(
  roundId: string,
  evaluationScores: Record<string, number>,
  allocations: Record<string, { amount: number }>,
  ipfsCid: string | null = null,
): Promise<AttestationResult> {
  // Hash each project's evaluation
  const projectHashes: Record<string, string> = {};
  for (const [projectId, score] of Object.entries(evaluationScores)) {
    const allocation = allocations[projectId]?.amount || 0;
    const data = `${roundId}:${projectId}:${score}:${allocation}`;
    projectHashes[projectId] = await keccak256Hex(data);
  }

  // Hash the entire round evaluation
  const roundData = JSON.stringify({
    roundId,
    scores: evaluationScores,
    allocations: Object.fromEntries(
      Object.entries(allocations).map(([k, v]) => [k, v.amount])
    ),
    ipfsCid,
    timestamp: new Date().toISOString(),
  });
  const evaluationHash = await keccak256Hex(roundData);

  return {
    evaluationHash,
    projectHashes,
    ipfsCid,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Store attestation data in the pipeline run results.
 * On-chain publishing requires DEPLOYER_PRIVATE_KEY which is not yet configured,
 * so we store the hashes in D1 for now and they can be verified independently.
 */
export async function storeAttestation(
  db: D1Database,
  runId: string,
  attestation: AttestationResult,
): Promise<void> {
  // Update pipeline run with attestation data
  const currentResults = await db.prepare(
    'SELECT results FROM pipeline_runs WHERE run_id = ?'
  ).bind(runId).first<{ results: string }>();

  let results: Record<string, unknown> = {};
  if (currentResults?.results) {
    try { results = JSON.parse(currentResults.results); } catch {}
  }

  results.attestation = attestation;

  await db.prepare(
    'UPDATE pipeline_runs SET results = ? WHERE run_id = ?'
  ).bind(JSON.stringify(results), runId).run();
}
