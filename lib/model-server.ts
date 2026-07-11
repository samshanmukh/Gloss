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

type GraphExtraction = {
  concepts: Array<{ id: string; label: string; summary: string }>;
  relationships: Array<{ from: string; to: string; relation: string }>;
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

export async function extractKnowledgeFromNote({
  content,
  sourceTitle,
  passage,
  existingNodes,
}: {
  content: string;
  sourceTitle: string;
  passage?: string;
  existingNodes: Array<{ id: string; label: string; summary: string }>;
}): Promise<GraphExtraction> {
  const { apiKey, baseUrl, model } = config();
  const canonical = [
    { id: "sensor", label: "Sensory feedback" },
    { id: "closed-loop", label: "Closed-loop learning" },
    { id: "action", label: "Action space" },
    { id: "reward", label: "Reward signal" },
    { id: "prediction", label: "Prediction" },
    { id: "td-error", label: "TD error" },
    { id: "update", label: "Update rule" },
    ...existingNodes,
  ];
  const prompt = `Extract a small knowledge-graph update from this learner note.

Source: ${sourceTitle}
Selected passage: ${passage || "(none)"}
Learner note: ${content}

Existing concepts (reuse these exact IDs when relevant):
${JSON.stringify(canonical)}

Return ONLY valid JSON with this shape:
{"concepts":[{"id":"short-kebab-id","label":"2-4 words","summary":"one grounded sentence"}],"relationships":[{"from":"concept-id","to":"concept-id","relation":"short verb phrase"}]}

Rules:
- Extract at most 3 genuinely meaningful concepts.
- Do not duplicate an existing concept; reference its existing ID in relationships instead.
- New concept IDs must be lowercase kebab-case.
- Every relationship endpoint must be either an existing concept ID or a returned new concept ID.
- Include at most 4 relationships, all directly supported by the note or passage.
- If nothing meaningful can be extracted, return empty arrays.`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You output strict JSON only. Never use markdown fences." },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0,
      stream: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  const payload = (await response.json().catch(() => null)) as CompletionResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Butterbase gateway failed with status ${response.status}`);
  }
  const raw = payload?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Butterbase gateway returned an empty graph");
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(json) as Partial<GraphExtraction>;
  return {
    concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 3) : [],
    relationships: Array.isArray(parsed.relationships) ? parsed.relationships.slice(0, 4) : [],
  };
}
