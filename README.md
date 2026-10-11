# ⚡ COMMIT PROTOCOL
> **Put money behind your promise.**
> *A Solana-native financial commitment & verification protocol with Blinks, No-Loss Staking, Connect Wallet Authentication, and Decentralized Attestations.*

---

## 🏆 Core Architecture: Solana Connect Wallet & Verification Engine

Traditional commitment apps (StickK, Beeminder) fail because **humans hate losing money** (high churn) and domestic physical verifications are operationally impossible ($1 task travel).

**Commit Protocol solves this with 4 unfair advantages:**

1. **🛡️ Dual Staking (Hardcore + No-Loss Yield Vaults):**
   - **Hardcore Mode:** Direct USDC principal locked in Solana Escrow PDA.
   - **No-Loss Mode:** USDC principal is deposited into a Kamino/MarginFi lending vault and is **100% safe**. On failure, **only the accrued yield** is forfeited to the verifier/pool. No more fear of losing principal!
2. **🔑 Pure Solana Connect Wallet Authentication (SIWS-Standard):**
   - **Primary Authentication:** Users sign in directly via Phantom, Solflare, or Standard Solana Wallet Adapters.
   - **Cryptographic Challenge & Single-Use Nonce:** The backend generates an authoritative single-use 32-byte hex challenge nonce bound to domain, timestamp, and wallet address.
   - **Ed25519 Signature Verification:** The backend verifies 64-byte Ed25519 signatures server-side via `tweetnacl`.
   - **Database & RLS Integrity:** Transparently maps verified wallet addresses to PostgreSQL profiles (`user_profiles.wallet_address`) and issues authentic Supabase session JWTs without weakening Row Level Security.
   - **Legacy Auth Retired:** Traditional email/password routes return `HTTP 410 Gone` (`WALLET_AUTH_REQUIRED`).
3. **👥 Decentralized Remote Peer Consensus:**
   - Proof photos/videos must feature the live, dynamic **Solana Blockhash Challenge** (`SOL-7Z8z9x`), making pre-recorded evidence impossible.
   - 3 staked community verifiers review the proof; 2-of-3 consensus triggers automatic Ed25519 attestation & payout.
4. **🔗 Solana Blinks (Actions) & On-Chain Escrow:**
   - Commitments can be unfurled and funded directly inside **X (Twitter)** or **Telegram** feeds with 1-click Dialect actions (`/api/actions/commit`).
   - Off-chain evidence is SHA-256 hashed and Oracle-signed with Ed25519 keys before Solana Anchor settlement.

---

## 📁 Repository Structure

```
D:\Hackthon\
├── programs/
│   └── commit-protocol/
│       ├── Cargo.toml               # Anchor dependencies
│       └── src/
│           └── lib.rs               # Production Anchor Rust smart contract
├── server/
│   ├── index.js                     # Express API & Devnet orchestration
│   ├── auth/
│   │   ├── walletAuth.js            # SIWS challenge generation & Ed25519 signature auth
│   │   ├── routes.js                # Wallet auth endpoints & 410 retired routes
│   │   ├── middleware.js            # Bearer JWT session validation & RBAC gates
│   │   └── supabase.js              # Authoritative Supabase admin/anon clients
│   ├── oracle/
│   │   └── attestation.js           # Ed25519 signing & SHA-256 evidence hashing
│   ├── verifiers/
│   │   ├── githubVerifier.js        # Real GitHub commit/SHA verifier
│   │   ├── studyTimerVerifier.js    # Deep Work timer with rotating nonces
│   │   └── peerConsensusVerifier.js # Blockhash challenge & 2/3 peer voting
│   ├── solana/
│   │   └── escrowClient.js          # Solana Devnet PDA escrow & Explorer links
│   └── blinks/
│       └── actions.js               # Solana Actions & Blinks specification
├── public/
│   ├── index.html                   # Web3 DApp Studio & Dashboards
│   ├── components/                  # Modular UI components (header, modal-auth, etc.)
│   ├── css/
│   │   └── style.css                # Solana Dark Obsidian / Emerald / Purple design system
│   └── js/
│       ├── app.js                   # Connect Wallet orchestration, SIWS signing & UI logic
│       └── nacl-fast.min.js         # Browser Ed25519 cryptographic signing engine
├── tests/
│   ├── master_test_runner.js        # Master runner executing all 5 suites (130/130 pass)
│   ├── auth_tests.js                # Wallet challenge, Ed25519 auth, replay & 410 tests
│   ├── attack_tests.js              # 22 brutal adversarial attack tests (22/22 defended)
│   ├── user_dashboard_test.js       # User metrics, IDOR defense & notifications
│   ├── e2e_full_test.js             # Complete 10-step user commitment lifecycle
│   ├── verifier_system_test.js      # Authoritative verifier lifecycle & checklist gates
│   └── runner.js                    # Protocol engine unit test runner
├── package.json
└── README.md
```

---

## 🚀 Quickstart & Testing

### 1. Run the Test Suites
```bash
# 1. Start the backend node:
npm start

# 2. In a separate terminal, run all 5 master test suites:
node tests/master_test_runner.js

# 3. Run the adversarial attack battery:
node tests/attack_tests.js
```

All 5 master suites (130/130 tests) and all 14 adversarial attack suites (22/22 defenses) run with 100% pass rate against the live backend and database.

### 2. Start the Protocol Node & Web DApp
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
- **Connect Wallet:** Click "Connect Wallet" in the header. Choose **Phantom**, **Solflare**, or use the **1-Click Devnet Evaluator** buttons (Alice, Bob, Charlie) to test cryptographic signing directly without browser extensions!
- **Dashboard & Feed:** Track active commitments, stakes, and consequences.
- **Create Commitment Wizard:** 4-step creation flow requiring connected wallet.
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

## 🔐 Security & Anti-Fraud Architecture

- **Single-Use Challenge Nonce:** 32-byte cryptographic random hex with 5-minute expiry and atomic consumption in PostgreSQL (`wallet_auth_nonces`).
- **Ed25519 Cryptographic Verification:** All signatures verified independently via `tweetnacl` server-side before session JWT creation.
- **Anti-IDOR Protection:** All commitment operations verify `auth.uid()` against commitment creator wallet.
- **Strict Role Boundaries:** Normal users cannot escalate to `VERIFIER` or `ADMIN` roles; admin privileges require direct service-role elevation and entry in `admin_users`.
- **Settlement Idempotency:** Double settlement and reward diversion strictly rejected. Active disputes immediately freeze normal settlement.
