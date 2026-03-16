"use client";

/**
 * VigoCert — Trust Passport App (Farmer Mobile UI)
 * Mobile-first React component for harvest evidence submission.
 *
 * Aesthetic: Dark field-grade UI — rugged tablet app for use in the field.
 * High contrast, large touch targets, minimal cognitive load.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { submitFarmerEvidence, type CommodityType } from "@/lib/shelby";
import { mintTrustPassportFromEvidence, generatePassportId } from "@/lib/vigoledger";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "capture" | "details" | "uploading" | "success" | "error";

interface GPSCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

// ─── Commodities Config ───────────────────────────────────────────────────────

const COMMODITIES: { value: CommodityType; label: string; icon: string; color: string }[] = [
  { value: "coffee",   label: "Coffee",   icon: "☕", color: "#8B5E3C" },
  { value: "rubber",   label: "Rubber",   icon: "🌿", color: "#2E7D32" },
  { value: "wood",     label: "Wood",     icon: "🪵", color: "#5D4037" },
  { value: "cocoa",    label: "Cocoa",    icon: "🍫", color: "#6D4C41" },
  { value: "palm_oil", label: "Palm Oil", icon: "🌴", color: "#F9A825" },
  { value: "soy",      label: "Soy",      icon: "🫘", color: "#7CB342" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FarmerTrustPassport({
  farmerId = "FARMER_001",
  exporterPrivateKey = "",
}: {
  farmerId?: string;
  exporterPrivateKey?: string;
}) {
  const [step,        setStep]        = useState<Step>("capture");
  const [photoBlob,   setPhotoBlob]   = useState<Blob | null>(null);
  const [photoURL,    setPhotoURL]    = useState<string | null>(null);
  const [gps,         setGPS]         = useState<GPSCoords | null>(null);
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [commodity,   setCommodity]   = useState<CommodityType>("coffee");
  const [plotArea,    setPlotArea]    = useState("");
  const [notes,       setNotes]       = useState("");
  const [progress,    setProgress]    = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result,      setResult]      = useState<any>(null);
  const [error,       setError]       = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── GPS Fetch ──────────────────────────────────────────────────────────────

  const fetchGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGPS({ lat: 10.823099, lng: 106.629664, accuracy: 999 });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGPS({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsLoading(false);
      },
      () => {
        setGPS({ lat: 10.823099, lng: 106.629664, accuracy: 999 });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { fetchGPS(); }, [fetchGPS]);

  // ─── Photo Capture ──────────────────────────────────────────────────────────

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoURL(URL.createObjectURL(file));
    setPhotoBlob(file);
    setStep("details");
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!photoBlob || !gps) return;

    setStep("uploading");
    setProgress(0);
    setError(null);

    try {
      setProgressMsg("📡 Encrypting and uploading photo to Shelby...");
      setProgress(20);

      const evidence = await submitFarmerEvidence({
        photoBlob,
        farmerId,
        commodity,
        gps,
        plotAreaHa: parseFloat(plotArea) || 0,
        notes,
      });

      setProgress(60);
      setProgressMsg("⛓️ Writing to Vigo Ledger (blockchain)...");

      let txResult = null;
      if (exporterPrivateKey) {
        txResult = await mintTrustPassportFromEvidence(exporterPrivateKey, evidence);
      } else {
        // Demo mode: simulate blockchain TX
        await new Promise((r) => setTimeout(r, 1500));
        txResult = {
          txHash:      "0xDEMO_" + Math.random().toString(16).slice(2, 18).toUpperCase(),
          passportId:  generatePassportId(farmerId),
          explorerUrl: "#",
        };
      }

      setProgress(100);
      setProgressMsg("✅ Complete!");

      setResult({
        passportId:  txResult.passportId,
        photoCid:    evidence.photoCid,
        packageCid:  evidence.packageCid,
        sha256:      evidence.sha256,
        txHash:      txResult.txHash,
        explorerUrl: txResult.explorerUrl,
        commodity,
        gps,
      });

      setTimeout(() => setStep("success"), 500);
    } catch (err: any) {
      setError(err.message ?? "An error occurred. Please try again.");
      setStep("error");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🛡️</span>
          <div>
            <div style={styles.logoTitle}>VigoCert</div>
            <div style={styles.logoSub}>Trust Passport</div>
          </div>
        </div>
        <div style={styles.gpsChip}>
          {gpsLoading ? (
            <span style={{ color: "#F9A825" }}>⏳ GPS...</span>
          ) : gps ? (
            <span style={{ color: "#4CAF50" }}>
              📍 {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
            </span>
          ) : (
            <span style={{ color: "#f44336" }}>❌ No GPS</span>
          )}
        </div>
      </header>

      {/* Farmer ID Badge */}
      <div style={styles.farmerBadge}>
        <span style={{ opacity: 0.6, fontSize: 12 }}>FARMER ID</span>
        <span style={{ fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>
          {farmerId}
        </span>
      </div>

      {/* ── STEP: CAPTURE ─────────────────────────────────────────────────── */}
      {step === "capture" && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>📸 Capture Harvest Photo</div>
          <p style={styles.cardDesc}>
            Take a clear photo of the farm or harvested product. The image will be
            AI-verified and permanently stored on the blockchain.
          </p>

          <button
            style={styles.captureBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <span style={{ fontSize: 48 }}>📷</span>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>
              Take / Select Photo
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
              Camera or photo library
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handlePhotoCapture}
          />

          <div style={styles.sectionLabel}>COMMODITY TYPE</div>
          <div style={styles.commodityGrid}>
            {COMMODITIES.map((c) => (
              <button
                key={c.value}
                style={{
                  ...styles.commodityBtn,
                  borderColor:     commodity === c.value ? c.color : "rgba(255,255,255,0.1)",
                  backgroundColor: commodity === c.value ? c.color + "33" : "transparent",
                }}
                onClick={() => setCommodity(c.value)}
              >
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <span style={{ fontSize: 12, marginTop: 4 }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP: DETAILS ─────────────────────────────────────────────────── */}
      {step === "details" && photoURL && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>📋 Submission Details</div>

          <div style={styles.photoPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoURL} alt="harvest evidence" style={styles.photoImg} />
            <div style={styles.photoOverlay}>
              <span style={{ color: "#4CAF50", fontWeight: 700 }}>✓ Photo captured</span>
            </div>
          </div>

          {gps && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>📍 GPS</span>
              <span style={styles.infoValue}>
                {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                <span style={{ opacity: 0.5, fontSize: 11 }}> (±{Math.round(gps.accuracy)}m)</span>
              </span>
            </div>
          )}

          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>Plot area (hectares)</label>
            <input
              type="number"
              value={plotArea}
              onChange={(e) => setPlotArea(e.target.value)}
              placeholder="e.g. 2.5"
              style={styles.input}
              step="0.1"
              min="0"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="December harvest, good quality..."
              style={{ ...styles.input, height: 80, resize: "none" }}
            />
          </div>

          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>🌱 Commodity</span>
            <span style={styles.infoValue}>
              {COMMODITIES.find((c) => c.value === commodity)?.icon}{" "}
              {COMMODITIES.find((c) => c.value === commodity)?.label}
            </span>
          </div>

          <div style={styles.actionRow}>
            <button
              style={styles.secondaryBtn}
              onClick={() => { setPhotoURL(null); setPhotoBlob(null); setStep("capture"); }}
            >
              ← Retake
            </button>
            <button style={styles.primaryBtn} onClick={handleSubmit}>
              🔒 Create Trust Passport
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: UPLOADING ───────────────────────────────────────────────── */}
      {step === "uploading" && (
        <div style={styles.card}>
          <div style={styles.uploadingCenter}>
            <div style={styles.spinner} />
            <div style={styles.uploadingTitle}>Processing...</div>
            <div style={styles.uploadingMsg}>{progressMsg}</div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progress}%`,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>{progress}%</div>

            <div style={styles.stepList}>
              {[
                { label: "SHA-256 hash computed",             done: progress >= 20 },
                { label: "Uploaded to Shelby (decentralized)", done: progress >= 60 },
                { label: "Written to Vigo Ledger",             done: progress >= 80 },
                { label: "Blockchain confirmation",            done: progress >= 100 },
              ].map((s, i) => (
                <div key={i} style={styles.stepItem}>
                  <span style={{ color: s.done ? "#4CAF50" : "rgba(255,255,255,0.3)" }}>
                    {s.done ? "✓" : "○"}
                  </span>
                  <span style={{ opacity: s.done ? 1 : 0.4, marginLeft: 8 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: SUCCESS ─────────────────────────────────────────────────── */}
      {step === "success" && result && (
        <div style={styles.card}>
          <div style={styles.successIcon}>🛡️</div>
          <div style={{ ...styles.cardTitle, color: "#4CAF50", textAlign: "center" }}>
            Trust Passport Created!
          </div>

          <div style={styles.passportCard}>
            <div style={styles.passportHeader}>
              <span style={{ fontSize: 12, opacity: 0.6 }}>PASSPORT ID</span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
                {result.passportId}
              </span>
            </div>
            {[
              { label: "📦 Photo CID",   value: result.photoCid.slice(0, 20) + "..." },
              { label: "📄 Package CID", value: result.packageCid.slice(0, 20) + "..." },
              { label: "🔐 SHA-256",     value: result.sha256.slice(0, 16) + "..." },
              { label: "⛓️ TX Hash",    value: result.txHash.slice(0, 20) + "..." },
              { label: "📍 GPS",         value: `${result.gps.lat.toFixed(4)}, ${result.gps.lng.toFixed(4)}` },
            ].map((row, i) => (
              <div key={i} style={styles.passportRow}>
                <span style={styles.passportLabel}>{row.label}</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.8 }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <a href={result.explorerUrl} target="_blank" rel="noreferrer" style={styles.explorerLink}>
            🔍 View on Aptos Explorer →
          </a>

          <button
            style={{ ...styles.primaryBtn, width: "100%", marginTop: 16 }}
            onClick={() => {
              setStep("capture");
              setPhotoBlob(null);
              setPhotoURL(null);
              setResult(null);
              setNotes("");
              setPlotArea("");
            }}
          >
            + Create New Trust Passport
          </button>
        </div>
      )}

      {/* ── STEP: ERROR ───────────────────────────────────────────────────── */}
      {step === "error" && (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ color: "#f44336", fontSize: 18, fontWeight: 700, marginTop: 12 }}>
              An error occurred
            </div>
            <div style={{ opacity: 0.7, marginTop: 8, fontSize: 14 }}>{error}</div>
            <button style={{ ...styles.primaryBtn, marginTop: 24 }} onClick={() => setStep("details")}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#0A0F1A",
    color: "#FFFFFF",
    fontFamily: "'DM Sans', 'Noto Sans', sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 40,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#0D1525",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  },
  logo:      { display: "flex", alignItems: "center", gap: 10 },
  logoIcon:  { fontSize: 28 },
  logoTitle: { fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#FFFFFF" },
  logoSub:   { fontSize: 11, color: "#4CAF50", fontWeight: 600, letterSpacing: 1 },
  gpsChip: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  farmerBadge: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "12px",
    backgroundColor: "rgba(76, 175, 80, 0.08)",
    borderBottom: "1px solid rgba(76, 175, 80, 0.2)",
    gap: 2,
    fontSize: 14,
  },
  card: {
    margin: "16px",
    padding: "20px",
    backgroundColor: "#131C2E",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  cardTitle:   { fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#FFFFFF" },
  cardDesc:    { fontSize: 14, opacity: 0.6, lineHeight: 1.6, marginBottom: 20 },
  captureBtn: {
    width: "100%",
    padding: "36px 20px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "2px dashed rgba(76,175,80,0.4)",
    borderRadius: 16,
    color: "#FFFFFF",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    transition: "all 0.2s",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
    opacity: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  commodityGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  commodityBtn: {
    padding: "12px 8px",
    borderRadius: 12,
    border: "2px solid",
    backgroundColor: "transparent",
    color: "#FFFFFF",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    transition: "all 0.15s",
    fontSize: 12,
  },
  photoPreview: {
    position: "relative" as const,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  photoImg: { width: "100%", height: 200, objectFit: "cover" as const, display: "block" },
  photoOverlay: {
    position: "absolute" as const,
    bottom: 0, left: 0, right: 0,
    padding: "8px 12px",
    backgroundColor: "rgba(0,0,0,0.6)",
    fontSize: 12,
    backdropFilter: "blur(4px)",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 13,
  },
  infoLabel: { opacity: 0.6 },
  infoValue: { fontWeight: 600, textAlign: "right" as const, maxWidth: "60%" },
  fieldGroup:  { marginBottom: 14 },
  fieldLabel:  { fontSize: 12, opacity: 0.6, display: "block", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "12px 14px",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#FFFFFF",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  actionRow:   { display: "flex", gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1,
    padding: "14px 20px",
    backgroundColor: "#4CAF50",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  secondaryBtn: {
    padding: "14px 16px",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  uploadingCenter: { textAlign: "center" as const, padding: "20px 0" },
  spinner: {
    width: 48,
    height: 48,
    border: "4px solid rgba(255,255,255,0.1)",
    borderTop: "4px solid #4CAF50",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 20px",
  },
  uploadingTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  uploadingMsg:   { fontSize: 14, opacity: 0.7, marginBottom: 20, minHeight: 20 },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
    margin: "0 20px",
  },
  progressFill: { height: "100%", backgroundColor: "#4CAF50", borderRadius: 3 },
  stepList:    { marginTop: 24, textAlign: "left" as const },
  stepItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 0",
    fontSize: 13,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  successIcon:   { fontSize: 56, textAlign: "center" as const, marginBottom: 8 },
  passportCard: {
    backgroundColor: "rgba(76, 175, 80, 0.08)",
    border: "1px solid rgba(76, 175, 80, 0.3)",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  passportHeader: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: "1px solid rgba(76, 175, 80, 0.2)",
  },
  passportRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    fontSize: 12,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  passportLabel: { opacity: 0.6, fontSize: 12 },
  explorerLink: {
    display: "block",
    textAlign: "center" as const,
    marginTop: 16,
    color: "#4CAF50",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
};
