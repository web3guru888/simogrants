/** Get block explorer URL for an address on a given chain */
export function getExplorerUrl(chainId: number, address: string): string {
  switch (chainId) {
    case 8453: // Base Mainnet
      return `https://basescan.org/address/${address}`;
    case 84532: // Base Sepolia
      return `https://sepolia.basescan.org/address/${address}`;
    default:
      return `https://sepolia.basescan.org/address/${address}`;
  }
}

/** Get block explorer URL for a transaction hash */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  switch (chainId) {
    case 8453:
      return `https://basescan.org/tx/${txHash}`;
    case 84532:
      return `https://sepolia.basescan.org/tx/${txHash}`;
    default:
      return `https://sepolia.basescan.org/tx/${txHash}`;
  }
}
