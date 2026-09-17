"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "./page.module.css";

type QrReader = {
  start: (camera: { facingMode: string }, config: { fps: number; qrbox: { width: number; height: number }; aspectRatio?: number }, onSuccess: (text: string) => void, onError: (error: string) => void) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  scanFile: (file: File, showImage: boolean) => Promise<string>;
};

async function stopReaderIfActive(reader: QrReader | null, cameraActiveRef: { current: boolean }) {
  if (!reader || !cameraActiveRef.current) return;
  // Clear the flag before awaiting stop so route cleanup cannot stop twice.
  cameraActiveRef.current = false;
  await reader.stop().catch(() => undefined);
}

export default function DashboardScanPage() {
  const router = useRouter();
  const readerRef = useRef<QrReader | null>(null);
  const cameraActiveRef = useRef(false);
  const startTaskRef = useRef<Promise<void> | null>(null);
  const disposedRef = useRef(false);
  const handledRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const { Html5Qrcode } = require("html5-qrcode") as { Html5Qrcode: new (elementId: string, verbose?: boolean) => QrReader };
    const reader = new Html5Qrcode("canfes-payment-qr-reader", false);
    if (cancelled) return;
    disposedRef.current = false;
    readerRef.current = reader;
    setReady(true);
    return () => {
      cancelled = true;
      disposedRef.current = true;
      const startTask = startTaskRef.current;
      readerRef.current = null;
      void (async () => {
        await startTask?.catch(() => undefined);
        await stopReaderIfActive(reader, cameraActiveRef);
        try { reader.clear(); } catch { /* reader already cleared */ }
      })();
    };
  }, []);

  const acceptQr = async (raw: string) => {
    if (handledRef.current) return;
    let target = "";
    try {
      const url = new URL(raw.trim(), window.location.origin);
      // QR can be displayed on a different host (for example production QR
      // scanned from a local preview). Only the route and mode matter here;
      // always open the payment page on the host currently running the app.
      if (url.pathname.replace(/\/$/, "") === "/dashboard/payment") {
        const mode = url.searchParams.get("mode");
        if (mode === "purchase" || mode === "refund") target = `/dashboard/payment?mode=${mode}`;
      }
    } catch { /* invalid QR content */ }
    if (!target) {
      setError("購入または払い戻し用の受付QRを読み取ってください。");
      return;
    }
    handledRef.current = true;
    setError("");
    await stopReaderIfActive(readerRef.current, cameraActiveRef);
    router.push(target);
  };

  const startCamera = async () => {
    const reader = readerRef.current;
    if (!reader || cameraState !== "idle") return;
    setError("");
    setCameraState("starting");
    const startTask = (async () => {
      try {
        await reader.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 }, (text) => void acceptQr(text), () => undefined);
        cameraActiveRef.current = true;
        if (disposedRef.current) {
          await stopReaderIfActive(reader, cameraActiveRef);
          return;
        }
        setCameraState("active");
      } catch {
        if (!disposedRef.current) {
          setCameraState("idle");
          setError("カメラを起動できませんでした。ブラウザでカメラの使用を許可してください。");
        }
      }
    })();
    startTaskRef.current = startTask;
    await startTask;
    if (startTaskRef.current === startTask) startTaskRef.current = null;
  };

  const stopCamera = async () => {
    await stopReaderIfActive(readerRef.current, cameraActiveRef);
    setCameraState("idle");
  };

  const scanImage = async (file: File) => {
    setError("");
    try {
      const text = await readerRef.current?.scanFile(file, true);
      if (text) await acceptQr(text);
    } catch {
      setError("QRを読み取れませんでした。画像を確認して、もう一度お試しください。");
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}><Link href="/dashboard" className={styles.back}>← ホーム</Link><span>参加者 / スキャン</span></header>
      <section className={styles.card}>
        <p className={styles.eyebrow}>CHIP SERVICE</p>
        <h1>受付QRを<br /><span>スキャン</span></h1>
        <p className={styles.copy}>スタッフの購入または払い戻しQRを読み取ると、金額入力画面に進みます。</p>
        <div id="canfes-payment-qr-reader" className={styles.reader} aria-label="受付QRコード読み取り画面" />
        {cameraState === "active" ? <button className={styles.secondaryButton} type="button" onClick={() => void stopCamera()}>カメラを停止</button> : <button className={styles.primaryButton} type="button" disabled={!ready || cameraState === "starting"} onClick={() => void startCamera()}>{cameraState === "starting" ? "カメラを起動しています…" : ready ? "カメラを起動する" : "読み取り画面を準備中…"}</button>}
        <label className={styles.imageButton}>QR画像から読み取る<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanImage(file); event.currentTarget.value = ""; }} /></label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <p className={styles.note}>iPhoneの標準カメラで受付QRを読み取っても同じ画面を開けます。</p>
      </section>
      <div className={styles.nav}><BottomNavigationBar /></div>
    </main>
  );
}
