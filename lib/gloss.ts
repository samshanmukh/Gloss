export type PaperId = "cortical" | "td";

export type Concept = {
  id: string;
  label: string;
  paper: PaperId;
  status: "mastered" | "learning" | "open";
  x: number;
  y: number;
};

export type LearnerMemory = {
  learnerId: "sam";
  preferredStyle: "short_plus_analogy";
  mastered: string[];
};

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

export const INITIAL_MEMORY: LearnerMemory = {
  learnerId: "sam",
  preferredStyle: "short_plus_analogy",
  mastered: [],
};

const STORAGE_KEY = "gloss-demo-memory";

export const memoryAdapter = {
  read(): LearnerMemory {
    if (typeof window === "undefined") return INITIAL_MEMORY;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return INITIAL_MEMORY;
    try {
      return JSON.parse(stored) as LearnerMemory;
    } catch {
      return INITIAL_MEMORY;
    }
  },
  write(memory: LearnerMemory) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  },
  reset() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};

export const BASE_CONCEPTS: Concept[] = [
  { id: "sensor", label: "Sensory\nfeedback", paper: "cortical", status: "mastered", x: 68, y: 72 },
  { id: "closed-loop", label: "Closed-loop\nlearning", paper: "cortical", status: "mastered", x: 146, y: 118 },
  { id: "action", label: "Action\nspace", paper: "cortical", status: "mastered", x: 58, y: 176 },
  { id: "reward", label: "Reward\nsignal", paper: "cortical", status: "learning", x: 175, y: 54 },
  { id: "prediction", label: "Prediction", paper: "td", status: "learning", x: 276, y: 83 },
  { id: "td-error", label: "TD error", paper: "td", status: "open", x: 323, y: 154 },
  { id: "update", label: "Update\nrule", paper: "td", status: "open", x: 251, y: 213 },
];
