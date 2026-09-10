"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "../page.module.css";

type Card = { id: string; numbers: number[][]; marked_numbers: number[]; created_at: string };
type DrawState = { drawn_numbers: number[]; current_number: number | null; active: boolean };

const columns = ["B", "I", "N", "G", "O"];

export default function BingoPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [draw, setDraw] = useState<DrawState>({ drawn_numbers: [], current_number: null, active: false });
  const [activeIndex, setActiveIndex] = useState(0);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cardsResponse, drawResponse] = await Promise.all([
      fetch("/api/bingo/cards", { cache: "no-store" }),
      fetch("/api/bingo/draw", { cache: "no-store" }),
    ]);
    if (cardsResponse.status === 401) { router.replace("/guest"); return; }
    if (cardsResponse.ok) {
      const body = await cardsResponse.json() as { cards?: Card[]; balance?: number };
      setCards(body.cards ?? []);
      setBalance(body.balance ?? 0);
    }
    if (drawResponse.ok) setDraw(await drawResponse.json() as DrawState);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const card = cards[activeIndex];
  const price = cards.length === 0 ? 0 : 100;
  const purchase = async () => {
    setMessage(null);
    const response = await fetch("/api/bingo/cards", {
      method: "POST",
      credentials: "include",
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setMessage(body.error ?? "カードの発行に失敗しました"); return; }
    await load();
    setMessage(price === 0 ? "ビンゴカードを受け取りました" : "ビンゴカードを追加しました");
  };

  const toggle = async (number: number) => {
    if (!card || number === 0 || !draw.drawn_numbers.includes(number)) return;
    const marked = card.marked_numbers.includes(number)
      ? card.marked_numbers.filter((item) => item !== number)
      : [...card.marked_numbers, number];
    const response = await fetch("/api/bingo/cards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id, markedNumbers: marked }) });
    if (!response.ok) { setMessage("チェックを保存できませんでした"); return; }
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, marked_numbers: marked } : item));
  };

  const completion = useMemo(() => {
    if (!card) return 0;
    return card.marked_numbers.filter((number) => number !== 0).length;
  }, [card]);

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <div className={styles.historyContainer}>
          <p className={styles.eyebrow}>爆裂カジノ / BINGO</p>
          <h1>ビンゴカード</h1>
          {message ? <div className={styles.historyState}>{message}</div> : null}
          <section className={styles.requestsCard} style={{ gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><strong>今回の番号</strong><div style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0099d9" }}>{draw.current_number ?? "—"}</div></div>
              <div style={{ textAlign: "right" }}><span>抽選済み</span><br /><strong>{draw.drawn_numbers.length} / 75</strong></div>
            </div>
          </section>

          {loading ? <section className={styles.requestsCard}>読み込み中...</section> : !card ? (
            <section className={styles.requestsCard}>
              <h2>カードを受け取る</h2>
              <p>1枚目は無料です。2枚目以降は100 CFで追加できます。</p>
              <strong>現在の残高 {balance.toLocaleString()} CF</strong>
              <button className={styles.historyActionButton} onClick={() => void purchase()}>無料カードを受け取る</button>
            </section>
          ) : (
            <>
              <section className={styles.requestsCard}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>カード {activeIndex + 1} / {cards.length}</strong>
                  <span>{completion} / 24 チェック済み</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {columns.map((column) => <strong key={column} style={{ textAlign: "center", color: "#0099d9" }}>{column}</strong>)}
                  {card.numbers.flatMap((row, rowIndex) => row.map((number, colIndex) => {
                    const free = number === 0;
                    const marked = card.marked_numbers.includes(number);
                    const called = free || draw.drawn_numbers.includes(number);
                    return <button key={`${rowIndex}-${colIndex}`} onClick={() => void toggle(number)} disabled={free || !called} style={{ minHeight: 54, borderRadius: 12, border: "1px solid #dbe5ef", background: marked ? "#0099d9" : called ? "#eef9ff" : "#f8fafc", color: marked ? "#fff" : "#132238", fontWeight: 800 }}>{free ? "FREE" : number}</button>;
                  }))}
                </div>
                <small>スタッフが発表した番号だけチェックできます。</small>
              </section>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <button disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>前のカード</button>
                <button disabled={activeIndex >= cards.length - 1} onClick={() => setActiveIndex((index) => index + 1)}>次のカード</button>
              </div>
              <section className={styles.requestsCard}>
                <strong>もう1枚追加</strong>
                <span>{price} CF / 残高 {balance.toLocaleString()} CF</span>
                <button className={styles.historyActionButton} disabled={balance < price} onClick={() => void purchase()}>カードを追加購入</button>
              </section>
            </>
          )}
          <Link href="/dashboard/bingo/control" style={{ color: "#64748b", fontSize: 12, textAlign: "center" }}>スタッフ用進行画面</Link>
        </div>
      </main>
      <div className={styles.footerContainer}><BottomNavigationBar /></div>
    </div>
  );
}
