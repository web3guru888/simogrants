/**
 * SIMOGRANTS — SIMOGrantsAttestation deployment script.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network baseSepolia
 *   npx hardhat run scripts/deploy.js --network base
 *   npx hardhat run scripts/deploy.js --network localhost
 *
 * Environment variables:
 *   DEPLOYER_PRIVATE_KEY  — deployer wallet private key (REQUIRED for live networks)
 *   BASESCAN_API_KEY      — BaseScan API key (for verification)
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log("═══════════════════════════════════════════════════");
  console.log("  SIMOGRANTS — SIMOGrantsAttestation Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Network:   ${network} (chain ${chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:   ${hre.ethers.formatEther(balance)} ETH`);
  console.log("───────────────────────────────────────────────────");

  // Deploy
  console.log("\n▸ Deploying SIMOGrantsAttestation…");
  const factory = await hre.ethers.getContractFactory("SIMOGrantsAttestation");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`  ✓ Deployed to: ${contractAddress}`);

  // Read initial state
  const owner = await contract.owner();
  const epoch = await contract.currentEpoch();
  const isAttester = await contract.authorizedAttesters(deployer.address);
  console.log(`  ✓ Owner:           ${owner}`);
  console.log(`  ✓ Current Epoch:   ${epoch}`);
  console.log(`  ✓ Deployer is attester: ${isAttester}`);

  // Post-deployment config
  const config = {
    network: network,
    chainId: Number(chainId),
    contractAddress: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: (await hre.ethers.provider.getBlockNumber()),
  };

  console.log("\n▸ Deployment config:");
  console.log(JSON.stringify(config, null, 2));

  // Write config to file
  const fs = require("fs");
  const configPath = `./deployments/${network}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n  ✓ Config written to ${configPath}`);

  // Verify on BaseScan (skip for local networks)
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n▸ Waiting 10s for BaseScan indexing…");
    await new Promise((r) => setTimeout(r, 10000));

    try {
      console.log("▸ Verifying contract on BaseScan…");
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("  ✓ Contract verified on BaseScan");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("  ✓ Contract already verified");
      } else {
        console.warn("  ⚠ Verification failed:", err.message);
        console.warn("    You can retry with:");
        console.warn(`    npx hardhat verify --network ${network} ${contractAddress}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment complete!");
  console.log("═══════════════════════════════════════════════════\n");

  return config;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
