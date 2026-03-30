import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { type Address } from 'viem';
import {
  GrantFactoryAbi, GrantRoundAbi, SQFMechanismAbi, AttestationRegistryAbi,
  getAddresses, isContractsDeployed, SCORE_PRECISION, toContractScore,
} from '@/lib/contractsConfig';

// ─── Helper: wrap writeContract with error handling ────────────────

interface TxResult {
  hash: `0x${string}`;
  wait: () => Promise<void>;
}

// ─── useCreateRound ─────────────────────────────────────────────────
// Calls GrantFactory.createRound() to deploy a new GrantRound proxy.
// Returns { write, hash, isPending, error, contractsReady }

export function useCreateRound() {
  const chainId = useChainId();
  const ready = isContractsDeployed(chainId);
  const addresses = getAddresses(chainId);

  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createRound = async (params: {
    metadataURI: string;
    matchingPool: number;
    token: Address;
    applicationDeadline: Date;
    votingDeadline: Date;
  }) => {
    if (!ready) return null;
    const h = await writeContractAsync({
      address: addresses.GrantFactory,
      abi: GrantFactoryAbi,
      functionName: 'createRound',
      args: [
        params.metadataURI,
        BigInt(params.matchingPool * 1e6), // USDC 6 decimals
        params.token as Address,
        BigInt(Math.floor(params.applicationDeadline.getTime() / 1000)),
        BigInt(Math.floor(params.votingDeadline.getTime() / 1000)),
      ],
    });
    return h;
  };

  return {
    createRound,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
    contractsReady: ready,
  };
}

// ─── useApplyToRound ────────────────────────────────────────────────
// Calls GrantRound.submitApplication() on the specific round contract.
// The roundAddress is the GrantRound proxy address (from round.contractAddress).

export function useApplyToRound() {
  const chainId = useChainId();

  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const apply = async (params: {
    roundAddress: Address;
    metadataURI: string;
  }) => {
    if (!params.roundAddress || params.roundAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    const h = await writeContractAsync({
      address: params.roundAddress,
      abi: GrantRoundAbi,
      functionName: 'submitApplication',
      args: [params.metadataURI],
    });
    return h;
  };

  return {
    apply,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ─── useStartEvaluation ─────────────────────────────────────────────
// Calls GrantRound.startEvaluation() to transition from Accepting → Evaluating.

export function useStartEvaluation() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const startEvaluation = async (roundAddress: Address) => {
    if (!roundAddress || roundAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    const h = await writeContractAsync({
      address: roundAddress,
      abi: GrantRoundAbi,
      functionName: 'startEvaluation',
      args: [],
    });
    return h;
  };

  return {
    startEvaluation,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ─── useRecordScores ────────────────────────────────────────────────
// Calls GrantRound.recordScores() to submit evaluation scores.

export function useRecordScores() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const recordScores = async (params: {
    roundAddress: Address;
    applicationIds: bigint[];
    scores: bigint[];
  }) => {
    if (!params.roundAddress || params.roundAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    const h = await writeContractAsync({
      address: params.roundAddress,
      abi: GrantRoundAbi,
      functionName: 'recordScores',
      args: [params.applicationIds, params.scores],
    });
    return h;
  };

  return {
    recordScores,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ─── useSQFComputeFromScores ───────────────────────────────────────
// Calls SQFMechanism.computeFromScores() to get on-chain SQF allocation.

export function useSQFComputeFromScores() {
  const chainId = useChainId();
  const ready = isContractsDeployed(chainId);
  const addresses = getAddresses(chainId);

  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const compute = async (params: {
    applicationIds: bigint[];
    scores: number[]; // 0-100
    matchingPool: number;
  }) => {
    if (!ready) return null;
    const contractScores = params.scores.map(s => toContractScore(s) * SCORE_PRECISION / BigInt(100));
    const h = await writeContractAsync({
      address: addresses.SQFMechanism,
      abi: SQFMechanismAbi,
      functionName: 'computeFromScores',
      args: [
        params.applicationIds,
        contractScores,
        BigInt(params.matchingPool * 1e6), // USDC 6 decimals
      ],
    });
    return h;
  };

  return {
    compute,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
    contractsReady: ready,
  };
}

// ─── Read hooks ─────────────────────────────────────────────────────

// Read the status of a GrantRound contract
export function useRoundOnChainStatus(roundAddress: Address | undefined) {
  return useReadContract({
    address: roundAddress || '0x0000000000000000000000000000000000000001',
    abi: GrantRoundAbi,
    functionName: 'getStatus',
    query: {
      enabled: !!roundAddress && roundAddress !== '0x0000000000000000000000000000000000000000',
    },
  });
}

// Read an application from a GrantRound contract
export function useOnChainApplication(roundAddress: Address | undefined, applicationId: bigint | undefined) {
  return useReadContract({
    address: roundAddress || '0x0000000000000000000000000000000000000001',
    abi: GrantRoundAbi,
    functionName: 'getApplication',
    args: applicationId !== undefined ? [applicationId] : undefined,
    query: {
      enabled: !!roundAddress && roundAddress !== '0x0000000000000000000000000000000000000000' && applicationId !== undefined,
    },
  });
}

// Read all application IDs from a GrantRound contract
export function useOnChainApplicationIds(roundAddress: Address | undefined) {
  return useReadContract({
    address: roundAddress || '0x0000000000000000000000000000000000000001',
    abi: GrantRoundAbi,
    functionName: 'getAllApplicationIds',
    query: {
      enabled: !!roundAddress && roundAddress !== '0x0000000000000000000000000000000000000000',
    },
  });
}

// Read pheromone level from SQFMechanism
export function usePheromoneLevel(applicationId: bigint | undefined) {
  const chainId = useChainId();
  const addresses = getAddresses(chainId);
  const ready = isContractsDeployed(chainId);

  return useReadContract({
    address: addresses.SQFMechanism,
    abi: SQFMechanismAbi,
    functionName: 'getPheromoneLevel',
    args: applicationId !== undefined ? [applicationId] : undefined,
    query: {
      enabled: ready && applicationId !== undefined,
    },
  });
}

// Read attestation for a project from AttestationRegistry
export function useLatestAttestation(projectHash: `0x${string}` | undefined) {
  const chainId = useChainId();
  const addresses = getAddresses(chainId);
  const ready = isContractsDeployed(chainId);

  return useReadContract({
    address: addresses.AttestationRegistry,
    abi: AttestationRegistryAbi,
    functionName: 'getLatestAttestation',
    args: projectHash ? [projectHash] : undefined,
    query: {
      enabled: ready && !!projectHash,
    },
  });
}

// Read factory round count
export function useFactoryRoundCount() {
  const chainId = useChainId();
  const addresses = getAddresses(chainId);
  const ready = isContractsDeployed(chainId);

  return useReadContract({
    address: addresses.GrantFactory,
    abi: GrantFactoryAbi,
    functionName: 'roundCount',
    query: {
      enabled: ready,
    },
  });
}
