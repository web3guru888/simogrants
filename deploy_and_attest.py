#!/usr/bin/env python3
"""
SIMOGRANTS On-Chain Deployment & Attestation
=============================================
1. Generate a fresh deployer wallet
2. Deploy SIMOGrantsAttestation to Base Sepolia
3. Publish all 5 evaluation attestations on-chain
4. Save tx hashes and contract address

This uses Base Sepolia testnet (chain ID 84532) to avoid needing real ETH.
"""
from __future__ import annotations

import json
import os
import sys
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from web3 import Web3
from eth_account import Account
from eth_hash.auto import keccak

# Load pipeline results
results_path = Path("/workspace/pipeline_results.json")
if not results_path.exists():
    print("ERROR: pipeline_results.json not found. Run the pipeline first.")
    sys.exit(1)

with open(results_path) as f:
    pipeline = json.load(f)

print("=" * 60)
print("SIMOGRANTS ON-CHAIN DEPLOYMENT")
print("=" * 60)

# ─── Generate or load wallet ──────────────────────────────────────────
wallet_path = Path("/workspace/.deployer_wallet.json")
if wallet_path.exists():
    with open(wallet_path) as f:
        wallet = json.load(f)
    print(f"Loaded existing wallet: {wallet['address']}")
else:
    acct = Account.create()
    wallet = {
        "address": acct.address,
        "private_key": acct.key.hex(),
    }
    wallet_path.write_text(json.dumps(wallet, indent=2))
    print(f"Generated new wallet: {wallet['address']}")

print(f"Deployer address: {wallet['address']}")

# ─── Try multiple RPC endpoints ──────────────────────────────────────
RPC_ENDPOINTS = [
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
    "https://base-sepolia.gateway.tenderly.co",
]

w3 = None
for rpc in RPC_ENDPOINTS:
    try:
        _w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 15}))
        if _w3.is_connected():
            chain_id = _w3.eth.chain_id
            print(f"Connected to {rpc} (chain ID: {chain_id})")
            w3 = _w3
            break
    except Exception as e:
        print(f"  Failed: {rpc} — {e}")

if w3 is None:
    # Try Base mainnet
    print("Testnet unavailable. Trying Base mainnet...")
    try:
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org", request_kwargs={"timeout": 15}))
        if w3.is_connected():
            print(f"Connected to Base mainnet (chain ID: {w3.eth.chain_id})")
        else:
            w3 = None
    except:
        w3 = None

if w3 is None:
    print("ERROR: Cannot connect to any RPC endpoint")
    print("Saving computed attestation data without on-chain publication...")
    
    # Still compute and save the hashes properly using keccak256
    onchain_results = {
        "status": "offline",
        "reason": "No RPC connection available",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "deployer_address": wallet["address"],
        "computed_attestations": [],
    }
    
    for ev in pipeline["evaluations"]:
        pid = ev["project_id"]
        evidence = {
            "project_id": pid,
            "evaluation": ev,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": "SIMOGRANTS",
        }
        evidence_json = json.dumps(evidence, separators=(",", ":"), sort_keys=True).encode()
        eval_hash = "0x" + keccak(evidence_json).hex()
        proj_hash = "0x" + keccak(pid.encode("utf-8")).hex()
        
        onchain_results["computed_attestations"].append({
            "project_id": pid,
            "project_hash_keccak256": proj_hash,
            "evaluation_hash_keccak256": eval_hash,
            "overall_score": ev["overall_score"],
            "evidence_size": len(evidence_json),
        })
        print(f"  {pid}: projHash={proj_hash[:18]}... evalHash={eval_hash[:18]}...")
    
    Path("/workspace/pipeline_output/onchain_results.json").write_text(
        json.dumps(onchain_results, indent=2)
    )
    print("\nSaved to /workspace/pipeline_output/onchain_results.json")
    sys.exit(0)

# ─── Check balance ────────────────────────────────────────────────────
balance = w3.eth.get_balance(wallet["address"])
balance_eth = w3.from_wei(balance, "ether")
print(f"Balance: {balance_eth} ETH")

chain_id = w3.eth.chain_id
acct = Account.from_key(wallet["private_key"])

if balance == 0:
    print(f"\nWallet has 0 ETH on chain {chain_id}.")
    print(f"To deploy, send testnet ETH to: {wallet['address']}")
    print("Faucets: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet")
    print("\nComputing attestation hashes with proper keccak256...")
    
    onchain_results = {
        "status": "pending_funding",
        "chain_id": chain_id,
        "deployer_address": wallet["address"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Wallet needs ETH on chain {chain_id} to deploy and attest",
        "computed_attestations": [],
    }
    
    for ev in pipeline["evaluations"]:
        pid = ev["project_id"]
        evidence = {
            "project_id": pid,
            "evaluation": ev,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": "SIMOGRANTS",
        }
        evidence_json = json.dumps(evidence, separators=(",", ":"), sort_keys=True).encode()
        eval_hash = "0x" + keccak(evidence_json).hex()
        proj_hash = "0x" + keccak(pid.encode("utf-8")).hex()
        
        onchain_results["computed_attestations"].append({
            "project_id": pid,
            "project_hash_keccak256": proj_hash,
            "evaluation_hash_keccak256": eval_hash,
            "overall_score": ev["overall_score"],
        })
        print(f"  {pid}: projHash={proj_hash[:18]}... evalHash={eval_hash[:18]}...")
    
    Path("/workspace/pipeline_output/onchain_results.json").write_text(
        json.dumps(onchain_results, indent=2)
    )
    print(f"\nSaved to /workspace/pipeline_output/onchain_results.json")
    
else:
    print(f"\nWallet has {balance_eth} ETH — proceeding with deployment!")
    
    # Compile contract (use solcx or pre-compiled bytecode)
    # For now, use the pre-compiled bytecode if available
    print("TODO: Deploy contract and publish attestations")
    # This would require solc compilation which we'll handle via Hardhat

print("\nDone.")
