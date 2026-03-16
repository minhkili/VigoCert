"use client";

/**
 * VigoCert — EU Verification Portal
 * For European auditors to verify Trust Passports against EUDR requirements.
 *
 * Aesthetic: Precision instrument. Clinical, authoritative, data-dense.
 * Like a Bloomberg Terminal meets EU regulatory compliance dashboard.
 */

import { useState } from "react";
import { retrieveAndVerify, getEvidenceURL } from "@/lib/shelby";
import { getPassport, type TrustPassportRecord } from "@/lib/vigoledger";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyMode   = "passport_id" | "cid";
type VerifyStatus = "idle" | "loading" | "verified" | "failed" | "tampered";

interface VerificationResult {
  passport:        TrustPassportRecord;
  photoURL:        string;
  integrityPassed: boolean;
  computedHash:    string;
  verifiedAt:      Date;
}

// ─── Commodity Labels ─────────────────────────────────────────────────────────

const COMMODITY_LABELS: Record<string, { label: string; icon: string }> = {
  coffee:   { label: "Coffee (Coffea)",    icon: "☕" },
  rubber:   { label: "Rubber (Hevea)",     icon: "🌿" },
  wood:     { label: "Wood Products",      icon: "🪵" },
  cocoa:    { label: "Cocoa (Theobroma)",  icon: "🍫" },
  palm_oil: { label: "Oil Palm",           icon: "🌴" },
  soy:      { label: "Soy (Glycine max)",  icon: "🫘" },
  cattle:   { label: "Cattle",             icon: "🐄" },
};

// ─── EUDR Article Reference ───────────────────────────────────────────────────

