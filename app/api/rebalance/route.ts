import { NextResponse } from "next/server";
import { createPublicClient, formatUnits, http } from "viem";
import { bscTestnet } from "viem/chains";
import {
  BSC_TESTNET_RPC,
  MOCK_USD_ABI,
  MOCK_USD_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
  type OnchainPosition,
} from "../../../lib/contracts";
import {
  buildRebalancePlan,
  buildRebalancePrompt,
  parseRebalanceProposal,
  parseRebalanceRequest,
  type RebalanceInput,
} from "../../../lib/rebalance";

export const runtime = "nodejs";
export const maxDuration = 60;

async function geminiPlan(
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || signal.aborted) return null;
  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2400,
            temperature: 0.25,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      },
    );
    if (!response.ok) return null;
    const result = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (
      result.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() || null
    );
  } catch {
    return null;
  }
}

async function compatiblePlan(
  prompt: string,
  baseUrl: string,
  key: string | undefined,
  model: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (!key || signal.aborted) return null;
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1800,
          temperature: 0.25,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]),
      },
    );
    if (!response.ok) return null;
    const result = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return result.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Planning is read-only. This route never signs, submits, or simulates completion of a trade. */
export async function POST(req: Request) {
  let parsed: ReturnType<typeof parseRebalanceRequest>;
  try {
    const raw = await req.text();
    if (raw.length > 180000) throw new Error("The city snapshot is too large.");
    parsed = parseRebalanceRequest(JSON.parse(raw));
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Invalid city snapshot.") },
      { status: 400 },
    );
  }
  if (
    ![
      process.env.GEMINI_API_KEY,
      process.env.DEEPSEEK_API_KEY,
      process.env.MUSESPARK_API_KEY,
    ].some(Boolean)
  )
    return NextResponse.json(
      {
        error:
          "The agent is unavailable. Configure its server API credentials and retry.",
      },
      { status: 503 },
    );

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(54000)]);
  let input: RebalanceInput;
  try {
    const client = createPublicClient({
      chain: bscTestnet,
      transport: http(BSC_TESTNET_RPC, { timeout: 8000, retryCount: 1 }),
    });
    const [positions, cashWei, reserveWei] = await Promise.all([
      client.readContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getUserPositions",
        args: [parsed.walletAddress],
      }),
      client.readContract({
        address: MOCK_USD_ADDRESS,
        abi: MOCK_USD_ABI,
        functionName: "balanceOf",
        args: [parsed.walletAddress],
      }),
      client.readContract({
        address: MOCK_USD_ADDRESS,
        abi: MOCK_USD_ABI,
        functionName: "balanceOf",
        args: [VAULT_ADDRESS],
      }),
    ]);
    input = {
      ...parsed,
      positions: positions as unknown as OnchainPosition[],
      walletCash: Number(formatUnits(cashWei as bigint, 18)),
      vaultReserves: Number(formatUnits(reserveWei as bigint, 18)),
    };
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not verify wallet positions and mUSD on BNB Testnet. Retry when the network is available.",
      },
      { status: 503 },
    );
  }

  let prompt: string;
  try {
    prompt = buildRebalancePrompt(input);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "The city cannot be rebalanced yet.") },
      { status: 409 },
    );
  }
  // Provider fallback still requires actual, validated agent output. There is no fabricated strategy.
  const providers = [
    () => geminiPlan(prompt, signal),
    () =>
      compatiblePlan(
        prompt,
        "https://api.deepseek.com",
        process.env.DEEPSEEK_API_KEY,
        process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        signal,
      ),
    () =>
      compatiblePlan(
        prompt,
        process.env.MUSESPARK_BASE_URL ?? "https://api.musespark.ai/v1",
        process.env.MUSESPARK_API_KEY,
        process.env.MUSESPARK_MODEL ?? "muse-spark-1.3",
        signal,
      ),
  ];
  let planningError: string | undefined;
  for (const provider of providers) {
    if (signal.aborted) break;
    const content = await provider();
    if (!content) continue;
    let proposal;
    try {
      proposal = parseRebalanceProposal(content);
    } catch {
      continue;
    }
    try {
      const plan = buildRebalancePlan(input, proposal);
      return NextResponse.json(
        { plan },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      planningError = errorMessage(
        error,
        "The agent's proposed allocation cannot fit this city.",
      );
    }
  }
  return NextResponse.json(
    {
      error:
        planningError ??
        "The agent could not prepare a valid allocation plan. Retry shortly; no city changes were made.",
    },
    { status: planningError ? 422 : 503 },
  );
}
