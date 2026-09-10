"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function GuestPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      router.replace(`/guest/scan?code=${encodeURIComponent(code)}`);
      return;
    }

    let active = true;
    fetch("/api/guest/account", { cache: "no-store" })
      .then((response) => {
        if (active && response.ok) router.replace("/dashboard");
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (checkingSession) {
    return <main className={styles.loadingPage} aria-busy="true">参加情報を確認しています…</main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.entryCard} aria-labelledby="guest-entry-title">
        <div className={styles.brandRow}>
          <span className={styles.brandMark} aria-hidden="true">爆</span>
          <span className={styles.brandName}>爆裂カジノ<small>キャンパスフェスティバル横浜キャンパス</small></span>
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>キャンパスフェスティバル横浜キャンパス</p>
          <h1 id="guest-entry-title">キャンフェスへ<br /><span>ようこそ</span></h1>
          <p className={styles.lead}>爆裂カジノに参加するためのQRコードをお持ちの方は、ここから参加登録を始められます。</p>
        </div>

        <div className={styles.entryForm}>
          <a className={styles.primaryButton} href="/guest/scan">QRコードで参加する</a>
          <p className={styles.helperText}>運営から受け取ったQRコードをご用意ください。</p>
        </div>

        <a className={styles.installLink} href="/guest/install">
          <span className={styles.installIcon} aria-hidden="true">＋</span>
          <span><strong>アプリとして使う</strong><small>ホーム画面に追加するとすぐ開けます</small></span>
          <span className={styles.installArrow} aria-hidden="true">→</span>
        </a>

        <p className={styles.privacyNote}>メールアドレス・パスワードは必要ありません</p>
        <a className={styles.operatorLink} href="/operator/login">運営の方はこちら</a>
      </section>
    </main>
  );
}
