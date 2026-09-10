import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]] as const;

function createNumbers() {
  const columns = ranges.map(([start, end]) => {
    const values = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    return values.sort(() => Math.random() - 0.5).slice(0, 5);
  });
  return Array.from({ length: 5 }, (_, row) => columns.map((column, col) => row === 2 && col === 2 ? 0 : column[row]));
}

export async function GET(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });
  const admin = getSupabaseServiceClient() as any;
  const [{ data: cards, error: cardsError }, { data: balance, error: balanceError }] = await Promise.all([
    admin.from("canfes_bingo_cards").select("id, numbers, marked_numbers, created_at").eq("account_id", account.id).order("created_at", { ascending: true }),
    admin.from("canfes_balances").select("amount").eq("account_id", account.id).maybeSingle(),
  ]);
  if (cardsError || balanceError) return NextResponse.json({ error: cardsError?.message ?? balanceError?.message }, { status: 500 });
  return NextResponse.json({ cards: cards ?? [], balance: Number(balance?.amount ?? 0) });
}

export async function POST(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });
  const admin = getSupabaseServiceClient() as any;
  const { data: balance, error: balanceError } = await admin.from("canfes_balances").select("amount").eq("account_id", account.id).maybeSingle();
  if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 500 });
  const { count, error: countError } = await admin.from("canfes_bingo_cards").select("id", { count: "exact", head: true }).eq("account_id", account.id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  const price = (count ?? 0) === 0 ? 0 : 100;
  const current = Number(balance?.amount ?? 0);
  if (current < price) return NextResponse.json({ error: `カード追加には ${price} CF 必要です` }, { status: 400 });

  const nextBalance = current - price;
  const { error: updateError } = await admin.from("canfes_balances").update({ amount: nextBalance, updated_at: new Date().toISOString() }).eq("account_id", account.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  const { data: card, error: cardError } = await admin.from("canfes_bingo_cards").insert({ account_id: account.id, numbers: createNumbers(), marked_numbers: [0] }).select("id, numbers, marked_numbers, created_at").single();
  if (cardError) return NextResponse.json({ error: cardError.message }, { status: 500 });
  await admin.from("canfes_transactions").insert({ account_id: account.id, amount: -price, type: "bingo_card", name: price === 0 ? "ビンゴカード（初回無料）" : "ビンゴカード追加購入" });
  return NextResponse.json({ card, balance: nextBalance });
}

export async function PATCH(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { cardId?: string; markedNumbers?: unknown };
  if (!body.cardId || !Array.isArray(body.markedNumbers) || !body.markedNumbers.every((value) => Number.isInteger(value))) return NextResponse.json({ error: "チェック情報が不正です" }, { status: 400 });
  const admin = getSupabaseServiceClient() as any;
  const { data: card, error: cardError } = await admin.from("canfes_bingo_cards").select("numbers").eq("id", body.cardId).eq("account_id", account.id).maybeSingle();
  if (cardError || !card) return NextResponse.json({ error: "カードが見つかりません" }, { status: 404 });
  const validNumbers = new Set((card.numbers as number[][]).flat());
  const markedNumbers = [...new Set(body.markedNumbers as number[])].filter((number) => validNumbers.has(number));
  if (!markedNumbers.includes(0)) markedNumbers.unshift(0);
  const { error } = await admin.from("canfes_bingo_cards").update({ marked_numbers: markedNumbers }).eq("id", body.cardId).eq("account_id", account.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ markedNumbers });
}
