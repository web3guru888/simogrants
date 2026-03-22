const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();
  const fee = await provider.getFeeData();
  const deployTxHash = '0x89a49559d131f9ab3287f7959ca68bd603db52a29b4e21a5055a77ee224faef1';
  const deployReceipt = await provider.getTransactionReceipt(deployTxHash);
  if (!deployReceipt || deployReceipt.status !== 1) throw new Error('Deployment tx not confirmed');
  const contractAddress = deployReceipt.contractAddress;
  const contract = await hre.ethers.getContractAt('SIMOGrantsAttestation', contractAddress);
  const pipeline = JSON.parse(fs.readFileSync(path.join(process.cwd(),'pipeline_results.json'),'utf8'));
  const filecoin = pipeline.filecoin?.individual_cids || {};
  const desired = ['openzeppelin','uniswap-v3','gitcoin-passport','ethstaker','protocol-guild'];
  const evals = new Map((pipeline.evaluations || []).map(e => [e.project_id, e]));
  let nonce = await provider.getTransactionCount(deployer.address, 'latest');
  const maxPriorityFeePerGas = (fee.maxPriorityFeePerGas || 1000000n) * 3n;
  const maxFeePerGas = ((fee.maxFeePerGas || fee.gasPrice || 6000000n) * 3n) + maxPriorityFeePerGas;
  const txs = [];
  for (const pid of desired) {
    const ev = evals.get(pid);
    if (!ev) throw new Error(`Missing evaluation for ${pid}`);
    const evidencePath = path.join(process.cwd(),'pipeline_output','evidence',`${pid}_evidence.json`);
    const evidenceJson = fs.readFileSync(evidencePath,'utf8');
    const projectHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(pid));
    const evaluationHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(evidenceJson));
    const cid = filecoin[pid]?.cid || pipeline.onchain?.attestation_transactions?.find(t=>t.project_id===pid)?.filecoin_cid;
    if (!cid) throw new Error(`Missing CID for ${pid}`);
    const tx = await contract.publishAttestation(projectHash, evaluationHash, cid, { nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit: 250000 });
    const receipt = await tx.wait();
    txs.push({ project_id: pid, tx_hash: tx.hash, block_number: receipt.blockNumber, gas_used: Number(receipt.gasUsed), project_hash: projectHash, evaluation_hash: evaluationHash, filecoin_cid: cid, overall_score: ev.overall_score, status: receipt.status === 1 ? 'confirmed' : 'failed' });
    nonce += 1;
  }
  const totalAttestations = Number(await contract.totalAttestations());
  const out = { status:'published', network: 'Base Mainnet', chain_id: Number(network.chainId), contract_address: contractAddress, deployer: deployer.address, deploy_tx: deployTxHash, timestamp: new Date().toISOString(), total_attestations: totalAttestations, attestation_transactions: txs, basescan_contract: `https://basescan.org/address/${contractAddress}`, basescan_deployer: `https://basescan.org/address/${deployer.address}` };
  fs.writeFileSync(path.join(process.cwd(),'pipeline_output','onchain_results.mainnet.json'), JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
}
main().catch((e)=>{ console.error(e); process.exit(1); });
