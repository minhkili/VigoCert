/**
 * VigoCert — Server-Side Mint API Route
 * POST /api/mint-passport
 *
 * Keeps the exporter private key server-side only — never exposed to the browser.
 * Called by the client after Shelby upload completes successfully.
 */

import { NextRequest, NextResponse } from "next/server";
import { mintTrustPassportFromEvidence } from "@/lib/vigoledger";
import type { EvidencePackage } from "@/lib/shelby";

interface MintRequest {
  photoCid:        string;
  packageCid:      string;
  sha256:          string;
  evidencePackage: EvidencePackage;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MintRequest;
    const { photoCid, packageCid, sha256, evidencePackage } = body;

    // Validate required fields
    if (!photoCid || !packageCid || !sha256 || !evidencePackage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Private key lives server-side only — never exposed to the client
    const exporterPrivateKey = process.env.VIGOCERT_EXPORTER_PRIVATE_KEY;
    if (!exporterPrivateKey) {
      return NextResponse.json(
        { error: "Exporter private key not configured" },
        { status: 500 }
      );
    }

    const result = await mintTrustPassportFromEvidence(exporterPrivateKey, {
      photoCid,
      packageCid,
      sha256,
      evidencePackage,
    });

    return NextResponse.json({
      success:     true,
      passportId:  result.passportId,
      txHash:      result.txHash,
      explorerUrl: result.explorerUrl,
    });

  } catch (err: any) {
    console.error("[VigoCert API] Mint failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
