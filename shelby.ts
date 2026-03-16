/**
 * VigoCert x Shelby.xyz Integration
 * Decentralized storage for Trust Passport evidence
 * Network: Testnet (switch to MAINNET for production)
 */

import { Network } from "@aptos-labs/ts-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShelbyUploadResult {
  cid: string;          // Content Identifier (immutable)
  url: string;          // Fast retrieval URL
  size: number;         // Bytes
  mimetype: string;
  timestamp: string;
}

export interface EvidencePackage {
  photo_cid: string;
  photo_url: string;
  sha256: string;
  farmer_id: string;
  commodity: CommodityType;
  gps: { lat: number; lng: number; accuracy: number };
  captured_at: string;
  plot_area_ha?: number;
  notes?: string;
}

export type CommodityType =
  | "coffee"
  | "rubber"
  | "wood"
  | "cocoa"
  | "palm_oil"
  | "soy"
  | "cattle";

// ─── Client Config ────────────────────────────────────────────────────────────

const SHELBY_CONFIG = {
  network: Network.TESTNET,  // ← Change to Network.MAINNET for production
  apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY ?? "",
  gateway: "https://gateway.shelby.xyz",
};

// ─── SHA-256 Utility ──────────────────────────────────────────────────────────

export async function computeSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Shelby Client (Browser) ──────────────────────────────────────────────────

let _client: any = null;

async function getShelbyClient() {
  if (_client) return _client;
  // Dynamic import to avoid SSR issues
  const { ShelbyClient } = await import("@shelby-protocol/sdk/browser");
  _client = new ShelbyClient(SHELBY_CONFIG);
  return _client;
}

// ─── Core Upload ──────────────────────────────────────────────────────────────

/**
 * Upload a farmer's evidence photo to Shelby decentralized storage.
 * Returns CID + URL for anchoring in Vigo Ledger.
 */
export async function uploadEvidencePhoto(
  blob: Blob,
  farmerId: string,
  commodity: CommodityType
): Promise<ShelbyUploadResult> {
  const client = await getShelbyClient();

  const filename = `vigocert_${commodity}_${farmerId}_${Date.now()}.jpg`;
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

  const result = await client.upload(file);

  return {
    cid: result.cid,
    url: result.url,
    size: blob.size,
    mimetype: file.type,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Upload the full Trust Passport JSON evidence package.
 * This becomes the immutable compliance record on Shelby.
 */
export async function uploadEvidencePackage(
  pkg: EvidencePackage
): Promise<ShelbyUploadResult> {
  const client = await getShelbyClient();

  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `trustpassport_${pkg.farmer_id}_${Date.now()}.json`;
  const file = new File([blob], filename, { type: "application/json" });

  const result = await client.upload(file);

  return {
    cid: result.cid,
    url: result.url,
    size: blob.size,
    mimetype: "application/json",
    timestamp: new Date().toISOString(),
  };
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieve and verify a file from Shelby by CID.
 * Returns the blob + integrity check result.
 */
export async function retrieveAndVerify(
  cid: string,
  expectedSHA256: string
): Promise<{ blob: Blob; verified: boolean; computedHash: string }> {
  const client = await getShelbyClient();

  const blob = await client.retrieve(cid);
  const computedHash = await computeSHA256(blob);
  const verified = computedHash === expectedSHA256;

  if (!verified) {
    console.warn(`[VigoCert] Integrity check FAILED for CID: ${cid}`);
  }

  return { blob, verified, computedHash };
}

/**
 * Quick URL for displaying evidence photos in the EU Verification Portal.
 * Uses Shelby's CDN gateway for fast retrieval.
 */
export function getEvidenceURL(cid: string): string {
  return `${SHELBY_CONFIG.gateway}/ipfs/${cid}`;
}

// ─── Full Pipeline: Farmer Evidence Submission ────────────────────────────────

/**
 * Complete evidence submission pipeline for a farmer harvest event.
 *
 * Flow:
 *   1. Compute SHA-256 of photo (integrity anchor)
 *   2. Upload photo to Shelby → get photo_cid
 *   3. Build evidence package JSON
 *   4. Upload evidence package to Shelby → get package_cid
 *   5. Return both CIDs for smart contract anchoring
 */
export async function submitFarmerEvidence(params: {
  photoBlob: Blob;
  farmerId: string;
  commodity: CommodityType;
  gps: { lat: number; lng: number; accuracy: number };
  plotAreaHa?: number;
  notes?: string;
}): Promise<{
  photoCid: string;
  packageCid: string;
  sha256: string;
  evidencePackage: EvidencePackage;
}> {
  const { photoBlob, farmerId, commodity, gps, plotAreaHa, notes } = params;

  // Step 1: Hash the photo
  const sha256 = await computeSHA256(photoBlob);

  // Step 2: Upload photo
  const photoUpload = await uploadEvidencePhoto(photoBlob, farmerId, commodity);

  // Step 3: Build evidence package
  const evidencePackage: EvidencePackage = {
    photo_cid: photoUpload.cid,
    photo_url: photoUpload.url,
    sha256,
    farmer_id: farmerId,
    commodity,
    gps,
    captured_at: new Date().toISOString(),
    plot_area_ha: plotAreaHa,
    notes,
  };

  // Step 4: Upload package JSON
  const packageUpload = await uploadEvidencePackage(evidencePackage);

  return {
    photoCid: photoUpload.cid,
    packageCid: packageUpload.cid,
    sha256,
    evidencePackage,
  };
}
