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

  const qrBaseUrl = (process.env.NEXT_PUBLIC_CANFES_APP_URL?.trim().replace(/\/+$/, "") || baseUrl);
  const purchaseUrl = qrBaseUrl ? `${qrBaseUrl}/dashboard/payment?mode=purchase` : "";
  const refundUrl = qrBaseUrl ? `${qrBaseUrl}/dashboard/payment?mode=refund` : "";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/operator"><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link>
          <Link className={styles.backLink} href="/operator">運営トップへ</Link>
        </header>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>CASHIER / QR STANDS</p>
          <h1>お客様が読み取るQR</h1>
          <p>この画面を受付に掲示してください。QRを読み取ると、チップ購入または払い戻しの金額入力画面が開きます。</p>
        </section>
        <div className={styles.standList}>
          <article className={styles.standCard}>
            <div><span className={styles.kicker}>PURCHASE</span><h2>チップ購入</h2><p>お客様が購入CF数を入力して「支払う」を押すと、購入が完了します。</p></div>
            <div className={styles.qrFrame}>{purchaseUrl ? <QRCodeCanvas value={purchaseUrl} size={240} includeMargin level="M" /> : <span>QRを準備しています…</span>}</div>
            <code className={styles.url}>{purchaseUrl}</code>
          </article>
          <article className={styles.standCard}>
            <div><span className={styles.kicker}>REFUND</span><h2>チップ払い戻し</h2><p>お客様が払い戻すCF数を入力して「支払う」を押すと、払い戻しが完了します。</p></div>
            <div className={styles.qrFrame}>{refundUrl ? <QRCodeCanvas value={refundUrl} size={240} includeMargin level="M" /> : <span>QRを準備しています…</span>}</div>
            <code className={styles.url}>{refundUrl}</code>
          </article>
        </div>
        <p className={styles.notice}>現金の受け渡し方法と払い戻し金額の換算は会場の案内に従ってください。</p>
      </main>
    </div>
  );
}
