/* global ethers */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Creating demo round with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const factoryAddr = "0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA";
  
  const GrantFactory = await ethers.getContractFactory("GrantFactory");
  const grantFactory = GrantFactory.attach(factoryAddr);

  const oneWeek = 7 * 24 * 60 * 60;
  const applicationDeadline = Math.floor(Date.now() / 1000) + oneWeek;
  const votingDeadline = applicationDeadline + oneWeek;

  console.log("App deadline:", new Date(applicationDeadline * 1000).toISOString());
  console.log("Voting deadline:", new Date(votingDeadline * 1000).toISOString());

  const tx = await grantFactory.createRound(
    "ipfs://QmSimograntsDemoRound",
    ethers.parseEther("10000"), // $10K matching pool (informational)
    ethers.ZeroAddress,         // native ETH for demo
    applicationDeadline,
    votingDeadline,
    { gasLimit: 500000 }
  );
  console.log("TX sent:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("TX confirmed in block:", receipt.blockNumber);

  const event = receipt.logs
    .map(log => {
      try { return grantFactory.interface.parseLog(log); } catch { return null; }
    })
    .find(e => e?.name === "RoundCreated");
  
  if (event) {
    const demoRoundAddr = event.args.roundAddress;
    console.log("Demo GrantRound:", demoRoundAddr);

    // Update deployed-addresses.json
    const fs = require("fs");
    const path = require("path");
    const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    addresses.contracts.DemoGrantRound = demoRoundAddr;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("Updated deployed-addresses.json with demo round address");
  } else {
    console.log("Warning: Could not find RoundCreated event in logs");
    console.log("All logs:", receipt.logs);
  }

  console.log("\n✅ Demo round created!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
