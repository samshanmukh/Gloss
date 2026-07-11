import "server-only";

const EVEROS_BASE_URL = "https://api.evermind.ai/api/v1";
const REQUEST_TIMEOUT_MS = 12_000;

type EverOSSearchData = {
  episodes?: Array<{ episode?: string; summary?: string; subject?: string }>;
  profiles?: Array<{ profile_data?: unknown }>;
  raw_messages?: Array<{ content?: string }>;
};

type EverOSResponse<T> = {
  data: T;
};

export type RetrievedMemory = {
  available: boolean;
  hasRewardSignal: boolean;
  evidence: string[];
};

function apiKey() {
  const key = process.env.EVEROS_API_KEY;
  if (!key) {
    throw new Error("EVEROS_API_KEY is not configured");
  }
  return key;
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${EVEROS_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `EverOS request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function retrieveLearnerMemory(
  learnerId: string,
  query: string,
): Promise<RetrievedMemory> {
  const response = await request<EverOSResponse<EverOSSearchData>>("/memories/search", {
    filters: { user_id: learnerId },
    query,
    method: "hybrid",
    memory_types: ["episodic_memory", "profile", "raw_message"],
    top_k: 5,
    include_original_data: true,
  });

  const episodes = (response.data.episodes ?? []).map(
    (item) => item.episode || item.summary || item.subject || "",
  );
  const profiles = (response.data.profiles ?? []).map((item) =>
    JSON.stringify(item.profile_data ?? {}),
  );
  const rawMessages = (response.data.raw_messages ?? []).map((item) => item.content ?? "");
  const evidence = [...episodes, ...profiles, ...rawMessages].filter(Boolean);
  const searchable = evidence.join(" ").toLowerCase();

  return {
    available: true,
    hasRewardSignal:
      searchable.includes("reward signal") ||
      searchable.includes("reward_signal") ||
      searchable.includes("scalar feedback"),
    evidence: evidence.slice(0, 3),
  };
}

export async function storeConfirmedConcept({
  learnerId,
  concept,
  understanding,
  learnedFrom,
}: {
  learnerId: string;
  concept: string;
  understanding: string;
  learnedFrom: string;
}) {
  const timestamp = Date.now();
  const sessionId = `gloss_${learnedFrom}`;

  await request<EverOSResponse<unknown>>("/memories", {
    user_id: learnerId,
    session_id: sessionId,
    async_mode: false,
    messages: [
      {
        role: "user",
        timestamp,
        content: `I understand the concept "${concept}" from ${learnedFrom}. In my words: ${understanding}`,
      },
      {
        role: "assistant",
        timestamp: timestamp + 1,
        content:
          `Confirmed learning: ${concept}. The learner understands it as "${understanding}". ` +
          "Mastery is confirmed. Preferred explanation style is short and analogy-first.",
      },
    ],
  });

  const flush = await request<EverOSResponse<{ status: string }>>("/memories/flush", {
    user_id: learnerId,
    session_id: sessionId,
  });

  return {
    available: true,
    status: flush.data.status,
    concept,
  };
}
