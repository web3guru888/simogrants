const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=" .repeat(60));
  console.log("SIMOGRANTS — Deploy & Publish On-Chain Attestations");
  console.log("=" .repeat(60));

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`\nNetwork: ${network.name} (chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // ─── Deploy Contract ────────────────────────────────────────────
  console.log("\n--- DEPLOYING SIMOGrantsAttestation ---");
  const Factory = await ethers.getContractFactory("SIMOGrantsAttestation");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();
  console.log(`Contract deployed: ${contractAddr}`);
  
  const deployTx = contract.deploymentTransaction();
  console.log(`Deploy tx: ${deployTx.hash}`);

  // ─── Load Pipeline Results ──────────────────────────────────────
  const resultsPath = path.join(__dirname, "..", "pipeline_results.json");
  const pipeline = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  
  console.log(`\nFound ${pipeline.evaluations.length} project evaluations`);

  // ─── Publish Attestations ───────────────────────────────────────
  console.log("\n--- PUBLISHING ATTESTATIONS ---\n");
  
  const txHashes = [];
  
  for (const ev of pipeline.evaluations) {
    const pid = ev.project_id;
    
    // Build evidence bundle
    const evidence = {
      project_id: pid,
      evaluation: ev,
      timestamp: new Date().toISOString(),
      system: "SIMOGRANTS",
    };
    const evidenceJson = JSON.stringify(evidence);
    
    // Compute hashes
    const projectHash = ethers.keccak256(ethers.toUtf8Bytes(pid));
    const evaluationHash = ethers.keccak256(ethers.toUtf8Bytes(evidenceJson));
    
    // Use a placeholder CID (would be Filecoin CID in production)
    const cid = `bafyrei${ethers.keccak256(ethers.toUtf8Bytes(pid + Date.now())).slice(2, 60)}`;
    
    // Publish on-chain
    const tx = await contract.publishAttestation(projectHash, evaluationHash, cid);
    const receipt = await tx.wait();
    
    console.log(`  ✓ ${pid.padEnd(20)} tx=${tx.hash.slice(0, 18)}... block=${receipt.blockNumber} gas=${receipt.gasUsed}`);
    console.log(`    projHash=${projectHash.slice(0, 18)}...`);
    console.log(`    evalHash=${evaluationHash.slice(0, 18)}...`);
    console.log(`    score=${ev.overall_score}  cid=${cid.slice(0, 30)}...`);
    console.log();
    
    txHashes.push({
      project_id: pid,
      tx_hash: tx.hash,
      block_number: receipt.blockNumber,
      gas_used: Number(receipt.gasUsed),
      project_hash: projectHash,
      evaluation_hash: evaluationHash,
      filecoin_cid: cid,
      overall_score: ev.overall_score,
    });
  }

  // ─── Verify On-Chain Data ────────────────────────────────────────
  console.log("--- VERIFYING ON-CHAIN DATA ---\n");
  
  const totalAtts = await contract.totalAttestations();
  const epoch = await contract.currentEpoch();
  console.log(`Total attestations on-chain: ${totalAtts}`);
  console.log(`Current epoch: ${epoch}`);
  
  for (const att of txHashes) {
    const count = await contract.getAttestationCount(att.project_hash);
    const latest = await contract.getLatestAttestation(att.project_hash);
    console.log(`  ${att.project_id}: ${count} attestations, latest timestamp=${latest.timestamp}`);
  }

  // ─── Save Results ───────────────────────────────────────────────
  const onchainResults = {
    status: "published",
    network: network.name,
    chain_id: Number(network.chainId),
    contract_address: contractAddr,
    deployer: deployer.address,
    deploy_tx: deployTx.hash,
    timestamp: new Date().toISOString(),
    total_attestations: Number(totalAtts),
    current_epoch: Number(epoch),
    attestation_transactions: txHashes,
    total_gas_used: txHashes.reduce((sum, t) => sum + t.gas_used, 0),
  };

  const outputPath = path.join(__dirname, "..", "pipeline_output", "onchain_results.json");
  fs.writeFileSync(outputPath, JSON.stringify(onchainResults, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
  
  // Also update pipeline_results.json with tx hashes
  pipeline.onchain = onchainResults;
  fs.writeFileSync(resultsPath, JSON.stringify(pipeline, null, 2));
  console.log(`Updated pipeline_results.json with on-chain data`);

  console.log("\n" + "=" .repeat(60));
  console.log("ON-CHAIN ATTESTATION COMPLETE");
  console.log("=" .repeat(60));
  console.log(`Contract: ${contractAddr}`);
  console.log(`Attestations: ${totalAtts} published`);
  console.log(`Total gas: ${onchainResults.total_gas_used.toLocaleString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
