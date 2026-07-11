export type PaperId = "cortical" | "td";
export type SourceId = PaperId | "pdf";

export type Concept = {
  id: string;
  label: string;
  paper: PaperId;
  status: "mastered" | "learning" | "open";
  x: number;
  y: number;
};

export type Learner = {
  id: string;
  name: string;
};

export type LearnerMemory = {
  learnerId: string;
  preferredStyle: "short_plus_analogy";
  mastered: string[];
};

export type MemorySyncState = "checking" | "connected" | "syncing" | "synced" | "offline";

export type RetrievedLearnerMemory = {
  available: boolean;
  hasRewardSignal: boolean;
  evidence: string[];
};

export type QAEntry = {
  id: string;
  question: string;
  answer: string;
  pending?: boolean;
  error?: boolean;
};

export type AppNotification = {
  id: string;
  text: string;
  detail?: string;
  at: number;
  read: boolean;
};

export type FeedbackValue = "up" | "down";

export const DEFAULT_LEARNER: Learner = { id: "sam", name: "Sam" };

export const READING_GOAL_HOURS = 3;

export const PAPER_META = {
  cortical: {
    shortTitle: "Paper 1",
    title: "Embodied Neurocomputation",
    authors: "Cortical Labs · 2023",
    progress: 68,
  },
  td: {
    shortTitle: "Paper 2",
    title: "Temporal-Difference Learning",
    authors: "Sutton & Barto · 2018",
    progress: 38,
  },
} as const;

export function initialMemory(learnerId: string): LearnerMemory {
  return { learnerId, preferredStyle: "short_plus_analogy", mastered: [] };
}

function storageKey(base: string, learnerId: string) {
  return `gloss-${base}-${learnerId}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

/* ── learner (demo auth) ─────────────────────────────────────────── */

export const learnerStore = {
  read(): Learner {
    return readJSON<Learner>("gloss-learner", DEFAULT_LEARNER);
  },
  write(learner: Learner) {
    writeJSON("gloss-learner", learner);
  },
  toId(name: string) {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "learner"
    );
  },
};

/* ── local learner memory + EverOS bridge ────────────────────────── */

export const memoryAdapter = {
  read(learnerId: string): LearnerMemory {
    return readJSON(storageKey("memory", learnerId), initialMemory(learnerId));
  },
  write(memory: LearnerMemory) {
    writeJSON(storageKey("memory", memory.learnerId), memory);
  },
  reset(learnerId: string) {
    window.localStorage.removeItem(storageKey("memory", learnerId));
  },
  async retrieve(learnerId: string, query: string): Promise<RetrievedLearnerMemory> {
    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retrieve", learnerId, query }),
    });
    const result = (await response.json()) as RetrievedLearnerMemory & { error?: string };
    if (!response.ok) throw new Error(result.error || "EverOS retrieval failed");
    return result;
  },
  async confirm({
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
    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", learnerId, concept, understanding, learnedFrom }),
    });
    const result = (await response.json()) as { available: boolean; status?: string; error?: string };
    if (!response.ok) throw new Error(result.error || "EverOS write failed");
    return result;
  },
  async ask({
    learnerId,
    question,
    context,
    source,
  }: {
    learnerId: string;
    question: string;
    context: string;
    source: string;
  }): Promise<string> {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId, question, context, source }),
    });
    const result = (await response.json()) as { answer?: string; error?: string };
    if (!response.ok || !result.answer) throw new Error(result.error || "Tutor is unavailable");
    return result.answer;
  },
};

/* ── explanation feedback ────────────────────────────────────────── */

export const feedbackStore = {
  read(learnerId: string): Record<string, FeedbackValue> {
    return readJSON(storageKey("feedback", learnerId), {});
  },
  write(learnerId: string, feedback: Record<string, FeedbackValue>) {
    writeJSON(storageKey("feedback", learnerId), feedback);
  },
};

/* ── reading time ────────────────────────────────────────────────── */

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const readingTimeStore = {
  read(learnerId: string): number {
    return readJSON(storageKey(`time-${todayKey()}`, learnerId), 0);
  },
  add(learnerId: string, seconds: number): number {
    const total = readingTimeStore.read(learnerId) + seconds;
    writeJSON(storageKey(`time-${todayKey()}`, learnerId), total);
    return total;
  },
};

export function formatHours(seconds: number) {
  return (seconds / 3600).toFixed(1);
}

/* ── graph data ──────────────────────────────────────────────────── */

export const BASE_CONCEPTS: Concept[] = [
  { id: "sensor", label: "Sensory\nfeedback", paper: "cortical", status: "mastered", x: 68, y: 72 },
  { id: "closed-loop", label: "Closed-loop\nlearning", paper: "cortical", status: "mastered", x: 146, y: 118 },
  { id: "action", label: "Action\nspace", paper: "cortical", status: "mastered", x: 58, y: 176 },
  { id: "reward", label: "Reward\nsignal", paper: "cortical", status: "learning", x: 175, y: 54 },
  { id: "prediction", label: "Prediction", paper: "td", status: "learning", x: 276, y: 83 },
  { id: "td-error", label: "TD error", paper: "td", status: "open", x: 323, y: 154 },
  { id: "update", label: "Update\nrule", paper: "td", status: "open", x: 251, y: 213 },
];
