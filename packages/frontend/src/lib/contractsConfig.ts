import GrantFactoryAbi from './abi/GrantFactory.json';
import GrantRoundAbi from './abi/GrantRound.json';
import SQFMechanismAbi from './abi/SQFMechanism.json';
import AttestationRegistryAbi from './abi/AttestationRegistry.json';

// Re-export ABIs for use in hooks
export { GrantFactoryAbi, GrantRoundAbi, SQFMechanismAbi, AttestationRegistryAbi };

// Contract addresses per chain.
// Priority: env var → hardcoded fallback (hardhat local dev)
export const CONTRACT_ADDRESSES: Record<
  number,
  {
    GrantFactory: `0x${string}`;
    GrantRoundImplementation: `0x${string}`;
    SQFMechanism: `0x${string}`;
    AttestationRegistry: `0x${string}`;
  }
> = {
  // Hardhat local (from deployed-addresses.json)
  31337: {
    GrantFactory: (import.meta.env.VITE_GRANT_FACTORY_ADDRESS as `0x${string}`) || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    GrantRoundImplementation: (import.meta.env.VITE_GRANT_ROUND_IMPL_ADDRESS as `0x${string}`) || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    SQFMechanism: (import.meta.env.VITE_SQF_MECHANISM_ADDRESS as `0x${string}`) || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    AttestationRegistry: (import.meta.env.VITE_ATTESTATION_REGISTRY_ADDRESS as `0x${string}`) || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },
  // Base Sepolia (testnet — deployed 2026-03-30)
  84532: {
    GrantFactory: (import.meta.env.VITE_GRANT_FACTORY_ADDRESS as `0x${string}`) || '0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA',
    GrantRoundImplementation: (import.meta.env.VITE_GRANT_ROUND_IMPL_ADDRESS as `0x${string}`) || '0x27E39D006baAbD15f38D8Ecf63Dd61086affeC66',
    SQFMechanism: (import.meta.env.VITE_SQF_MECHANISM_ADDRESS as `0x${string}`) || '0x77FFD92fbD6720Dc1cE504B971E9AbdDd7F5b1BA',
    AttestationRegistry: (import.meta.env.VITE_ATTESTATION_REGISTRY_ADDRESS as `0x${string}`) || '0xb7064a2C8283a7a5f2D54E43c509FE76DA2D1dD9',
  },
  // Base Mainnet (production — addresses TBD, set via env)
  8453: {
    GrantFactory: (import.meta.env.VITE_GRANT_FACTORY_ADDRESS as `0x${string}`) || '0x0000000000000000000000000000000000000000',
    GrantRoundImplementation: (import.meta.env.VITE_GRANT_ROUND_IMPL_ADDRESS as `0x${string}`) || '0x0000000000000000000000000000000000000000',
    SQFMechanism: (import.meta.env.VITE_SQF_MECHANISM_ADDRESS as `0x${string}`) || '0x0000000000000000000000000000000000000000',
    AttestationRegistry: (import.meta.env.VITE_ATTESTATION_REGISTRY_ADDRESS as `0x${string}`) || '0x0000000000000000000000000000000000000000',
  },
};

/** Get contract addresses for a given chain ID. Falls back to hardhat. */
export function getAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[31337];
}

/** True when contracts are deployed (not zero-address) on the given chain. */
export function isContractsDeployed(chainId: number): boolean {
  const addrs = getAddresses(chainId);
  return addrs.GrantFactory !== '0x0000000000000000000000000000000000000000';
}

// Score precision used by contracts (1e18)
export const SCORE_PRECISION = BigInt(10 ** 18);

// Helper: parse a 0-100 score into contract precision
export function toContractScore(score: number): bigint {
  return BigInt(Math.round(score * Number(SCORE_PRECISION) / 100));
}

// Helper: parse contract score back to 0-100
export function fromContractScore(raw: bigint): number {
  return Number(raw) / Number(SCORE_PRECISION) * 100;
}
