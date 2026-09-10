"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "../../page.module.css";

type DrawState = { drawn_numbers: number[]; current_number: number | null; active: boolean };

export default function BingoControlPage() {
  const router = useRouter();
  const [state, setState] = useState<DrawState>({ drawn_numbers: [], current_number: null, active: false });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await fetch("/api/bingo/draw", { cache: "no-store" });
    if (response.ok) setState(await response.json());
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/operator/login");
      else void load();
    });
  }, [router]);

  const draw = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/bingo/draw", { method: "POST", headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined });
    const body = await response.json().catch(() => ({})) as DrawState & { error?: string };
    if (!response.ok) setMessage(body.error ?? "抽選に失敗しました");
    else { setState(body); setMessage(`${body.current_number} を発表しました`); }
    setLoading(false);
  };

  return <div className={styles.pageContainer}><main className={styles.mainContent}><div className={styles.historyContainer}>
    <p className={styles.eyebrow}>爆裂カジノ / BINGO CONTROL</p><h1>ビンゴ進行（運営）</h1>
    <section className={styles.requestsCard} style={{ gap: "1rem" }}>
      <button className={styles.historyActionButton} onClick={() => void draw()} disabled={loading}>{loading ? "抽選中…" : "次の番号を抽選"}</button>
      {message ? <p>{message}</p> : null}
      <div style={{ textAlign: "center", fontSize: "5rem", fontWeight: 900, color: "#0099d9" }}>{state.current_number ?? "—"}</div>
      <p>抽選済み: {state.drawn_numbers.join("・") || "なし"}</p>
    </section>
    <div style={{ display: "flex", gap: 12 }}><Link href="/operator">運営パネル</Link><Link href="/dashboard/bingo">参加者画面</Link></div>
  </div></main></div>;
}
