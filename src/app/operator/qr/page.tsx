"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import styles from "./page.module.css";

type DisplayData = { code: string; amount: number; url: string };
const qrDisplayStorageKey = "canfes-qr-display-state";

function parseDisplayData(value: unknown): DisplayData | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DisplayData>;
  if (typeof candidate.code !== "string" || typeof candidate.url !== "string") return null;
  return { code: candidate.code, url: candidate.url, amount: Number(candidate.amount) || 0 };
}

export default function OperatorQrDisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null);

  useEffect(() => {
    const applyMessage = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const message = value as { type?: string; data?: unknown };
      if (message.type === "clear") setData(null);
      if (message.type === "data") setData(parseDisplayData(message.data));
    };
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const url = params.get("url");
    if (code && url) setData({ code, url, amount: Number(params.get("amount")) || 0 });
    try {
      const stored = localStorage.getItem(qrDisplayStorageKey);
      if (stored) applyMessage(JSON.parse(stored));
    } catch { /* query parameters remain available if storage is blocked */ }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== qrDisplayStorageKey) return;
      if (!event.newValue) setData(null);
      else {
        try { applyMessage(JSON.parse(event.newValue)); } catch { /* ignore malformed storage */ }
      }
    };
    window.addEventListener("storage", handleStorage);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("canfes-qr-display");
    if (channel) channel.onmessage = (event) => applyMessage(event.data);
    document.title = "参加受付QR | 爆裂カジノ";
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  if (!data) {
    return <main className={styles.page}><div className={styles.empty}><span>QR</span><h1>表示するQRがありません</h1><p>運営パネルでQRを発行してから、この画面を開いてください。</p></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.displayShell}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.brandMark}>爆</span><div><strong>爆裂カジノ</strong><small>参加受付</small></div></div>
          <span className={styles.liveBadge}><span />受付中</span>
        </header>
        <section className={styles.content} aria-labelledby="qr-display-title">
          <p className={styles.eyebrow}>CANFES / CHECK-IN</p>
          <h1 id="qr-display-title">このQRを読み取って<br /><span>参加登録</span></h1>
          <p className={styles.lead}>スマートフォンのカメラで読み取ってください</p>
          <div className={styles.qrCard}><QRCodeCanvas value={data.url} size={420} includeMargin /></div>
          <div className={styles.meta}><span>初期CF</span><strong>{data.amount.toLocaleString()} CF</strong><code>{data.code}</code></div>
          <p className={styles.note}>QRを読み取ると、参加者用アカウントが作成されます。同じ端末からの登録は1回だけです。</p>
        </section>
        <footer className={styles.footer}>爆裂カジノ ・ キャンパスフェスティバル横浜キャンパス</footer>
      </div>
    </main>
  );
}
