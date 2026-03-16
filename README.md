# VigoCert x Shelby.xyz — Integration Guide

## Architecture Overview

```
FARMER (Mobile App)
  ↓ Photo + GPS   [FarmerTrustPassport.tsx]
EDGE AI VALIDATION (on-device)
  ↓ Validated photo
SHELBY.XYZ ──── Decentralized storage (photo + JSON evidence package)
  ↓ CID + URL
/api/mint-passport ──── Server-side route (private key never exposed)
  ↓ Signs transaction
APTOS TESTNET ──── trust_passport.move (Smart Contract)
  ↓ Daily bridge
VIGO LEDGER MAINNET ──── Sovereign Grade public proof
  ↑ Query
EU VERIFICATION PORTAL ──── [EUVerificationPortal.tsx]
```

---

## File Structure

```
vigocert/
├── lib/
│   ├── shelby.ts                   — Shelby upload / retrieve / SHA-256 integrity
│   └── vigoledger.ts               — Aptos smart contract client
├── contracts/
│   └── trust_passport.move         — Move smart contract (deploy to Aptos)
├── components/
│   ├── FarmerTrustPassport.tsx     — Mobile farmer UI
│   └── EUVerificationPortal.tsx    — EU auditor verification portal
├── app/
│   └── api/
│       └── mint-passport/
│           └── route.ts            — Server-side mint API route
└── .env.example                    — Environment variables template
```

---

## Setup

### Step 1 — Install dependencies

```bash
npm install @shelby-protocol/sdk @aptos-labs/ts-sdk
```

### Step 2 — Obtain a Shelby API key

1. Visit https://developers.shelby.xyz and register for early access.
2. Alternatively, use an Aptos Labs API key from https://developers.aptoslabs.com.

### Step 3 — Deploy the smart contract to Aptos Testnet

```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Initialize a testnet profile
aptos init --profile testnet --network testnet

# Deploy the contract
cd vigocert/contracts
aptos move publish \
  --profile testnet \
  --named-addresses vigocert=$(aptos account lookup-address --profile testnet)

# Copy the module address from the output
```

### Step 4 — Initialize the contract (run once)

```bash
# Initialize global config
aptos move run \
  --profile testnet \
  --function-id "YOUR_ADDRESS::trust_passport::initialize"

# Initialize the exporter registry
aptos move run \
  --profile testnet \
  --function-id "YOUR_ADDRESS::trust_passport::init_registry"
```

### Step 5 — Configure environment variables

```bash
cp .env.example .env.local
# Fill in the values in .env.local
```

### Step 6 — Wire up the Next.js pages

```tsx
// app/farmer/page.tsx
import FarmerTrustPassport from "@/components/FarmerTrustPassport";

export default function FarmerPage() {
  return <FarmerTrustPassport farmerId="FARMER_001" />;
}

// app/verify/page.tsx
import EUVerificationPortal from "@/components/EUVerificationPortal";

export default function VerifyPage() {
  return <EUVerificationPortal />;
}
```

---

## End-to-End Flow

### Farmer submits evidence
1. Farmer opens the app, selects commodity type, takes a photo.
2. GPS coordinates are captured automatically.
3. The client computes a SHA-256 hash of the photo (integrity anchor).
4. Photo is uploaded to **Shelby** → receives `photo_cid`.
5. JSON evidence package is uploaded to **Shelby** → receives `package_cid`.
6. Client calls `POST /api/mint-passport` (server-side route).
7. Server signs an Aptos transaction → calls `mint_passport()` on-chain.
8. Returns `passport_id` and `tx_hash` to the farmer.

### EU Auditor verifies
1. Auditor enters `passport_id` + `exporter_address` in the portal.
2. Portal calls `get_passport()` on the Aptos smart contract.
3. Retrieves `photo_cid` + `sha256` from the blockchain record.
4. Downloads the file from **Shelby** using the CID.
5. Computes SHA-256 of the downloaded file.
6. Compares against the on-chain hash → **PASS / FAIL**.
7. Displays full result: photo, GPS, EUDR article reference, blockchain status.

---

## Security Notes

| Item | Detail |
|---|---|
| `VIGOCERT_EXPORTER_PRIVATE_KEY` | Server-side only. Never prefixed with `NEXT_PUBLIC_`. |
| SHA-256 | Computed client-side before upload; anyone can independently verify. |
| Shelby CIDs | Content-addressed — the CID cryptographically commits to the file content. |
| Smart contract | Immutable after deployment on Aptos. |
| Testnet | Data may be reset. Switch `Network.TESTNET` → `Network.MAINNET` for production. |

---

## Testnet Resources

- **Aptos Explorer:** https://explorer.aptoslabs.com/?network=testnet
- **Shelby Gateway:** https://gateway.shelby.xyz
- **Aptos Faucet (APT for gas):** https://aptos.dev/network/faucet
- **Shelby Docs:** https://docs.shelby.xyz
