/**
 * Anti-Goodhart Dimension Rotation
 *
 * Prevents metric gaming by rotating which dimensions are actively evaluated per epoch.
 * Uses a deterministic rotation based on epoch number so results are reproducible.
 */

import { STAKEHOLDER_DIMENSIONS } from '../types';

const ALL_DIMENSIONS = Object.values(STAKEHOLDER_DIMENSIONS).flat();
const DEFAULT_ACTIVE_DIMS = 9; // Out of 12 total — rotate out 3 per epoch

/**
 * Select which dimensions are active for a given epoch.
 * Uses a deterministic shuffle based on epoch number.
 */
export function getActiveDimensions(
  epoch: number,
  activeDims: number = DEFAULT_ACTIVE_DIMS,
): Record<string, string[]> {
  if (activeDims >= ALL_DIMENSIONS.length) {
    return { ...STAKEHOLDER_DIMENSIONS };
  }

  // Deterministic shuffle using Knuth multiplicative hash
  const shuffled = [...ALL_DIMENSIONS];
  let seed = epoch * 2654435761;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const active = new Set(shuffled.slice(0, activeDims));

  // Group back by stakeholder, preserving only active dimensions
  const result: Record<string, string[]> = {};
  for (const [stakeholder, dims] of Object.entries(STAKEHOLDER_DIMENSIONS)) {
    const activeDimsForStakeholder = dims.filter(d => active.has(d));
    if (activeDimsForStakeholder.length > 0) {
      result[stakeholder] = activeDimsForStakeholder;
    }
  }

  return result;
}

/**
 * Get which dimensions were rotated out for this epoch.
 */
export function getRotatedOutDimensions(
  epoch: number,
  activeDims: number = DEFAULT_ACTIVE_DIMS,
): string[] {
  const active = getActiveDimensions(epoch, activeDims);
  const allActive = Object.values(active).flat();
  return ALL_DIMENSIONS.filter(d => !allActive.includes(d));
}

/**
 * Get a summary of the rotation for this epoch.
 */
export function getRotationSummary(epoch: number, activeDims: number = DEFAULT_ACTIVE_DIMS): string {
  const rotatedOut = getRotatedOutDimensions(epoch, activeDims);
  if (rotatedOut.length === 0) return 'All 12 dimensions active';
  return `Epoch ${epoch}: ${rotatedOut.length} rotated out — ${rotatedOut.join(', ')}`;
}
