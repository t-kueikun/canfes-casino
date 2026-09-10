"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "../page.module.css";

type Account = { id: string; display_name: string };

export default function PaymentPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState(100);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/guest/account", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/guest"); return; }
      if (!response.ok) return;
      const body = await response.json() as { account: Account; balance: number };
      setAccount(body.account);
      setBalance(body.balance);
      setAmount(Math.min(100, body.balance));
    });
  }, [router]);

  const safeAmount = Math.min(Math.max(1, amount), Math.max(1, balance ?? 1));
  const qrValue = account ? JSON.stringify({ app: "canfes-casino", type: "payment", accountId: account.id, amount: safeAmount }) : "";

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}><div className={styles.historyContainer}>
        <p className={styles.eyebrow}>爆裂カジノ / PAYMENT</p><h1>支払いQR</h1>
        <section className={styles.requestsCard} style={{ alignItems: "center", textAlign: "center" }}>
          <p>金額を入力して、会場スタッフにQRを見せてください。</p>
          <label style={{ width: "100%", textAlign: "left" }}>支払いチップ<input type="number" min={1} max={balance ?? 0} value={amount} onChange={(event) => setAmount(Number(event.target.value) || 1)} /></label>
          {qrValue ? <QRCodeCanvas value={qrValue} size={220} includeMargin /> : <p>読み込み中…</p>}
          <strong>残高 {(balance ?? 0).toLocaleString()} CF</strong>
        </section>
      </div></main>
      <div className={styles.footerContainer}><BottomNavigationBar /></div>
    </div>
  );
}
