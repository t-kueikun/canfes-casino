"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

type RefundQr = { qr_url: string; amount: number; expires_in_seconds: number };

export default function OperatorPaymentsPage() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("");
  const [refundAmount, setRefundAmount] = useState(100);
  const [refundQr, setRefundQr] = useState<RefundQr | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/operator/login");
    });
  }, [router]);

  const qrBaseUrl = process.env.NEXT_PUBLIC_CANFES_APP_URL?.trim().replace(/\/+$/, "") || baseUrl;
  const purchaseUrl = qrBaseUrl ? `${qrBaseUrl}/dashboard/payment?mode=purchase` : "";

  const issueRefundQr = async () => {
    const amount = Math.floor(refundAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      setError("払い戻すチップ数は1〜100,000 CFの整数で入力してください。");
      return;
    }
    setRefundLoading(true);
    setError("");
    try {
      const session = await getSupabaseClient().auth.getSession();
      const accessToken = session.data.session?.access_token;
      const response = await fetch("/api/operator/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ amount }),
      });
      if (response.status === 401) { router.replace("/operator/login"); return; }
      const body = await response.json().catch(() => ({})) as RefundQr & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "払い戻しQRを発行できませんでした。");
      setRefundQr(body);
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "払い戻しQRを発行できませんでした。");
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/operator"><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link>
          <Link className={styles.backLink} href="/operator">運営トップへ</Link>
        </header>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>CASHIER / QR STANDS</p>
          <h1>チップ取引</h1>
          <p>購入は参加者が受付QRを読み取り、払い戻しは運営がチップ数を入力してQRを発行します。</p>
        </section>
        <div className={styles.standList}>
          <article className={styles.standCard}>
            <div><span className={styles.kicker}>PURCHASE</span><h2>チップ購入</h2><p>このQRを掲示してください。参加者のCFが入力したチップ数分減ります。</p></div>
            <div className={styles.qrFrame}>{purchaseUrl ? <QRCodeCanvas value={purchaseUrl} size={240} includeMargin level="M" /> : <span>QRを準備しています…</span>}</div>
            <code className={styles.url}>{purchaseUrl}</code>
          </article>
          <article className={styles.standCard}>
            <div><span className={styles.kicker}>REFUND</span><h2>チップ払い戻し</h2><p>チップ数を入力してQRを発行し、参加者に読み取ってもらいます。</p></div>
            <label className={styles.amountLabel} htmlFor="refund-amount">払い戻すチップ数<span>CF</span></label>
            <div className={styles.amountInput}><input id="refund-amount" type="number" min={1} max={100000} step={1} inputMode="numeric" value={refundAmount} onChange={(event) => setRefundAmount(Number(event.target.value))} /><span>CF</span></div>
            <button className={styles.primaryButton} type="button" onClick={() => void issueRefundQr()} disabled={refundLoading}>{refundLoading ? "発行中…" : "払い戻しQRを発行"}</button>
            {refundQr ? <div className={styles.refundResult}><div className={styles.qrFrame}><QRCodeCanvas value={refundQr.qr_url} size={240} includeMargin level="M" /></div><strong>{refundQr.amount.toLocaleString()} CF</strong><p>このQRを参加者に読み取ってもらってください。10分間有効です。</p></div> : <div className={styles.refundPlaceholder}>ここに発行したQRを表示します。</div>}
          </article>
        </div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <p className={styles.notice}>購入は参加者のCFが減り、払い戻しQRを読み取ると参加者のCFが増えます。現金の受け渡し方法は会場の案内に従ってください。</p>
      </main>
    </div>
  );
}
