"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

export default function OperatorPaymentsPage() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/operator/login");
    });
  }, [router]);

  const qrBaseUrl = process.env.NEXT_PUBLIC_CANFES_APP_URL?.trim().replace(/\/+$/, "") || baseUrl;
  const purchaseUrl = qrBaseUrl ? `${qrBaseUrl}/dashboard/payment?mode=purchase` : "";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/operator"><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link>
          <Link className={styles.backLink} href="/operator">運営トップへ</Link>
        </header>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>CASHIER / PURCHASE</p>
          <h1>チップ購入QR</h1>
          <p>このQRを受付に掲示してください。参加者が読み取り、チップ数を入力して「支払う」を押します。</p>
        </section>
        <div className={styles.standList}>
          <article className={styles.standCard}>
            <div><span className={styles.kicker}>PURCHASE</span><h2>チップ購入</h2><p>参加者のCFが入力したチップ数分減ります。</p></div>
            <div className={styles.qrFrame}>{purchaseUrl ? <QRCodeCanvas value={purchaseUrl} size={260} includeMargin level="M" /> : <span>QRを準備しています…</span>}</div>
            <code className={styles.url}>{purchaseUrl}</code>
            <Link className={styles.screenLink} href="/operator/payments/refund">チップ払い戻し画面へ →</Link>
          </article>
        </div>
      </main>
    </div>
  );
}