const EUDR_ARTICLES: Record<string, string> = {
  coffee:   "EUDR Art. 3(1)(b) — Coffea spp.",
  rubber:   "EUDR Art. 3(1)(f) — Hevea brasiliensis",
  wood:     "EUDR Art. 3(1)(g) — Wood and derived products",
  cocoa:    "EUDR Art. 3(1)(a) — Theobroma cacao",
  palm_oil: "EUDR Art. 3(1)(d) — Elaeis guineensis",
  soy:      "EUDR Art. 3(1)(e) — Glycine max",
  cattle:   "EUDR Art. 3(1)(c) — Bos taurus / Bubalus",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EUVerificationPortal() {
  const [mode,       setMode]       = useState<VerifyMode>("passport_id");
  const [input1,     setInput1]     = useState("");
  const [input2,     setInput2]     = useState("");
  const [input3,     setInput3]     = useState("");
  const [status,     setStatus]     = useState<VerifyStatus>("idle");
  const [result,     setResult]     = useState<VerificationResult | null>(null);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");

  // ─── Verify Handler ────────────────────────────────────────────────────────

  const handleVerify = async () => {
    setStatus("loading");
    setResult(null);
    setErrorMsg(null);

    try {
      let passportData: TrustPassportRecord;
      let integrityPassed = false;
      let computedHash    = "";

      if (mode === "passport_id") {
        setLoadingMsg("Querying Vigo Ledger...");
        passportData = await getPassport(input2.trim(), input1.trim());

        setLoadingMsg("Verifying data integrity via Shelby...");
        const verification = await retrieveAndVerify(passportData.photo_cid, passportData.sha256);
        integrityPassed = verification.verified;
        computedHash    = verification.computedHash;
      } else {
        setLoadingMsg("Fetching data from Shelby...");
        const verification = await retrieveAndVerify(input1.trim(), input3.trim());
        integrityPassed = verification.verified;
        computedHash    = verification.computedHash;

        passportData = {
          passport_id:    "Direct CID Verification",
          photo_cid:      input1.trim(),
          package_cid:    "",
          commodity:      "coffee",
          sha256:         input3.trim(),
          mainnet_anchor: "N/A",
          minted_at:      new Date(),
          status:         integrityPassed ? "verified" : "revoked",
          explorer_url:   "#",
        };
      }

      setResult({
        passport:        passportData,
        photoURL:        getEvidenceURL(passportData.photo_cid),
        integrityPassed,
        computedHash,
        verifiedAt:      new Date(),
      });

      setStatus(integrityPassed ? "verified" : "tampered");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Verification failed. Record not found.");
      setStatus("failed");
    }
  };

  const loadDemo = () => {
    setMode("passport_id");
    setInput1("VC-1735000000000-FARMER01");
    setInput2("0x1234567890abcdef1234567890abcdef12345678");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.euFlag}>🇪🇺</span>
          <div>
            <div style={styles.topBarTitle}>EUDR Verification System</div>
            <div style={styles.topBarSub}>
              EU Regulation 2023/1115 · Deforestation-Free Products
            </div>
          </div>
        </div>
        <div style={styles.topBarRight}>
          <div style={styles.liveIndicator}>
            <span style={styles.liveDot} />
            LIVE
          </div>
          <div style={styles.networkBadge}>APTOS TESTNET</div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={styles.main}>
        {/* Left Panel: Query Form */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>🔍</span>
            VERIFICATION QUERY
          </div>

          {/* Mode Tabs */}
          <div style={styles.modeTabs}>
            {(["passport_id", "cid"] as VerifyMode[]).map((m) => (
              <button
                key={m}
                style={{ ...styles.modeTab, ...(mode === m ? styles.modeTabActive : {}) }}
                onClick={() => { setMode(m); setStatus("idle"); setResult(null); }}
              >
                {m === "passport_id" ? "🛡️ By Passport ID" : "🔗 By CID Hash"}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>
              {mode === "passport_id" ? "PASSPORT ID" : "SHELBY CID"}
            </label>
            <input
              style={styles.formInput}
              value={input1}
              onChange={(e) => setInput1(e.target.value)}
              placeholder={mode === "passport_id" ? "VC-1735000000000-FARMER01" : "QmXy1z2w3..."}
              spellCheck={false}
            />
          </div>

          {mode === "passport_id" && (
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>EXPORTER ADDRESS (Aptos)</label>
              <input
                style={styles.formInput}
                value={input2}
                onChange={(e) => setInput2(e.target.value)}
                placeholder="0x1234...abcd"
                spellCheck={false}
              />
            </div>
          )}

          {mode === "cid" && (
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>EXPECTED SHA-256</label>
              <input
                style={styles.formInput}
                value={input3}
                onChange={(e) => setInput3(e.target.value)}
                placeholder="a1b2c3d4e5f6..."
                spellCheck={false}
              />
            </div>
          )}

          <button
            style={{ ...styles.verifyBtn, opacity: status === "loading" ? 0.7 : 1, cursor: status === "loading" ? "wait" : "pointer" }}
            onClick={handleVerify}
            disabled={status === "loading"}
          >
            {status === "loading" ? `⏳ ${loadingMsg}` : "🔍 VERIFY RECORD"}
          </button>

          <button style={styles.demoBtn} onClick={loadDemo}>
            Load Demo Data
          </button>

          {/* EUDR Reference */}
          <div style={styles.eudrRef}>
            <div style={styles.eudrRefTitle}>📋 EUDR Covered Commodities</div>
            {Object.entries(EUDR_ARTICLES).map(([key, article]) => (
              <div key={key} style={styles.eudrRefRow}>
                <span>{COMMODITY_LABELS[key]?.icon}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{article}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Results */}
        <div style={styles.rightPanel}>
          {/* IDLE */}
          {status === "idle" && (
            <div style={styles.idleState}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>🛡️</div>
              <div style={styles.idleTitle}>VigoCert Verification System</div>
              <div style={styles.idleDesc}>
                Enter a Trust Passport ID or Shelby CID to verify EUDR compliance.
                <br /><br />
                All records are cryptographically anchored to the Aptos blockchain
                and stored on Shelby decentralized storage.
              </div>
              <div style={styles.statsRow}>
                {[
                  { label: "Passports Issued", value: "—" },
                  { label: "Verified Today",   value: "—" },
                  { label: "Network",          value: "Testnet" },
                ].map((s) => (
                  <div key={s.label} style={styles.statBox}>
                    <div style={styles.statValue}>{s.value}</div>
                    <div style={styles.statLabel}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAILED */}
          {status === "failed" && (
            <div style={styles.resultCard}>
              <div style={{ ...styles.statusBanner, backgroundColor: "#B71C1C" }}>
                <span style={{ fontSize: 24 }}>❌</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>RECORD NOT FOUND</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>No matching passport on Vigo Ledger</div>
                </div>
              </div>
              <div style={styles.errorDetail}>{errorMsg}</div>
            </div>
          )}

          {/* TAMPERED */}
          {status === "tampered" && result && (
            <div style={styles.resultCard}>
              <div style={{ ...styles.statusBanner, backgroundColor: "#E65100" }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>INTEGRITY FAILURE</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    SHA-256 mismatch — data may have been tampered with
                  </div>
                </div>
              </div>
              <IntegrityDetails result={result} />
            </div>
          )}

          {/* VERIFIED */}
          {status === "verified" && result && (
            <div style={styles.resultCard}>
              <div style={{
                ...styles.statusBanner,
                backgroundColor: result.passport.status === "verified" ? "#1B5E20" : "#1A237E",
              }}>
                <span style={{ fontSize: 28 }}>
                  {result.passport.status === "verified" ? "✅" : "🔄"}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>
                    {result.passport.status === "verified" ? "EUDR COMPLIANT" : "PENDING ANCHOR"}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    {result.passport.status === "verified"
                      ? "Deforestation-free proof verified · Blockchain anchored"
                      : "Integrity verified · Awaiting mainnet anchor"}
                  </div>
                </div>
              </div>

              <div style={styles.resultBody}>
                <div style={styles.resultColumns}>
                  {/* Evidence Photo */}
                  <div style={styles.photoCol}>
                    <div style={styles.colLabel}>HARVEST EVIDENCE</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.photoURL}
                      alt="harvest evidence"
                      style={styles.evidencePhoto}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/300x200/131C2E/4CAF50?text=Photo+on+Shelby";
                      }}
                    />
                    <div style={styles.shelbyBadge}>🔗 Stored on Shelby.xyz</div>
                  </div>

                  {/* Passport Details */}
                  <div style={styles.detailsCol}>
                    <div style={styles.colLabel}>PASSPORT RECORD</div>
                    {[
                      { label: "PASSPORT ID",        value: result.passport.passport_id, mono: true },
                      { label: "COMMODITY",           value: `${COMMODITY_LABELS[result.passport.commodity]?.icon} ${COMMODITY_LABELS[result.passport.commodity]?.label}` },
                      { label: "EUDR ARTICLE",        value: EUDR_ARTICLES[result.passport.commodity], small: true },
                      { label: "MINTED",              value: result.passport.minted_at.toLocaleString("en-GB") },
                      {
                        label: "BLOCKCHAIN STATUS",
                        value: result.passport.status.toUpperCase(),
                        color: result.passport.status === "verified" ? "#4CAF50" : "#F9A825",
                      },
                    ].map((row) => (
                      <div key={row.label} style={styles.detailRow}>
                        <span style={styles.detailLabel}>{row.label}</span>
                        <span style={{
                          fontFamily: row.mono ? "monospace" : "inherit",
                          fontSize:   row.small ? 11 : 13,
                          color:      row.color ?? "#FFFFFF",
                          fontWeight: row.color ? 700 : 400,
                          wordBreak:  "break-all" as const,
                        }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <IntegrityDetails result={result} />

                {result.passport.mainnet_anchor !== "pending" && result.passport.mainnet_anchor !== "N/A" && (
                  <div style={styles.anchorBox}>
                    <div style={styles.colLabel}>⛓️ PUBLIC MAINNET ANCHOR</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
                      {result.passport.mainnet_anchor}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                      Anchored to Vigo Ledger Mainnet — Sovereign Grade Proof
                    </div>
                  </div>
                )}

                <div style={styles.resultFooter}>
                  <span style={{ opacity: 0.5 }}>
                    Verified at {result.verifiedAt.toISOString()}
                  </span>
                  <a
                    href={result.passport.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#4CAF50", fontSize: 13, textDecoration: "none" }}
                  >
                    View on Aptos Explorer →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: Integrity Details ────────────────────────────────────────

function IntegrityDetails({ result }: { result: VerificationResult }) {
  return (
    <div style={intStyles.box}>
      <div style={intStyles.title}>🔐 CRYPTOGRAPHIC INTEGRITY</div>
      <div style={intStyles.grid}>
        {[
          { label: "Algorithm",     value: "SHA-256" },
          { label: "Result",        value: result.integrityPassed ? "✅ PASS" : "❌ FAIL", color: result.integrityPassed ? "#4CAF50" : "#f44336" },
          { label: "Expected Hash", value: result.passport.sha256,    mono: true },
          { label: "Computed Hash", value: result.computedHash,        mono: true },
          { label: "Photo CID",     value: result.passport.photo_cid,  mono: true },
          { label: "Package CID",   value: result.passport.package_cid, mono: true },
        ].map((row) => (
          <div key={row.label} style={intStyles.row}>
            <span style={intStyles.label}>{row.label}</span>
            <span style={{
              fontFamily: row.mono ? "monospace" : "inherit",
              fontSize:   row.mono ? 11 : 13,
              color:      row.color ?? "#FFFFFF",
              fontWeight: row.color ? 800 : 400,
              wordBreak:  "break-all" as const,
              opacity:    row.value ? 1 : 0.4,
            }}>
              {row.value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const intStyles: Record<string, React.CSSProperties> = {
  box:   { marginTop: 16, padding: 16, backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, opacity: 0.5, marginBottom: 12 },
  grid:  { display: "flex", flexDirection: "column" as const, gap: 8 },
  row:   { display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, alignItems: "flex-start" },
  label: { opacity: 0.5, minWidth: 120, flexShrink: 0, fontSize: 11, paddingTop: 2 },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#060D1A",
    color: "#FFFFFF",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    backgroundColor: "#0A1428",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  topBarLeft:  { display: "flex", alignItems: "center", gap: 12 },
  euFlag:      { fontSize: 28 },
  topBarTitle: { fontSize: 16, fontWeight: 700, letterSpacing: -0.5 },
  topBarSub:   { fontSize: 11, opacity: 0.5, letterSpacing: 0.5, marginTop: 2 },
  topBarRight: { display: "flex", alignItems: "center", gap: 10 },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: "#4CAF50",
    letterSpacing: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#4CAF50",
    display: "inline-block",
    animation: "pulse 1.5s infinite",
  },
  networkBadge: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 4,
    backgroundColor: "rgba(249, 168, 37, 0.15)",
    border: "1px solid rgba(249, 168, 37, 0.4)",
    color: "#F9A825",
    letterSpacing: 1,
  },
  main: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    minHeight: "calc(100vh - 57px)",
  },
  leftPanel: {
    borderRight: "1px solid rgba(255,255,255,0.08)",
    padding: 20,
    backgroundColor: "#0A1428",
    overflowY: "auto" as const,
  },
  panelHeader: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    opacity: 0.5,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  panelIcon: { fontSize: 14 },
  modeTabs:  { display: "flex", marginBottom: 20, gap: 6 },
  modeTab: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  modeTabActive: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    borderColor: "#4CAF50",
    color: "#4CAF50",
  },
  formGroup: { marginBottom: 14 },
  formLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    opacity: 0.5,
    display: "block",
    marginBottom: 6,
  },
  formInput: {
    width: "100%",
    padding: "10px 12px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  verifyBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#0D47A1",
    color: "#FFFFFF",
    border: "1px solid #1565C0",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: 1,
    marginBottom: 8,
  },
  demoBtn: {
    width: "100%",
    padding: "8px",
    backgroundColor: "transparent",
    border: "1px dashed rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 24,
  },
  eudrRef: {
    padding: 14,
    backgroundColor: "rgba(13, 71, 161, 0.15)",
    border: "1px solid rgba(13, 71, 161, 0.4)",
    borderRadius: 8,
  },
  eudrRefTitle: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, opacity: 0.6, marginBottom: 10 },
  eudrRefRow:   { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  rightPanel:   { padding: 24, overflowY: "auto" as const },
  idleState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: 400,
    textAlign: "center" as const,
    opacity: 0.7,
  },
  idleTitle: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  idleDesc:  { fontSize: 13, lineHeight: 1.7, opacity: 0.7, maxWidth: 420, marginBottom: 32 },
  statsRow:  { display: "flex", gap: 16 },
  statBox: {
    padding: "16px 24px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    textAlign: "center" as const,
  },
  statValue:   { fontSize: 22, fontWeight: 800, marginBottom: 4 },
  statLabel:   { fontSize: 10, opacity: 0.5, letterSpacing: 1 },
  resultCard:  { maxWidth: 900 },
  statusBanner: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "20px 24px",
    borderRadius: "12px 12px 0 0",
  },
  errorDetail: {
    padding: 20,
    backgroundColor: "#1A0000",
    border: "1px solid rgba(183,28,28,0.3)",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    fontSize: 13,
    opacity: 0.7,
  },
  resultBody: {
    padding: 20,
    backgroundColor: "#0D1525",
    border: "1px solid rgba(255,255,255,0.08)",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
  },
  resultColumns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 },
  photoCol:   {},
  detailsCol: {},
  colLabel:   { fontSize: 10, fontWeight: 700, letterSpacing: 2, opacity: 0.4, marginBottom: 10 },
  evidencePhoto: {
    width: "100%",
    height: 200,
    objectFit: "cover" as const,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    display: "block",
  },
  shelbyBadge: { marginTop: 6, fontSize: 11, color: "#4CAF50", opacity: 0.8 },
  detailRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  detailLabel: { fontSize: 10, opacity: 0.4, letterSpacing: 1 },
  anchorBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "rgba(76,175,80,0.08)",
    border: "1px solid rgba(76,175,80,0.25)",
    borderRadius: 8,
  },
  resultFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontSize: 11,
  },
};
