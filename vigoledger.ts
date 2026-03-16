/**
 * VigoCert — Aptos Smart Contract Client
 * Interacts with trust_passport.move on Aptos Testnet
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputViewFunctionData,
} from "@aptos-labs/ts-sdk";
import type { EvidencePackage, CommodityType } from "./shelby";

// ─── Config ───────────────────────────────────────────────────────────────────

const NETWORK = Network.TESTNET; // ← MAINNET for production

const MODULE_ADDRESS = process.env.NEXT_PUBLIC_VIGOCERT_MODULE_ADDRESS ?? "";
const MODULE_NAME    = "trust_passport";

const aptos = new Aptos(new AptosConfig({ network: NETWORK }));

// ─── Commodity Enum Map ───────────────────────────────────────────────────────

const COMMODITY_MAP: Record<CommodityType, number> = {
  coffee:   1,
  rubber:   2,
  wood:     3,
  cocoa:    4,
  palm_oil: 5,
  soy:      6,
  cattle:   7,
};

// ─── Generate Passport ID ─────────────────────────────────────────────────────

export function generatePassportId(farmerId: string): string {
  const ts = Date.now();
  const short = farmerId.slice(0, 8).toUpperCase();
  return `VC-${ts}-${short}`;
}

// ─── GPS Encoding (float → u64 fixed point) ───────────────────────────────────

function encodeGPS(coord: number): bigint {
  return BigInt(Math.round(Math.abs(coord) * 1_000_000));
}

function encodeArea(ha: number): bigint {
  return BigInt(Math.round(ha * 100));
}

// ─── Initialize Exporter Registry ────────────────────────────────────────────

export async function initExporterRegistry(exporterPrivateKey: string) {
  const privateKey = new Ed25519PrivateKey(exporterPrivateKey);
  const account    = Account.fromPrivateKey({ privateKey });

  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::init_registry`,
      functionArguments: [],
    },
  });

  const pending = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  return aptos.waitForTransaction({ transactionHash: pending.hash });
}

// ─── Mint Trust Passport ──────────────────────────────────────────────────────

export interface MintPassportParams {
  exporterPrivateKey: string;
  passportId: string;
  farmerId: string;
  commodity: CommodityType;
  photoCid: string;
  packageCid: string;
  sha256: string;
  gps: { lat: number; lng: number };
  plotAreaHa: number;
}

export async function mintTrustPassport(params: MintPassportParams) {
  const {
    exporterPrivateKey, passportId, farmerId, commodity,
    photoCid, packageCid, sha256, gps, plotAreaHa,
  } = params;

  const privateKey = new Ed25519PrivateKey(exporterPrivateKey);
  const account    = Account.fromPrivateKey({ privateKey });

  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::mint_passport`,
      functionArguments: [
        passportId,
        farmerId,
        COMMODITY_MAP[commodity],
        photoCid,
        packageCid,
        sha256,
        encodeGPS(gps.lat).toString(),
        encodeGPS(gps.lng).toString(),
        encodeArea(plotAreaHa).toString(),
      ],
    },
  });

  const pending = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pending.hash,
  });

  return {
    txHash:     pending.hash,
    passportId,
    explorerUrl: `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`,
  };
}

// ─── Full Pipeline: Submit Evidence → Mint Passport ──────────────────────────

/**
 * The complete VigoCert pipeline after Shelby upload:
 *   submitFarmerEvidence (shelby.ts) → mintTrustPassportFromEvidence (here)
 */
export async function mintTrustPassportFromEvidence(
  exporterPrivateKey: string,
  evidence: {
    photoCid: string;
    packageCid: string;
    sha256: string;
    evidencePackage: EvidencePackage;
  }
) {
  const { photoCid, packageCid, sha256, evidencePackage } = evidence;

  const passportId = generatePassportId(evidencePackage.farmer_id);

  return mintTrustPassport({
    exporterPrivateKey,
    passportId,
    farmerId:    evidencePackage.farmer_id,
    commodity:   evidencePackage.commodity,
    photoCid,
    packageCid,
    sha256,
    gps:         { lat: evidencePackage.gps.lat, lng: evidencePackage.gps.lng },
    plotAreaHa:  evidencePackage.plot_area_ha ?? 0,
  });
}

// ─── View: Get Passport ───────────────────────────────────────────────────────

export interface TrustPassportRecord {
  passport_id:     string;
  photo_cid:       string;
  package_cid:     string;
  commodity:       CommodityType;
  sha256:          string;
  mainnet_anchor:  string;
  minted_at:       Date;
  status:          "pending" | "verified" | "revoked";
  explorer_url:    string;
}

const COMMODITY_REVERSE: Record<number, CommodityType> = {
  1: "coffee", 2: "rubber", 3: "wood",
  4: "cocoa",  5: "palm_oil", 6: "soy", 7: "cattle",
};

const STATUS_MAP: Record<number, "pending" | "verified" | "revoked"> = {
  0: "pending", 1: "verified", 2: "revoked",
};

export async function getPassport(
  exporterAddress: string,
  passportId:      string
): Promise<TrustPassportRecord> {
  const payload: InputViewFunctionData = {
    function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_passport`,
    functionArguments: [exporterAddress, passportId],
  };

  const [photoCid, packageCid, commodity, sha256, mainnetAnchor, mintedAt, status] =
    await aptos.view({ payload });

  return {
    passport_id:    passportId,
    photo_cid:      photoCid as string,
    package_cid:    packageCid as string,
    commodity:      COMMODITY_REVERSE[Number(commodity)],
    sha256:         sha256 as string,
    mainnet_anchor: mainnetAnchor as string,
    minted_at:      new Date(Number(mintedAt) / 1000),
    status:         STATUS_MAP[Number(status)],
    explorer_url:   `https://explorer.aptoslabs.com/account/${exporterAddress}?network=testnet`,
  };
}

// ─── Get All Passports for an Exporter ───────────────────────────────────────

export async function getExporterPassports(
  exporterAddress: string
): Promise<TrustPassportRecord[]> {
  const totalRes = await aptos.view({
    payload: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_total_minted`,
      functionArguments: [exporterAddress],
    },
  });

  // In production: use Aptos indexer GraphQL for efficient bulk queries
  // For now, fetch from on-chain events
  const events = await aptos.getAccountEventsByEventType({
    accountAddress: exporterAddress,
    eventType: `${MODULE_ADDRESS}::${MODULE_NAME}::MintEvent`,
    options: { limit: 100, orderByFields: [{ transaction_version: "desc" }] },
  });

  return events.map((e: any) => ({
    passport_id:    e.data.passport_id,
    photo_cid:      e.data.photo_cid,
    package_cid:    "",  // fetch individually if needed
    commodity:      COMMODITY_REVERSE[Number(e.data.commodity)],
    sha256:         "",
    mainnet_anchor: "pending",
    minted_at:      new Date(Number(e.data.minted_at) / 1000),
    status:         "pending" as const,
    explorer_url:   `https://explorer.aptoslabs.com/account/${exporterAddress}?network=testnet`,
  }));
}
