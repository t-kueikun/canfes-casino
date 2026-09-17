"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "./page.module.css";

type Account = {
  id: string;
  display_name: string;
  active: boolean;
  created_at: string;
};

type AccountResponse = {
  account: Account;
  balance: number;
};

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guest/account", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401 || response.status === 409) {
          router.replace("/guest");
          return;
        }
        if (!response.ok) throw new Error("アカウント情報を読み込めませんでした");
        const body = await response.json() as AccountResponse;
        if (cancelled) return;
        setAccount(body.account);
        setBalance(body.balance);
        setDisplayName(body.account.display_name);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "アカウント情報を読み込めませんでした");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [router]);

  const saveDisplayName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/guest/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const body = await response.json().catch(() => ({})) as { account?: Account; error?: string };
      if (response.status === 401) {
        router.replace("/guest");
        return;
      }
      if (!response.ok || !body.account) throw new Error(body.error ?? "表示名を更新できませんでした");
      setAccount(body.account);
      setDisplayName(body.account.display_name);
      setMessage("表示名を更新しました");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "表示名を更新できませんでした");
    } finally {
      setSaving(false);
    }
  };

  const copyAccountId = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("アカウントIDをコピーできませんでした");
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => router.back()} aria-label="戻る">←</button>
          <div>
            <p className={styles.eyebrow}>爆裂カジノ / ACCOUNT</p>
            <h1 className={styles.title}>アカウント管理</h1>
            <p className={styles.subtitle}>参加者情報を確認・変更できます</p>
          </div>
        </header>

        {loading ? <p className={styles.loading}>読み込み中…</p> : account ? <>
          <form className={styles.section} onSubmit={(event) => void saveDisplayName(event)}>
            <h2 className={styles.sectionHeading}>表示名</h2>
            <label className={styles.label}>
              会場で表示する名前
              <input className={styles.input} value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} placeholder="参加者" />
            </label>
            <p className={styles.fieldHint}>40文字以内で入力してください。</p>
            <button className={styles.saveButton} type="submit" disabled={saving || !displayName.trim()}>{saving ? "保存中…" : "表示名を保存"}</button>
            {message ? <p className={styles.success} role="status">{message}</p> : null}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </form>

          <section className={styles.section} aria-labelledby="account-info-title">
            <h2 className={styles.sectionHeading} id="account-info-title">アカウント情報</h2>
            <div className={styles.infoRow}>
              <div><span className={styles.infoLabel}>現在の表示名</span><strong className={styles.infoValue}>{account.display_name}</strong></div>
            </div>
            <div className={styles.infoRow}>
              <div><span className={styles.infoLabel}>チップ残高</span><strong className={styles.infoValue}>{(balance ?? 0).toLocaleString()} CF</strong></div>
              <Link href="/dashboard" className={styles.linkButton}>ホームへ</Link>
            </div>
            <div className={styles.infoRow}>
              <div><span className={styles.infoLabel}>アカウントID</span><code className={styles.accountId} title={account.id}>{account.id}</code></div>
              <button type="button" className={styles.copyButton} onClick={() => void copyAccountId()}>{copied ? "コピー済み" : "コピー"}</button>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="app-settings-title">
            <h2 className={styles.sectionHeading} id="app-settings-title">アプリ設定</h2>
            <p className={styles.note}>この参加者アカウントはメールアドレス・パスワードを使わず、この端末のブラウザに保存されています。</p>
            <Link href="/guest/install" className={styles.linkButton}>ホーム画面への追加方法を見る</Link>
          </section>
        </> : error ? <p className={styles.error} role="alert">{error}</p> : null}
      </main>
      <div className={styles.footerContainer}><BottomNavigationBar /></div>
    </div>
  );
}
