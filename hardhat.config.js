require("@nomicfoundation/hardhat-toolbox");

// Optional: load .env if dotenv is available
try { require("dotenv").config(); } catch (_) {}

// Private key from environment — NEVER hardcode
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "00".repeat(32);
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000, // High runs → optimized for frequent calls
      },
      viaIR: false,
      evmVersion: "paris", // Base uses pre-Cancun EVM
    },
  },

  networks: {
    // Local Hardhat node (default)
    hardhat: {
      chainId: 31337,
    },

    // Base Sepolia testnet (chain ID 84532)
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      chainId: 84532,
      accounts: [DEPLOYER_KEY],
      gasPrice: "auto",
    },

    // Base mainnet (chain ID 8453)
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: [DEPLOYER_KEY],
      gasPrice: "auto",
    },
  },

  etherscan: {
    apiKey: {
      base: BASESCAN_API_KEY,
      baseSepolia: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 0.001, // Base L2 gas is cheap
    outputFile: process.env.GAS_REPORT_FILE || undefined,
    noColors: !!process.env.GAS_REPORT_FILE,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
