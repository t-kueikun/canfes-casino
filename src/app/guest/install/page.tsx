"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPage() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [afterSignup, setAfterSignup] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setAfterSignup(new URLSearchParams(window.location.search).get("afterSignup") === "1");

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", () => setIsInstalled(true), { once: true });
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "accepted") setMessage("ホーム画面への追加が完了しました");
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="install-title">
        <Link className={styles.backLink} href="/guest">← 参加者入口へ戻る</Link>
        <div className={styles.brandRow}><span className={styles.brandMark}>爆</span><div><strong>爆裂カジノ</strong><small>キャンパスフェスティバル横浜キャンパス</small></div></div>

        <div className={styles.hero}>
          <span className={styles.icon} aria-hidden="true">＋</span>
          <p className={styles.eyebrow}>QUICK ACCESS</p>
          <h1 id="install-title">アプリとして<br /><span>使う</span></h1>
          <p className={styles.lead}>ホーム画面に追加すると、次回から爆裂カジノをすぐに開けます。</p>
        </div>

        {isInstalled ? <div className={styles.success} role="status"><strong>追加済みです</strong><span>ホーム画面から爆裂カジノを開けます。</span></div> : promptEvent ? <button className={styles.installButton} type="button" onClick={() => void install()}>ホーム画面に追加する <span>→</span></button> : null}

        {!isInstalled && !promptEvent ? <section className={styles.instructions}>
          <h2>{isIOS ? "iPhone / iPadの場合" : "ホーム画面に追加する方法"}</h2>
          {isIOS ? <ol><li><span>1</span><p>画面下の<strong>共有ボタン</strong>をタップ</p></li><li><span>2</span><p><strong>ホーム画面に追加</strong>を選ぶ</p></li><li><span>3</span><p>右上の<strong>追加</strong>をタップ</p></li></ol> : <p className={styles.browserHint}>ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</p>}
        </section> : null}

        {message ? <p className={styles.message} role="status">{message}</p> : null}
        <div className={styles.actions}><Link className={styles.primaryLink} href={afterSignup ? "/dashboard" : "/guest/scan"}>{afterSignup ? "参加画面へ進む" : "QRコードで参加する"}</Link><Link className={styles.secondaryLink} href={afterSignup ? "/dashboard" : "/guest"}>あとで設定する</Link></div>
      </section>
    </main>
  );
}
