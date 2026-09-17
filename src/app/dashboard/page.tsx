"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BottomNavigationBar from "../components/BottomNavigationBar";
import styles from "./page.module.css";

type Account = { id: string; display_name: string };
type HistoryRow = { id: string; name: string | null; amount: number | null; type: string | null; timestamp: string | null };

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const accountResponse = await fetch("/api/guest/account", { cache: "no-store" });
    if (accountResponse.status === 401) { router.replace("/guest"); return; }
    if (!accountResponse.ok) { setError("アカウント情報を読み込めませんでした。"); setLoading(false); return; }
    const accountBody = await accountResponse.json() as { account: Account; balance: number };
    setAccount(accountBody.account);
    setBalance(accountBody.balance);

    const historyResponse = await fetch("/api/payment/history", { cache: "no-store" });
    if (historyResponse.ok) {
      const body = await historyResponse.json() as { data?: HistoryRow[] };
      setHistory(body.data ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>爆裂カジノ / PARTICIPANT</p><h1>{account?.display_name ?? "参加者"}さん</h1></div>
        </header>
        {error ? <div className={styles.historyState} style={{ color: "#ef4444" }}>{error}</div> : null}
        <section className={styles.balanceContainer} aria-label="チップ残高">
          <div className={styles.balanceActions}>
            <button className={styles.actionButton} onClick={() => router.push("/dashboard/rewards")}><Image src="/icons/Request Icon.svg" alt="景品" width={32} height={32} className={styles.actionIcon} /><span>景品</span></button>
            <button className={styles.actionButton} onClick={() => router.push("/dashboard/history")}><Image src="/icons/History Icon.svg" alt="履歴" width={32} height={32} className={styles.actionIcon} /><span>履歴</span></button>
          </div>
          <div className={styles.balanceDisplayCard}>
            <div className={styles.balanceTitle}>爆裂カジノチップ</div>
            <div className={styles.balanceAmount}>{loading ? "..." : `${(balance ?? 0).toLocaleString()} CF`}</div>
            <div className={styles.logoWrapper}><Image src="/festa-casino.svg" alt="爆裂カジノ" width={30} height={30} /></div>
          </div>
        </section>
        <section className={styles.requestsCard}>
          <div className={styles.historyHeader}><h2 className={styles.requestsTitle}>最近の利用履歴</h2><button type="button" className={styles.historyActionButton} onClick={() => void loadDashboard()} disabled={loading}>更新</button></div>
          {history.length === 0 ? <div className={styles.historyState}>まだ履歴がありません。</div> : history.slice(0, 5).map((entry) => <div key={entry.id} className={styles.historyRow}><span>{entry.name || "チップ取引"}</span><strong className={entry.amount && entry.amount < 0 ? styles.amountNegative : styles.amountPositive}>{entry.amount && entry.amount > 0 ? "+" : ""}{entry.amount ?? 0} CF</strong></div>)}
        </section>
      </main>
      <div className={styles.footerContainer}><BottomNavigationBar /></div>
    </div>
  );
}
