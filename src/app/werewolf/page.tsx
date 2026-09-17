"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Phase = "night" | "day";
type Player = { id: string; display_name: string };
type WerewolfResponse = { state: { phase: Phase; round: number }; players: Player[] };

export const dynamic = "force-dynamic";

export default function WerewolfPage() {
  const [data, setData] = useState<WerewolfResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/werewolf", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as WerewolfResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "人狼の進行情報を読み込めませんでした");
      setData(body);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "人狼の進行情報を読み込めませんでした");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const vote = async (targetAccountId: string) => {
    if (!data || data.state.phase !== "day") return;
    setVotingId(targetAccountId);
    setMessage(null);
    try {
      const response = await fetch("/api/werewolf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayerId: targetAccountId }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; target?: Player };
      if (!response.ok) throw new Error(body.error ?? "投票できませんでした");
      setSelectedId(targetAccountId);
      setMessage(`${body.target?.display_name ?? "選択した参加者"}さんに投票しました`);
    } catch (voteError) {
      setMessage(voteError instanceof Error ? voteError.message : "投票できませんでした");
    } finally {
      setVotingId(null);
    }
  };

  const isDay = data?.state.phase === "day";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/werewolf"><span className={styles.brandMark}>人</span><span><strong>人狼企画</strong><small>CANFES AUDIENCE</small></span></Link>
          <span className={`${styles.phaseBadge} ${isDay ? styles.phaseDay : styles.phaseNight}`}><span />{isDay ? "昼・投票受付中" : "夜・準備中"}</span>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>CANFES WEREWOLF / AUDIENCE VOTE</p>
          <h1>誰が人狼だと思う？</h1>
          <p>会議の内容を聞いて、人狼だと思う参加者を1人選んでください。</p>
        </section>

        {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void load(true)}>再読み込み</button></div> : null}
        {message ? <div className={styles.message} role="status">✓ <span>{message}</span></div> : null}

        <section className={styles.voteCard} aria-labelledby="vote-title">
          <div className={styles.cardHeader}><div><span className={styles.cardKicker}>ROUND {data?.state.round ?? "—"}</span><h2 id="vote-title">人狼だと思う人に投票</h2></div><span className={styles.cardIcon}>?</span></div>
          {!data || loading ? <p className={styles.stateText}>投票画面を準備しています…</p> : !isDay ? <div className={styles.waiting}><strong>ただいま準備中です</strong><span>運営が「昼」に切り替えると投票できます。</span></div> : data.players.length === 0 ? <p className={styles.stateText}>参加者がまだ登録されていません。</p> : <div className={styles.playerList}>{data.players.map((player) => <button key={player.id} type="button" className={`${styles.playerButton} ${selectedId === player.id ? styles.playerSelected : ""}`} onClick={() => void vote(player.id)} disabled={votingId !== null}><span className={styles.playerAvatar}>{player.display_name.slice(0, 1)}</span><span className={styles.playerName}>{player.display_name}</span><span className={styles.voteAction}>{votingId === player.id ? "投票中…" : selectedId === player.id ? "投票済み ✓" : "この人に投票"}</span></button>)}</div>}
        </section>

        <p className={styles.note}>ログイン不要・この端末から1票です。投票受付中は選び直せます。</p>
        <footer className={styles.footer}><Link href="/guest">キャンフェス入口へ戻る →</Link></footer>
      </main>
    </div>
  );
}
