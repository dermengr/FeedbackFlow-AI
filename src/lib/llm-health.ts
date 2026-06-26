import { chatCompletion } from "@/lib/llm";

export type LlmHealthStatus = "healthy" | "degraded" | "down";

export interface LlmHealthResult {
  status: LlmHealthStatus;
  provider: string;
  model: string;
  reachable: boolean;
  latencyMs: number | null;
  probeResponse: string | null;
  detail: string;
  checkedAt: string;
}

function getProvider(): string {
  return (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
}

function getModel(): string {
  const provider = getProvider();
  if (provider === "openai") {
    return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }
  return process.env.OLLAMA_MODEL ?? "qwen2.5:0.5b";
}

/** Ping the configured LLM with a tiny prompt to verify connectivity. */
export async function checkLlmHealth(): Promise<LlmHealthResult> {
  const provider = getProvider();
  const model = getModel();
  const checkedAt = new Date().toISOString();

  const base = {
    provider,
    model,
    checkedAt,
    reachable: false,
    latencyMs: null as number | null,
    probeResponse: null as string | null,
  };

  const start = Date.now();
  try {
    const response = await chatCompletion(
      "You are a health check probe. Reply with exactly MODEL_OK and nothing else.",
      "ping",
      { temperature: 0, maxAttempts: 1 }
    );
    const latencyMs = Date.now() - start;
    const trimmed = response.trim();

    if (trimmed.includes("MODEL_OK") || trimmed.length > 0) {
      return {
        ...base,
        status: "healthy",
        reachable: true,
        latencyMs,
        probeResponse: trimmed.slice(0, 100),
        detail: `LLM responded in ${latencyMs}ms via ${provider} (${model}).`,
      };
    }

    return {
      ...base,
      status: "degraded",
      reachable: true,
      latencyMs,
      probeResponse: trimmed.slice(0, 100),
      detail: "LLM reachable but returned an unexpected empty response.",
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = (err as Error).message;

    let detail = message;
    if (provider === "ollama") {
      detail = `Ollama unreachable or model not loaded. Run: ollama pull ${model}. Error: ${message}`;
    } else if (provider === "openai") {
      detail = `OpenAI API error. Check OPENAI_API_KEY. Error: ${message}`;
    }

    return {
      ...base,
      status: "down",
      latencyMs,
      detail,
    };
  }
}