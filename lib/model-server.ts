import "server-only";

export type ModelMessage = {
  role: "user" | "assistant";
  content: string;
};

type CompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_GATEWAY_URL = "https://api.butterbase.ai/v1";
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";

function config() {
  const apiKey = process.env.BUTTERBASE_API_KEY;
  if (!apiKey) throw new Error("BUTTERBASE_API_KEY is not configured");

  return {
    apiKey,
    baseUrl: (process.env.BUTTERBASE_GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/$/, ""),
    model: process.env.BUTTERBASE_MODEL || DEFAULT_MODEL,
  };
}

export async function generateGroundedTutorResponse({
  passage,
  paperTitle,
  question,
  history,
  learnerMemory,
}: {
  passage: string;
  paperTitle: string;
  question: string;
  history: ModelMessage[];
  learnerMemory: string[];
}) {
  const { apiKey, baseUrl, model } = config();
  const memoryContext = learnerMemory.length
    ? learnerMemory.map((memory, index) => `${index + 1}. ${memory}`).join("\n")
    : "No relevant confirmed learner memory was retrieved.";

  const systemPrompt = `You are Gloss, a careful reading tutor.

SOURCE PASSAGE (${paperTitle}):
<source>
${passage}
</source>

CONFIRMED LEARNER MEMORY (EverOS):
<memory>
${memoryContext}
</memory>

Rules:
- Answer questions about the selected passage using only facts supported by the source passage.
- Learner memory may shape wording, level, and analogies, but it is not evidence about the paper.
- Clearly say when the source does not establish an answer. Never invent facts, equations, or citations.
- Prefer a short explanation first, then an analogy when useful.
- Explicitly mention a prior concept only when it genuinely helps.
- Do not claim that a learner has mastered anything not present in confirmed memory.`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-8),
        { role: "user", content: question },
      ],
      max_tokens: 700,
      temperature: 0.2,
      stream: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  const payload = (await response.json().catch(() => null)) as CompletionResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Butterbase gateway failed with status ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Butterbase gateway returned an empty response");

  return { content, model, provider: "Butterbase AI Gateway" as const };
}
