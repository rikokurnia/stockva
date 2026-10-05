import { NextResponse } from "next/server";
import {
  asHistory,
  asHallAnalysis,
  asSnapshot,
  buildSystemPrompt,
  buildUserPrompt,
  isCompleteReply,
  plainText,
  type ChatMsg,
} from "../../../lib/advisor";

export const runtime = "nodejs";
export const maxDuration = 60;

type AdvisorBody = {
  message?: unknown;
  history?: unknown;
  snapshot?: unknown;
  hallAnalysis?: unknown;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const MUSESPARK_BASE_URL =
  process.env.MUSESPARK_BASE_URL ?? "https://api.musespark.ai/v1";
const MUSESPARK_MODEL = process.env.MUSESPARK_MODEL ?? "muse-spark-1.3";

async function tryGemini(
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || signal.aborted) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    // A word budget can halt the model mid-word with finishReason STOP.
    // Treat cut replies as a miss so the next provider answers instead.
    if (!text || !isCompleteReply(text)) return null;
    return text;
  } catch {
    return null;
  }
}

async function tryOpenAICompatible(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  system: string,
  history: ChatMsg[],
  message: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (!apiKey || signal.aborted) return null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          ...history.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
          { role: "user", content: message },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || !isCompleteReply(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: AdvisorBody;
  try {
    body = (await req.json()) as AdvisorBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  if (!message) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  const history = asHistory(body.history);
  const hall = asHallAnalysis(body.hallAnalysis);
  const snapshot = asSnapshot(body.snapshot, hall ? 40 : 20);
  const system = buildSystemPrompt(snapshot, hall);
  const prompt = buildUserPrompt(system, history, message);

  // Fallback order: primary -> second -> third. Provider names are
  // never exposed in the response; the UI stays model-agnostic.
  // Fit the full provider fallback chain within the route/client timeout.
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(52000)]);
  const reply =
    (await tryGemini(prompt, signal)) ??
    (await tryOpenAICompatible(
      "https://api.deepseek.com",
      process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL,
      system,
      history,
      message,
      signal,
    )) ??
    (await tryOpenAICompatible(
      MUSESPARK_BASE_URL,
      process.env.MUSESPARK_API_KEY,
      MUSESPARK_MODEL,
      system,
      history,
      message,
      signal,
    ));

  if (!reply) {
    return NextResponse.json(
      { error: "Advisor unavailable", fallback: true },
      { status: 503 },
    );
  }
  return NextResponse.json({ reply: plainText(reply) });
}
