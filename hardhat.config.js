require("@nomicfoundation/hardhat-toolbox");

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "00".repeat(32);

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 10000 },
      evmVersion: "paris",
    },
  },
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: [DEPLOYER_KEY],
    },
    hardhat: { chainId: 31337 },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [DEPLOYER_KEY],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
