import { NextResponse } from "next/server";
import {
  asHistory,
  asSnapshot,
  buildSystemPrompt,
  buildUserPrompt,
  type ChatMsg,
} from "../../../lib/advisor";

export const runtime = "nodejs";
export const maxDuration = 60;

type AdvisorBody = {
  message?: unknown;
  history?: unknown;
  snapshot?: unknown;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const MUSESPARK_BASE_URL =
  process.env.MUSESPARK_BASE_URL ?? "https://api.musespark.ai/v1";
const MUSESPARK_MODEL = process.env.MUSESPARK_MODEL ?? "muse-spark-1.3";

async function tryGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(20000),
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
    return text || null;
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
): Promise<string | null> {
  if (!apiKey) return null;
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
        max_tokens: 300,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
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
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  if (!message) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  const history = asHistory(body.history);
  const snapshot = asSnapshot(body.snapshot);
  const system = buildSystemPrompt(snapshot);
  const prompt = buildUserPrompt(system, history, message);

  // Fallback order: primary -> second -> third. Provider names are
  // never exposed in the response; the UI stays model-agnostic.
  const reply =
    (await tryGemini(prompt)) ??
    (await tryOpenAICompatible(
      "https://api.deepseek.com",
      process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL,
      system,
      history,
      message,
    )) ??
    (await tryOpenAICompatible(
      MUSESPARK_BASE_URL,
      process.env.MUSESPARK_API_KEY,
      MUSESPARK_MODEL,
      system,
      history,
      message,
    ));

  if (!reply) {
    return NextResponse.json(
      { error: "Advisor unavailable", fallback: true },
      { status: 503 },
    );
  }
  return NextResponse.json({ reply });
}
