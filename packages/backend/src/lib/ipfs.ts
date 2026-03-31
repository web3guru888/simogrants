/**
 * IPFS Evidence Upload
 *
 * Uploads evaluation evidence bundles to IPFS via web3.storage HTTP API.
 * Returns CID for on-chain attestation references.
 *
 * Falls back gracefully if no WEB3_STORAGE_TOKEN is configured —
 * evidence is still stored in R2, just without an IPFS CID.
 */

const WEB3_STORAGE_API = 'https://api.web3.storage/upload';

export interface IPFSUploadResult {
  cid: string;
  url: string;
}

/**
 * Upload a JSON evidence bundle to IPFS via web3.storage.
 *
 * @param token - web3.storage API token
 * @param data - JSON-serializable evidence data
 * @param filename - Optional filename for the upload
 * @returns CID and gateway URL, or null if upload fails
 */
export async function uploadToIPFS(
  token: string,
  data: unknown,
  filename: string = 'evidence.json',
): Promise<IPFSUploadResult | null> {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const response = await fetch(WEB3_STORAGE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error(`[ipfs] Upload failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const result = await response.json() as { cid: string };
    return {
      cid: result.cid,
      url: `https://w3s.link/ipfs/${result.cid}`,
    };
  } catch (err) {
    console.error('[ipfs] Upload error:', err);
    return null;
  }
}

/**
 * Generate an evidence bundle from evaluation data.
 */
export function buildEvidenceBundle(
  roundId: string,
  evaluationScores: Record<string, number>,
  allocations: Record<string, { amount: number; qfBase: number; pheromoneMod: number; pagerankMod: number }>,
  pheromoneState: Record<string, number>,
  epoch: number,
): Record<string, unknown> {
  return {
    version: '1.0.0',
    type: 'evaluation_evidence',
    roundId,
    timestamp: new Date().toISOString(),
    epoch,
    evaluationScores,
    allocations,
    pheromoneState,
    mechanism: {
      type: 'stigmergic_quadratic_funding',
      components: ['quadratic_funding', 'pheromone_trails', 'pagerank_dependency'],
    },
  };
}
