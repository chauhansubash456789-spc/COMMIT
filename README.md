# ⚡ COMMIT PROTOCOL
> **Put money behind your promise.**
> *A Solana-native financial commitment & verification protocol with Blinks, No-Loss Staking, and Decentralized Attestations.*

---

## 🏆 Colosseum Hackathon Strategy: From 6.4 to 10/10

Traditional commitment apps (StickK, Beeminder) fail because **humans hate losing money** (high churn) and domestic physical verifications are operationally impossible ($1 task travel).

**Commit Protocol solves this with 4 unfair advantages:**

1. **🛡️ Dual Staking (Hardcore + No-Loss Yield Vaults):**
   - **Hardcore Mode:** Direct USDC principal locked in Solana Escrow PDA.
   - **No-Loss Mode:** USDC principal is deposited into a Kamino/MarginFi lending vault and is **100% safe**. On failure, **only the accrued yield** is forfeited to the verifier/pool. No more fear of losing principal!
2. **👥 Decentralized Remote Peer Consensus (Replacing the in-person maid trap):**
   - Proof photos/videos must feature the live, dynamic **Solana Blockhash Challenge** (`SOL-7Z8z9x`), making pre-recorded evidence impossible.
   - 3 staked community verifiers review the proof; 2-of-3 consensus triggers automatic Ed25519 attestation & payout.
3. **🔗 Solana Blinks (Actions) Native Integration:**
   - Commitments can be unfurled and funded directly inside **X (Twitter)** or **Telegram** feeds with 1-click Dialect actions (`/api/actions/commit`).
4. **🏛️ Cryptographic Trust & Settlement:**
   - Off-chain evidence is SHA-256 hashed.
   - Oracle / Peer multisig signs canonical attestations with an authorized **Ed25519** keypair.
   - Solana Anchor smart contract verifies the Ed25519 signature on-chain before executing USDC escrow release.

---

## 📁 Repository Structure

```
D:\Hackthon\
├── programs/
│   └── commit-protocol/
│       ├── Cargo.toml            # Anchor dependencies
│       └── src/
│           └── lib.rs            # Production Anchor Rust smart contract
├── server/
│   ├── index.js                  # Express API & Devnet orchestration
│   ├── oracle/
│   │   └── attestation.js        # Ed25519 signing & SHA-256 evidence hashing
│   ├── verifiers/
│   │   ├── githubVerifier.js     # Real GitHub commit/SHA verifier
│   │   ├── studyTimerVerifier.js # Deep Work timer with rotating nonces
│   │   └── peerConsensusVerifier.js # Blockhash challenge & 2/3 peer voting
│   ├── solana/
│   │   └── escrowClient.js       # Solana Devnet PDA escrow & Explorer links
│   └── blinks/
│       └── actions.js            # Solana Actions & Blinks specification
├── public/
│   ├── index.html                # Web3 DApp Studio & Dashboards
│   ├── css/
│   │   └── style.css             # Solana Dark Obsidian / Emerald / Purple design
│   └── js/
│       └── app.js                # Wallet simulator, live heartbeats & settlements
├── tests/
│   └── runner.js                 # 12/12 passing integration tests
├── package.json
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Run the Test Suite
```bash
node tests/runner.js
```
Runs 12 comprehensive integration tests validating Ed25519 cryptographic signatures, anti-replay nonce rotation, GitHub commit filtering, peer consensus thresholds, and Solana Actions compliance.

### 2. Start the Protocol Node & Web DApp
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to interact with the full studio:
- **Dashboard & Feed:** Track active commitments, stakes, and consequences.
- **Create Commitment Wizard:** 4-step flow with visual consequence calculator.
- **Deep Work Focus Studio:** Live focus session with real rotating cryptographic nonces and server heartbeats.
- **GitHub Verifier Studio:** Connect repo, inspect qualifying SHAs, and attest.
- **Peer Verifier Portal:** Review proofs stamped with dynamic Solana Blockhash codes, vote, and claim verifier rewards.
- **Solana Blinks Simulator:** Interactive Twitter/Dialect action embed preview.
- **1-Click Hackathon Demos:** Run deterministic scenarios for judges with live Solana Explorer settlement links.

---

## 🏛️ Smart Contract Architecture (Anchor)

The Anchor program (`programs/commit-protocol/src/lib.rs`) enforces strict immutable rules once funded:

```rust
// Instructions:
create_commitment()       // Initializes PDA with immutable parameters
fund_commitment()         // Locks USDC into PDA escrow vault
submit_verification()     // Posts signed attestation and SHA-256 evidence hash
settle_commitment()       // Releases funds to user or failure destination
open_dispute()            // Challenge window for contesting outcomes
```

### State Machine
$$\text{Created} \longrightarrow \text{Funded} \longrightarrow \text{Active} \longrightarrow \text{PendingVerification} \longrightarrow \text{Verified} \longrightarrow \text{Settled}$$

---

## 🎬 3-Minute Hackathon Demo Script

1. **Scene 1 (0:00 - 0:45) — The Problem & Solution:** Show the Dashboard. Explain why Web2 habit apps fail (churn) and introduce Commit's dual-mode staking (Hardcore + No-Loss Kamino Vaults).
2. **Scene 2 (0:45 - 1:30) — Solana Blinks:** Unfurl a commitment inside the Twitter card simulator. Show 1-click funding via Solana Actions.
3. **Scene 3 (1:30 - 2:15) — Pluggable Verification:** 
   - Demonstrate the **Deep Work Focus Studio** with live rotating cryptographic nonces.
   - Demonstrate **Remote Peer Consensus** with the dynamic Solana Blockhash challenge (`SOL-7Z8z9x`).
4. **Scene 4 (2:15 - 3:00) — On-Chain Settlement:** Settle on Solana Devnet. Show the Explorer modal containing the verified Ed25519 Oracle signature, SHA-256 evidence hash, and recipient payout!
