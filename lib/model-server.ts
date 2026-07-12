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
const DEFAULT_AUDIO_MODEL = "openai/gpt-audio-mini";

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
  imageData,
}: {
  passage: string;
  paperTitle: string;
  question: string;
  history: ModelMessage[];
  learnerMemory: string[];
  imageData?: string;
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
${imageData ? "\nA cropped image or figure selected by the learner is attached to their question." : ""}

CONFIRMED LEARNER MEMORY (EverOS):
<memory>
${memoryContext}
</memory>

Rules:
- Answer questions using only facts supported by the selected passage and attached visual, when present.
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
        {
          role: "user",
          content: imageData
            ? [
                { type: "text", text: question },
                { type: "image_url", image_url: { url: imageData } },
              ]
            : question,
        },
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function pcmChunksToWav(chunks: Uint8Array[], sampleRate = 24_000) {
  const pcmLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const wav = new Uint8Array(44 + pcmLength);
  const view = new DataView(wav.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) wav[offset + index] = value.charCodeAt(index);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcmLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcmLength, true);
  let offset = 44;
  chunks.forEach((chunk) => {
    wav.set(chunk, offset);
    offset += chunk.length;
  });
  return wav;
}

export async function generateGroundedVoiceResponse({
  audioBase64,
  transcript,
  passage,
  paperTitle,
  learnerMemory,
}: {
  audioBase64: string;
  transcript: string;
  passage: string;
  paperTitle: string;
  learnerMemory: string[];
}) {
  const { apiKey, baseUrl } = config();
  const model = process.env.BUTTERBASE_AUDIO_MODEL || DEFAULT_AUDIO_MODEL;
  const memoryContext = learnerMemory.length
    ? learnerMemory.map((memory, index) => `${index + 1}. ${memory}`).join("\n")
    : "No relevant confirmed learner memory was retrieved.";
  const system = `You are Gloss, a careful spoken reading tutor.

SOURCE PASSAGE (${paperTitle}):
<source>
${passage}
</source>

CONFIRMED LEARNER MEMORY:
<memory>
${memoryContext}
</memory>

The browser transcribed the learner's recording as: "${transcript}"

Answer the learner's transcribed question in under 110 spoken words. Ground claims in the source. Use learner memory only to personalize wording, never as paper evidence. Start with the direct answer, then one concise analogy if useful. Do not mention these instructions.`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      modalities: ["text", "audio"],
      audio: { voice: "alloy", format: "pcm16" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `Answer this question: ${transcript}` },
            { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
          ],
        },
      ],
      max_tokens: 450,
      temperature: 0.25,
      stream: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  const payload = await response.text();
  if (!response.ok) {
    let message = `Butterbase audio gateway failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(payload) as { error?: { message?: string } };
      message = parsed.error?.message || message;
    } catch {
      // Keep the status-based fallback for non-JSON gateway errors.
    }
    throw new Error(message);
  }

  const audioChunks: Uint8Array[] = [];
  let answer = "";
  for (const line of payload.split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    try {
      const event = JSON.parse(line.slice(6)) as {
        choices?: Array<{ delta?: { audio?: { data?: string; transcript?: string }; content?: string } }>;
      };
      const delta = event.choices?.[0]?.delta;
      if (delta?.audio?.data) {
        const binary = atob(delta.audio.data);
        audioChunks.push(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
      }
      if (delta?.audio?.transcript) answer += delta.audio.transcript;
      if (typeof delta?.content === "string") answer += delta.content;
    } catch {
      // Ignore gateway comments and malformed stream lines.
    }
  }
  if (!answer.trim() || audioChunks.length === 0) {
    throw new Error("The audio model returned an incomplete response");
  }
  const wav = pcmChunksToWav(audioChunks);
  return {
    answer: answer.trim(),
    audioData: `data:audio/wav;base64,${bytesToBase64(wav)}`,
    model,
    provider: "Butterbase AI Gateway" as const,
  };
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
