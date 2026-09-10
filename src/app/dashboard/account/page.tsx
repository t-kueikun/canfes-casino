"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "../page.module.css";

type Account = { id: string; display_name: string };

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    fetch("/api/guest/account", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/guest"); return; }
      if (response.ok) setAccount((await response.json()).account);
    });
  }, [router]);

  const logout = async () => {
    await fetch("/api/guest/account", { method: "DELETE" });
    router.replace("/guest");
  };

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}><div className={styles.historyContainer}>
        <h1>参加者アカウント</h1>
        <section className={styles.requestsCard}>
          <p className={styles.historySummaryLabel}>表示名</p>
          <strong>{account?.display_name ?? "読み込み中…"}</strong>
          <p className={styles.historySummaryLabel}>アカウントID</p>
          <code style={{ wordBreak: "break-all" }}>{account?.id ?? "—"}</code>
          <p style={{ color: "#64748b", fontSize: 13 }}>メールアドレス・パスワードを使わない参加者アカウントです。</p>
          <button className={styles.logoutButton} onClick={() => void logout()}>この端末から退出</button>
        </section>
      </div></main>
      <div className={styles.footerContainer}><BottomNavigationBar /></div>
    </div>
  );
}
