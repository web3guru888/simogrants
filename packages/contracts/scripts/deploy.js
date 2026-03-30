/* global ethers */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "(chainId:", network.chainId.toString(), ")");

  // ─── 1. Deploy GrantRound implementation ───
  console.log("\n--- Deploying GrantRound implementation ---");
  const GrantRound = await ethers.getContractFactory("GrantRound");
  const grantRoundImpl = await GrantRound.deploy();
  await grantRoundImpl.waitForDeployment();
  const grantRoundImplAddr = await grantRoundImpl.getAddress();
  console.log("GrantRound implementation:", grantRoundImplAddr);

  // Wait a few seconds to avoid nonce conflicts
  await new Promise(r => setTimeout(r, 5000));

  // ─── 2. Deploy GrantFactory ───
  console.log("\n--- Deploying GrantFactory ---");
  const GrantFactory = await ethers.getContractFactory("GrantFactory");
  const grantFactory = await GrantFactory.deploy(grantRoundImplAddr);
  await grantFactory.waitForDeployment();
  const grantFactoryAddr = await grantFactory.getAddress();
  console.log("GrantFactory:", grantFactoryAddr);

  // Wait a few seconds to avoid nonce conflicts
  await new Promise(r => setTimeout(r, 5000));

  // ─── 3. Deploy SQFMechanism ───
  console.log("\n--- Deploying SQFMechanism ---");
  const SQFMechanism = await ethers.getContractFactory("SQFMechanism");
  const sqfMechanism = await SQFMechanism.deploy();
  await sqfMechanism.waitForDeployment();
  const sqfMechanismAddr = await sqfMechanism.getAddress();
  console.log("SQFMechanism:", sqfMechanismAddr);

  // Wait a few seconds to avoid nonce conflicts
  await new Promise(r => setTimeout(r, 5000));

  // ─── 4. Deploy AttestationRegistry ───
  console.log("\n--- Deploying AttestationRegistry ---");
  const AttestationRegistry = await ethers.getContractFactory("AttestationRegistry");
  const attestationRegistry = await AttestationRegistry.deploy();
  await attestationRegistry.waitForDeployment();
  const attestationRegistryAddr = await attestationRegistry.getAddress();
  console.log("AttestationRegistry:", attestationRegistryAddr);

  // ─── 5. Create a demo GrantRound ───
  console.log("\n--- Creating demo GrantRound ---");
  const oneWeek = 7 * 24 * 60 * 60;
  const applicationDeadline = Math.floor(Date.now() / 1000) + oneWeek;
  const votingDeadline = applicationDeadline + oneWeek;

  const tx = await grantFactory.createRound(
    "ipfs://QmSimograntsDemoRound",
    ethers.parseEther("10000"), // $10K matching pool (informational)
    ethers.ZeroAddress,         // native ETH for demo
    applicationDeadline,
    votingDeadline
  );
  const receipt = await tx.wait();
  const event = receipt.logs
    .map(log => {
      try { return grantFactory.interface.parseLog(log); } catch { return null; }
    })
    .find(e => e?.name === "RoundCreated");
  const demoRoundAddr = event.args.roundAddress;
  console.log("Demo GrantRound:", demoRoundAddr);

  // ─── 6. Save deployed addresses ───
  const addresses = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      GrantRoundImplementation: grantRoundImplAddr,
      GrantFactory: grantFactoryAddr,
      SQFMechanism: sqfMechanismAddr,
      AttestationRegistry: attestationRegistryAddr,
      DemoGrantRound: demoRoundAddr,
    },
  };

  const fs = require("fs");
  const path = require("path");
  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\n--- Addresses saved to deployed-addresses.json ---");

  // Also verify factory isRound for the demo round
  console.log("\n--- Verification ---");
  console.log("isRound(demoRound):", await grantFactory.isRound(demoRoundAddr));
  console.log("roundCount:", (await grantFactory.roundCount()).toString());

  console.log("\n✅ All contracts deployed successfully!");
  console.table(addresses.contracts);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
