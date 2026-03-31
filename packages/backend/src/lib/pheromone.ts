/**
 * Pheromone Tracker
 * Ported from /shared/simogrants/src/mechanism/pheromone.py
 * 
 * Tracks historical accuracy of projects as "pheromone trails".
 * Projects with consistent accuracy get a funding modifier boost.
 */

const INITIAL = 5.0;
const MIN = 0.0;
const MAX = 10.0;
const DECAY_RATE = 0.2;
const DEPOSIT_RATE = 0.5;

export class PheromoneTracker {
  private pheromones: Map<string, number> = new Map();

  getLevel(projectId: string): number {
    return this.pheromones.get(projectId) ?? INITIAL;
  }

  decayAll(): void {
    for (const [pid] of this.pheromones) {
      const current = this.pheromones.get(pid)!;
      this.pheromones.set(pid, this.clamp(current * (1 - DECAY_RATE)));
    }
  }

  deposit(projectId: string, accuracy: number): void {
    const current = this.getLevel(projectId);
    const delta = DEPOSIT_RATE * Math.max(0.0, Math.min(1.0, accuracy));
    this.pheromones.set(projectId, this.clamp(current + delta));
  }

  getModifier(projectId: string): number {
    const level = this.getLevel(projectId);
    return 0.5 + level / 10.0;
  }

  getState(): Record<string, number> {
    return Object.fromEntries(this.pheromones);
  }

  loadState(state: Record<string, number>): void {
    this.pheromones = new Map(
      Object.entries(state).map(([k, v]) => [k, this.clamp(Number(v))])
    );
  }

  private clamp(value: number): number {
    return Math.max(MIN, Math.min(MAX, value));
  }
}
