"use client";

import {
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  CornerDownLeft,
  Ellipsis,
  FileText,
  FileUp,
  Focus,
  GraduationCap,
  Highlighter,
  Library,
  Link2,
  ListTree,
  Loader2,
  LogOut,
  Menu,
  Minus,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Save,
  Sparkles,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import PdfReader, { PdfPageContext, PdfSelectedContent } from "@/components/PdfReader";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  AppNotification,
  BASE_CONCEPTS,
  DEFAULT_LEARNER,
  ExplainedConcept,
  FeedbackValue,
  KnowledgeEdge,
  KnowledgeGraph,
  Learner,
  MemorySyncState,
  PAPER_META,
  PaperId,
  QAEntry,
  READING_GOAL_HOURS,
  ReadingNote,
  SourceId,
  VoiceTutorResponse,
  conceptStore,
  feedbackStore,
  findConceptMatches,
  formatHours,
  graphStore,
  initialMemory,
  learnerStore,
  memoryAdapter,
  normalizeConceptPhrase,
  noteStore,
  pdfStore,
  readingTimeStore,
} from "@/lib/gloss";

type GraphTab = "graph" | "timeline" | "list";
type OpenMenu = "bell" | "more" | "avatar" | null;
type NavView = "library" | "knowledge" | "notes" | "memory";
type ReadingPanel = "explain" | "notes";

const PAPER_COPY = {
  cortical: {
    kicker: "3.1 · Closed-loop learning",
    title: "Embodied Neurocomputation",
    intro:
      "We investigated how biological neural networks can embody goal-directed behavior through a closed-loop simulated environment.",
    selection:
      "The cultures were guided by a scalar sensor value referred to as odor, which increased as the agent moved toward its target.",
    after:
      "This signal provided compact feedback about whether the most recent action improved the agent’s position.",
    caption: "Figure 2 · Closed-loop interaction between the neural culture and its environment.",
    explanation:
      "Think of the odor value like the warmth in a game of hot-and-cold. One number tells the agent whether its latest move brought it closer to the goal.",
    conceptPhrase: "odor",
  },
  td: {
    kicker: "3.2 · Temporal-difference learning",
    title: "Learning to Predict by Experience",
    intro:
      "Temporal-difference learning is a class of model-free reinforcement-learning methods. Like Monte Carlo methods, TD methods learn directly from experience.",
    selection:
      "The TD error is the difference between successive estimates. It can be seen as a measure of how much better or worse than expected the most recent reward was.",
    after:
      "This error is used to update value estimates toward the outcome that was actually observed.",
    caption: "Figure 3 · The TD error compares predicted and received outcomes to update our estimates.",
    explanation:
      "You already understood the reward signal from the Cortical Labs paper — the value that tells the agent whether an action went well. TD error is the surprise: the gap between the reward it expected and what it actually got. It nudges the next prediction toward reality.",
    conceptPhrase: "TD error",
  },
} as const;

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export default function GlossApp() {
  const [learner, setLearner] = useState<Learner | null>(DEFAULT_LEARNER);
  const [signInOpen, setSignInOpen] = useState(false);
  const [activeView, setActiveView] = useState<NavView>("library");
  const [source, setSource] = useState<SourceId>("cortical");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfSelection, setPdfSelection] = useState<PdfSelectedContent | null>(null);
  const [pdfPageContext, setPdfPageContext] = useState<PdfPageContext | null>(null);
  const [pdfFocusPage, setPdfFocusPage] = useState<number | undefined>();
  const [memory, setMemory] = useState(initialMemory(DEFAULT_LEARNER.id));
  const [readingPanel, setReadingPanel] = useState<ReadingPanel | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [crossPaperConnected, setCrossPaperConnected] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph>({ nodes: [], edges: [] });
  const [noteSyncing, setNoteSyncing] = useState(false);
  const [noteFocusTick, setNoteFocusTick] = useState(0);
  const [syncState, setSyncState] = useState<MemorySyncState>("checking");
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([]);
  const [concepts, setConcepts] = useState<ExplainedConcept[]>([]);
  // Synchronous mirror of `concepts` so find-or-create/increment logic never
  // reads a stale render snapshot between batched updates.
  const conceptsRef = useRef<ExplainedConcept[]>([]);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const learnerId = learner?.id ?? DEFAULT_LEARNER.id;

  const notify = useCallback((text: string, detail?: string) => {
    setNotifications((current) => [
      { id: nextId("ntf"), text, detail, at: Date.now(), read: false },
      ...current.slice(0, 19),
    ]);
  }, []);

  /* ── bootstrap for the active learner ── */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedLearner = learnerStore.read();
      setLearner(storedLearner);
      loadLearner(storedLearner);
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap of the stored learner
  }, []);

  function loadLearner(active: Learner) {
    const stored = memoryAdapter.read(active.id);
    setMemory(stored);
    setConfirmed(stored.mastered.includes("reward_signal"));
    setFeedback(feedbackStore.read(active.id));
    replaceConcepts(conceptStore.read(active.id));
    setActiveConceptId(null);
    setNotes(noteStore.read(active.id));
    setKnowledgeGraph(graphStore.read(active.id));
    setReadingSeconds(readingTimeStore.read(active.id));
    const params = new URLSearchParams(window.location.search);
    const requestedPaper = params.get("paper");
    const requestedPdf = params.get("pdf");
    const requestedPanel = params.get("panel");
    if (requestedPaper === "cortical" || requestedPaper === "td") setSource(requestedPaper);
    if (requestedPanel === "notes") {
      setReadingPanel("notes");
      setActiveView("notes");
    }
    void (requestedPdf ? pdfStore.get(active.id, requestedPdf) : pdfStore.read(active.id))
      .then((storedPdf) => {
        setPdfFile(storedPdf);
        if (requestedPdf && storedPdf) setSource("pdf");
      })
      .catch(() => setPdfFile(null));
    setSyncState("checking");
    void memoryAdapter
      .retrieve(active.id, "confirmed concepts, learning style, and understanding of reward signals")
      .then((remote) => {
        if (remote.hasRewardSignal) {
          const merged = {
            ...stored,
            mastered: Array.from(new Set([...stored.mastered, "reward_signal"])),
          };
          setMemory(merged);
          setConfirmed(true);
          memoryAdapter.write(merged);
        }
        setSyncState("connected");
      })
      .catch(() => setSyncState("offline"));
  }

  /* ── reading time ── */
  useEffect(() => {
    if (!learner) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setReadingSeconds(readingTimeStore.add(learner.id, 5));
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [learner]);

  /* ── global shortcuts ── */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setOpenMenu(null);
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const personalized = source === "td" && memory.mastered.includes("reward_signal");
  async function openPaper(next: PaperId) {
    setActiveView("library");
    setSource(next);
    setReadingPanel(null);
    setPdfSelection(null);
    setQaEntries([]);
    setActiveConceptId(null);
    setCrossPaperConnected(next === "td" && memory.mastered.includes("reward_signal"));
    setNote("");
    if (next === "td") {
      setSyncState("checking");
      try {
        const remote = await memoryAdapter.retrieve(
          learnerId,
          "What has this learner already mastered that relates to rewards, predictions, and temporal-difference learning?",
        );
        if (remote.hasRewardSignal) {
          const merged = {
            ...memory,
            mastered: Array.from(new Set([...memory.mastered, "reward_signal"])),
          };
          setMemory(merged);
          setConfirmed(true);
          memoryAdapter.write(merged);
        }
        setSyncState("connected");
      } catch {
        setSyncState("offline");
      }
    }
  }

  async function openPdf(file: File) {
    setPdfFile(file);
    setSource("pdf");
    setReadingPanel(null);
    setPdfSelection(null);
    setQaEntries([]);
    setActiveConceptId(null);
    setNote("");
    setActiveView("library");
    try {
      const id = await pdfStore.write(learnerId, file);
      window.history.replaceState(null, "", `/reader?pdf=${encodeURIComponent(id)}`);
      notify("PDF saved to your private library", `${file.name} will be restored after refresh`);
    } catch {
      notify("PDF opened for this session", "Browser storage could not persist the file");
    }
  }

  function replaceConcepts(next: ExplainedConcept[]) {
    conceptsRef.current = next;
    setConcepts(next);
  }

  function updateConcepts(mutate: (current: ExplainedConcept[]) => ExplainedConcept[]) {
    const next = mutate(conceptsRef.current);
    replaceConcepts(next);
    conceptStore.write(learnerId, next);
  }

  /** Find-or-create the persistent concept for a phrase; revisits bump the counter. */
  function rememberConcept(phrase: string, context: { sourceTitle: string; page?: number }): ExplainedConcept {
    const normalized = normalizeConceptPhrase(phrase);
    const existing = conceptsRef.current.find((concept) => normalizeConceptPhrase(concept.phrase) === normalized);
    if (existing) {
      const visited = { ...existing, visits: existing.visits + 1, updatedAt: Date.now() };
      updateConcepts((current) => current.map((concept) => (concept.id === visited.id ? visited : concept)));
      return visited;
    }
    const created: ExplainedConcept = {
      id: nextId("concept"),
      learnerId,
      phrase: phrase.trim(),
      sourceTitle: context.sourceTitle,
      page: context.page,
      visits: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thread: [],
    };
    updateConcepts((current) => [...current, created]);
    return created;
  }

  function appendToConceptThread(conceptId: string, entry: QAEntry) {
    updateConcepts((current) =>
      current.map((concept) =>
        concept.id === conceptId
          ? { ...concept, thread: [...concept.thread, entry], updatedAt: Date.now() }
          : concept,
      ),
    );
  }

  /** A familiarity highlight was clicked: reopen that concept's saved conversation. */
  function openConcept(conceptId: string, page?: number) {
    const concept = conceptsRef.current.find((item) => item.id === conceptId);
    if (!concept) return;
    updateConcepts((current) =>
      current.map((item) =>
        item.id === conceptId ? { ...item, visits: item.visits + 1, updatedAt: Date.now() } : item,
      ),
    );
    // Keep the visible thread when re-opening the already-active concept so an
    // in-flight "Thinking…" entry isn't dropped mid-answer.
    if (activeConceptId !== conceptId) setQaEntries(concept.thread);
    setActiveConceptId(conceptId);
    if (source === "pdf") {
      setPdfSelection({
        id: `concept-${concept.id}`,
        kind: "text",
        text: concept.phrase,
        page: page ?? concept.page ?? 1,
      });
    }
    setReadingPanel("explain");
    setActiveView("library");
  }

  function explainSelection() {
    setReadingPanel("explain");
    if (source !== "pdf") {
      const copy = PAPER_COPY[source];
      const concept = rememberConcept(copy.conceptPhrase, {
        sourceTitle: PAPER_META[source].title,
        page: 12,
      });
      if (activeConceptId !== concept.id) setQaEntries(concept.thread);
      setActiveConceptId(concept.id);
    }
    if (source === "td" && memory.mastered.includes("reward_signal")) {
      window.setTimeout(() => setCrossPaperConnected(true), 400);
    }
  }

  function contextualExplain() {
    if (source !== "pdf") {
      explainSelection();
      return;
    }
    setReadingPanel("explain");
    if (pdfSelection) return;
    if (pdfPageContext?.text.trim()) {
      const pageSelection: PdfSelectedContent = {
        id: `page-${pdfPageContext.page}-${Date.now()}`,
        kind: "text",
        text: pdfPageContext.text.slice(0, 8_000),
        page: pdfPageContext.page,
      };
      setPdfSelection(pageSelection);
      setQaEntries([]);
      void askQuestion(
        `Summarize page ${pdfPageContext.page}. Explain its main claim, important evidence, and any terms I should understand.`,
        { selection: pageSelection, conceptId: null, thread: [] },
      );
      return;
    }
    notify(
      pdfPageContext?.ocrState === "running" ? "OCR is still reading this page" : "Select something to explain",
      pdfPageContext?.ocrState === "running"
        ? "Wait for OCR to finish, then Explain can summarize the page."
        : "Highlight text or use Explain this on a detected figure or formula.",
    );
  }

  function onPdfSelect(selection: PdfSelectedContent) {
    setPdfSelection(selection);
    setReadingPanel("explain");

    // Text selections feed the familiarity loop: find-or-create the concept
    // and resume its saved conversation instead of starting fresh.
    if (selection.kind === "text") {
      const concept = rememberConcept(selection.text, {
        sourceTitle: pdfFile?.name ?? "Uploaded PDF",
        page: selection.page,
      });
      if (activeConceptId !== concept.id) setQaEntries(concept.thread);
      setActiveConceptId(concept.id);
      if (concept.thread.length === 0) {
        void askQuestion("Explain this passage in simple terms.", {
          selection,
          conceptId: concept.id,
          thread: concept.thread,
        });
      }
      return;
    }

    // Figures and formulas have no phrase to highlight — plain multimodal explanation.
    setActiveConceptId(null);
    setQaEntries([]);
    void askQuestion(
      selection.kind === "image"
        ? "Explain this figure or diagram. Walk through its important labels, arrows, and relationships."
        : "Explain this formula in simple terms, including what each symbol means and why it matters.",
      { selection, conceptId: null, thread: [] },
    );
  }

  async function askQuestion(
    question: string,
    options?: { selection?: PdfSelectedContent; conceptId?: string | null; thread?: QAEntry[] },
  ) {
    const active = options?.selection ?? pdfSelection;
    const conceptId = options?.conceptId === undefined ? activeConceptId : options.conceptId;
    const priorEntries = options?.thread ?? qaEntries;
    const entry: QAEntry = { id: nextId("qa"), question, answer: "", pending: true };
    setQaEntries((current) => [...current, entry]);

    const passage =
      source === "pdf"
        ? active?.text ?? ""
        : `${PAPER_COPY[source as PaperId].selection} ${PAPER_COPY[source as PaperId].after}`;
    const paperTitle =
      source === "pdf"
        ? `${pdfFile?.name ?? "Uploaded PDF"} (page ${active?.page ?? "?"})`
        : PAPER_META[source as PaperId].title;
    const history = priorEntries
      .filter((item) => !item.pending && !item.error)
      .flatMap((item) => [
        { role: "user" as const, content: item.question },
        { role: "assistant" as const, content: item.answer },
      ]);

    try {
      const answer = await memoryAdapter.ask({ learnerId, question, passage, paperTitle, history, imageData: active?.imageData });
      setQaEntries((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, answer, pending: false } : item)),
      );
      if (conceptId) appendToConceptThread(conceptId, { ...entry, answer, pending: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The tutor is unavailable right now.";
      setQaEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, answer: message, pending: false, error: true } : item,
        ),
      );
    }
  }

  function handleVoiceComplete(response: VoiceTutorResponse) {
    const entry: QAEntry = {
      id: nextId("voice"),
      question: `Voice · ${response.transcript}`,
      answer: response.answer,
    };
    setQaEntries((current) => [...current, entry]);
    if (activeConceptId) appendToConceptThread(activeConceptId, entry);
    notify(
      "Voice answer ready",
      response.privacy.transcriptStored ? "Transcript saved to EverOS" : "Raw audio and transcript were not stored",
    );
  }

  async function confirmUnderstanding() {
    const conceptId =
      source === "cortical" ? "reward_signal" : source === "td" ? "td_error" : `pdf:${(pdfSelection?.text ?? "passage").slice(0, 48)}`;
    if (memory.mastered.includes(conceptId)) return;
    const next = { ...memory, mastered: Array.from(new Set([...memory.mastered, conceptId])) };
    setMemory(next);
    memoryAdapter.write(next);
    if (source === "cortical") setConfirmed(true);
    setSyncState("syncing");

    const concept =
      source === "cortical"
        ? "reward signal"
        : source === "td"
          ? "temporal-difference error"
          : (pdfSelection?.text ?? "selected passage").slice(0, 80);
    const understanding =
      source === "cortical"
        ? "a scalar feedback value that tells an agent whether its latest action moved it closer to its goal"
        : source === "td"
          ? "the surprise gap between the reward an agent expected and the reward it actually received"
          : qaEntries.find((entry) => !entry.error && entry.answer)?.answer.slice(0, 240) ??
            "confirmed understanding of a selected passage";
    const learnedFrom = source === "pdf" ? pdfFile?.name ?? "Uploaded PDF" : PAPER_META[source].title;

    try {
      await memoryAdapter.confirm({ learnerId, concept, understanding, learnedFrom });
      setSyncState("synced");
      notify("Concept saved to EverOS", concept);
    } catch {
      setSyncState("offline");
      notify("Saved on this device", "EverOS is unreachable — memory kept locally");
    }
    if (source === "td") {
      window.setTimeout(() => setCrossPaperConnected(true), 300);
    }
  }

  function setFeedbackValue(key: string, value: FeedbackValue) {
    const next: Record<string, FeedbackValue> = {
      ...feedback,
      [key]: feedback[key] === value ? undefined : value,
    } as Record<string, FeedbackValue>;
    if (!next[key]) delete next[key];
    setFeedback(next);
    feedbackStore.write(learnerId, next);
  }

  function currentNoteContext() {
    if (source === "pdf") {
      return {
        sourceTitle: pdfFile?.name ?? "Uploaded PDF",
        passage: pdfSelection?.text,
        page: pdfSelection?.page,
      };
    }
    return {
      sourceTitle: PAPER_META[source].title,
      passage: PAPER_COPY[source].selection,
      page: 12,
    };
  }

  async function saveNote(content: string, existingId?: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = Date.now();
    const previous = existingId ? notes.find((item) => item.id === existingId) : undefined;
    const context = currentNoteContext();
    const saved: ReadingNote = {
      id: previous?.id ?? nextId("note"),
      learnerId,
      content: trimmed,
      sourceId: source,
      sourceTitle: context.sourceTitle,
      passage: context.passage,
      page: context.page,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    const nextNotes = previous
      ? notes.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...notes];
    setNotes(nextNotes);
    noteStore.write(learnerId, nextNotes);
    setNote("");
    setNoteSyncing(true);

    try {
      const cleanGraph: KnowledgeGraph = {
        nodes: knowledgeGraph.nodes.filter((node) => !node.id.includes(saved.id.slice(-18))),
        edges: knowledgeGraph.edges.filter((edge) => edge.sourceNoteId !== saved.id),
      };
      const [extracted] = await Promise.all([
        graphStore.extract(saved, cleanGraph.nodes),
        noteStore.sync(saved, "upsert"),
      ]);
      const merged: KnowledgeGraph = {
        nodes: [...cleanGraph.nodes, ...extracted.nodes],
        edges: [...cleanGraph.edges, ...extracted.edges],
      };
      setKnowledgeGraph(merged);
      graphStore.write(learnerId, merged);
      notify("Note saved and mapped", `${extracted.nodes.length} concepts added from ${saved.sourceTitle}`);
    } catch {
      notify("Note saved locally", "EverOS or AI extraction is temporarily unavailable");
    } finally {
      setNoteSyncing(false);
    }
  }

  async function deleteNote(noteToDelete: ReadingNote) {
    const nextNotes = notes.filter((item) => item.id !== noteToDelete.id);
    const nextGraph: KnowledgeGraph = {
      nodes: knowledgeGraph.nodes.filter((node) => !node.id.includes(noteToDelete.id.slice(-18))),
      edges: knowledgeGraph.edges.filter((edge) => edge.sourceNoteId !== noteToDelete.id),
    };
    setNotes(nextNotes);
    setKnowledgeGraph(nextGraph);
    noteStore.write(learnerId, nextNotes);
    graphStore.write(learnerId, nextGraph);
    try {
      await noteStore.sync(noteToDelete, "delete");
      notify("Note deleted", `Removed from ${noteToDelete.sourceTitle}`);
    } catch {
      notify("Note deleted locally", "EverOS deletion marker could not be synced");
    }
  }

  function resetDemo() {
    memoryAdapter.reset(learnerId);
    noteStore.write(learnerId, []);
    graphStore.write(learnerId, { nodes: [], edges: [] });
    conceptStore.write(learnerId, []);
    void pdfStore.clear(learnerId);
    setMemory(initialMemory(learnerId));
    replaceConcepts([]);
    setActiveConceptId(null);
    setNotes([]);
    setKnowledgeGraph({ nodes: [], edges: [] });
    setPdfFile(null);
    setSource("cortical");
    setReadingPanel(null);
    setConfirmed(false);
    setCrossPaperConnected(false);
    setQaEntries([]);
    setPdfSelection(null);
    setSyncState("connected");
    setOpenMenu(null);
    setActiveView("library");
    notify("Demo reset", "Local memory cleared for this learner");
  }

  function switchLearner(next: Learner) {
    learnerStore.write(next);
    setLearner(next);
    setSignInOpen(false);
    setSource("cortical");
    setActiveView("library");
    setReadingPanel(null);
    setCrossPaperConnected(false);
    setQaEntries([]);
    setNotifications([]);
    loadLearner(next);
    notify(`Signed in as ${next.name}`, "Your memory and progress follow this profile");
  }

  function signOut() {
    setLearner(null);
    setOpenMenu(null);
    setSignInOpen(true);
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  function openKnowledge() {
    setActiveView("knowledge");
    window.location.assign("/knowledge");
  }

  function closeReadingPanel() {
    setReadingPanel(null);
    setActiveView("library");
  }

  return (
    <main className="app-shell" onClick={() => setOpenMenu(null)}>
      <Sidebar
        activeView={activeView}
        source={source}
        pdfName={pdfFile?.name ?? null}
        learner={learner}
        onOpenPaper={openPaper}
        onOpenPdf={() => {
          if (pdfFile) {
            setSource("pdf");
            setActiveView("library");
            setReadingPanel(null);
            setPdfSelection(null);
            setQaEntries([]);
          }
        }}
        onUpload={openPdf}
        onLibrary={() => {
          setActiveView("library");
          window.location.assign("/library");
        }}
        onKnowledge={openKnowledge}
        onNotes={() => {
          setActiveView("notes");
          setReadingPanel("notes");
        }}
        onMemory={() => {
          setActiveView("memory");
          window.location.assign("/memory");
        }}
        onReset={resetDemo}
        confirmed={confirmed}
        syncState={syncState}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      <section className="workspace">
        <Header
          source={source}
          pdfName={pdfFile?.name ?? null}
          learner={learner}
          notifications={notifications}
          unreadCount={unreadCount}
          openMenu={openMenu}
          onMenu={setOpenMenu}
          onMarkRead={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))}
          onExplain={contextualExplain}
          onTakeNote={() => {
            setActiveView("notes");
            setReadingPanel("explain");
            setNoteFocusTick((tick) => tick + 1);
          }}
          onSearch={() => setPaletteOpen(true)}
          onReset={resetDemo}
          onSignOut={signOut}
          onSwitchLearner={() => setSignInOpen(true)}
        />
        <div className={`reading-grid ${readingPanel ? "with-explanation" : "paper-only"}`}>
          {source === "pdf" && pdfFile ? (
            <PdfReader
              key={`${pdfFile.name}-${pdfFile.size}`}
              file={pdfFile}
              concepts={concepts}
              onSelectContent={onPdfSelect}
              onClearSelection={() => {
                setPdfSelection(null);
                setActiveConceptId(null);
              }}
              onConceptClick={openConcept}
              onPageContext={setPdfPageContext}
              focusPage={pdfFocusPage}
            />
          ) : (
            <PaperPane
              paper={source as PaperId}
              explained={readingPanel === "explain"}
              concepts={concepts}
              onExplain={explainSelection}
              onConceptClick={openConcept}
            />
          )}
          {readingPanel && (
            <ExplanationPane
              source={source}
              pdfSelection={pdfSelection}
              activeConcept={concepts.find((concept) => concept.id === activeConceptId) ?? null}
              explained={readingPanel === "explain"}
              activePanel={readingPanel}
              personalized={personalized}
              confirmed={
                source === "cortical"
                  ? confirmed
                  : source === "td"
                    ? memory.mastered.includes("td_error")
                    : memory.mastered.some((id) => id.startsWith("pdf:"))
              }
              syncState={syncState}
              note={note}
              notes={notes}
              noteSyncing={noteSyncing}
              noteFocusTick={noteFocusTick}
              qaEntries={qaEntries}
              feedback={feedback}
              voiceContext={{
                learnerId,
                passage:
                  source === "pdf"
                    ? pdfSelection?.text ?? ""
                    : `${PAPER_COPY[source as PaperId].selection} ${PAPER_COPY[source as PaperId].after}`,
                paperTitle:
                  source === "pdf"
                    ? `${pdfFile?.name ?? "Uploaded PDF"} (page ${pdfSelection?.page ?? "?"})`
                    : PAPER_META[source as PaperId].title,
              }}
              onFeedback={setFeedbackValue}
              onVoiceComplete={handleVoiceComplete}
              onAsk={(question) => void askQuestion(question)}
              onNote={setNote}
              onSaveNote={(content, id) => void saveNote(content, id)}
              onDeleteNote={(savedNote) => void deleteNote(savedNote)}
              onPanelChange={(panel) => {
                setReadingPanel(panel);
                setActiveView(panel === "notes" ? "notes" : "library");
              }}
              onConfirm={() => void confirmUnderstanding()}
              onClose={closeReadingPanel}
              onCitationClick={(page) => {
                setPdfFocusPage(page);
                window.setTimeout(() => setPdfFocusPage(undefined), 0);
              }}
            />
          )}
        </div>
        <ProgressBar
          source={source}
          confirmed={confirmed}
          crossPaper={crossPaperConnected}
          masteredCount={memory.mastered.length}
          readingSeconds={readingSeconds}
          learnerName={learner?.name ?? "reader"}
        />
      </section>

      {paletteOpen && (
        <CommandPalette
          learnerId={learnerId}
          mastered={memory.mastered}
          note={note}
          onClose={() => setPaletteOpen(false)}
          onOpenPaper={(paper) => void openPaper(paper)}
          onOpenConcept={(conceptId) => openConcept(conceptId)}
        />
      )}

      {(signInOpen || !learner) && (
        <SignInModal
          current={learner}
          onCancel={learner ? () => setSignInOpen(false) : undefined}
          onSubmit={switchLearner}
        />
      )}
    </main>
  );
}

/* ── sidebar ─────────────────────────────────────────────────────── */

function Sidebar({
  activeView,
  source,
  pdfName,
  learner,
  onOpenPaper,
  onOpenPdf,
  onUpload,
  onLibrary,
  onKnowledge,
  onNotes,
  onMemory,
  onReset,
  confirmed,
  syncState,
  collapsed,
  onToggle,
}: {
  activeView: NavView;
  source: SourceId;
  pdfName: string | null;
  learner: Learner | null;
  onOpenPaper: (paper: PaperId) => void;
  onOpenPdf: () => void;
  onUpload: (file: File) => void;
  onLibrary: () => void;
  onKnowledge: () => void;
  onNotes: () => void;
  onMemory: () => void;
  onReset: () => void;
  confirmed: boolean;
  syncState: MemorySyncState;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncMessage = {
    checking: "Retrieving learner memory…",
    connected: confirmed ? "Memory retrieved" : "Connected · ready",
    syncing: "Writing confirmed concept…",
    synced: "Concept saved to EverOS",
    offline: "Offline · saved on device",
  }[syncState];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} style={{ width: collapsed ? 72 : undefined, flexBasis: collapsed ? 72 : undefined }}>
      <div className="brand">
        <Link className="brand-home" href="/" aria-label="Go to the Gloss landing page">
          <div className="brand-mark"><Sparkles size={16} /></div>
          <div className="brand-copy"><strong>Gloss</strong><span>Read. Understand. Remember.</span></div>
        </Link>
        <button
          className="sidebar-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        <button className={activeView === "library" ? "active" : ""} onClick={onLibrary}><Library size={17} /> Library</button>
        <button className={activeView === "knowledge" ? "active" : ""} onClick={onKnowledge}><Network size={17} /> Knowledge</button>
        <button className={activeView === "notes" ? "active" : ""} onClick={onNotes}><StickyNote size={17} /> Notes</button>
        <button className={activeView === "memory" ? "active" : ""} onClick={onMemory}><BrainCircuit size={17} /> Memory</button>
      </nav>

      <p className="side-label">Your papers</p>
      {(Object.keys(PAPER_META) as PaperId[]).map((id) => (
        <button className={`paper-card ${source === id ? "selected" : ""}`} key={id} onClick={() => onOpenPaper(id)}>
          <FileText size={17} />
          <span>
            <strong>{PAPER_META[id].title}</strong>
            <small>{PAPER_META[id].authors}</small>
            <i><b style={{ width: `${PAPER_META[id].progress}%` }} /></i>
          </span>
        </button>
      ))}
      {pdfName && (
        <button className={`paper-card ${source === "pdf" ? "selected" : ""}`} onClick={onOpenPdf}>
          <FileUp size={17} />
          <span>
            <strong>{pdfName}</strong>
            <small>Uploaded PDF</small>
            <i><b style={{ width: "12%" }} /></i>
          </span>
        </button>
      )}
      <button className="upload-button" onClick={() => fileInputRef.current?.click()}>
        <FileUp size={14} /> Upload a PDF
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />

      <div className="profile-card">
        <div className="profile-heading"><GraduationCap size={17} /><strong>{learner?.name ?? "Reader"}’s learning profile</strong></div>
        <dl>
          <div><dt>Field</dt><dd>Neuroscience</dd></div>
          <div><dt>Level</dt><dd>Biology strong · ML new</dd></div>
          <div><dt>Style</dt><dd>Short · analogy first</dd></div>
        </dl>
      </div>
      <div className="sync-card">
        <span className={`sync-dot ${syncState !== "offline" ? "live" : ""} ${syncState}`} />
        <div><strong>EverOS memory</strong><small>{syncMessage}</small></div>
        {syncState === "synced" || syncState === "connected" ? <Check size={14} /> : <BrainCircuit size={14} />}
      </div>
      <button className="reset-button" onClick={onReset}><RotateCcw size={14} /> Reset local demo</button>
    </aside>
  );
}

/* ── header ──────────────────────────────────────────────────────── */

function relativeTime(at: number) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function Header({
  source,
  pdfName,
  learner,
  notifications,
  unreadCount,
  openMenu,
  onMenu,
  onMarkRead,
  onExplain,
  onTakeNote,
  onSearch,
  onReset,
  onSignOut,
  onSwitchLearner,
}: {
  source: SourceId;
  pdfName: string | null;
  learner: Learner | null;
  notifications: AppNotification[];
  unreadCount: number;
  openMenu: OpenMenu;
  onMenu: (menu: OpenMenu) => void;
  onMarkRead: () => void;
  onExplain: () => void;
  onTakeNote: () => void;
  onSearch: () => void;
  onReset: () => void;
  onSignOut: () => void;
  onSwitchLearner: () => void;
}) {
  const title = source === "pdf" ? pdfName ?? "Uploaded PDF" : PAPER_META[source].title;

  function toggle(menu: Exclude<OpenMenu, null>, event: React.MouseEvent) {
    event.stopPropagation();
    if (menu === "bell" && openMenu !== "bell") onMarkRead();
    onMenu(openMenu === menu ? null : menu);
  }

  return (
    <header className="topbar">
      <div className="reading-title"><BookOpen size={16} /> Reading: <strong>{title}</strong><ChevronDown size={14} /></div>
      <div className="top-actions">
        <button className="action-primary" onClick={onExplain}><Sparkles size={14} /> Explain</button>
        <button onClick={onTakeNote}><StickyNote size={14} /> Take note</button>
        <div className="menu-anchor">
          <button aria-label="More actions" onClick={(event) => toggle("more", event)}><Ellipsis size={14} /></button>
          {openMenu === "more" && (
            <div className="menu" onClick={(event) => event.stopPropagation()}>
              <button onClick={onReset}><RotateCcw size={13} /> Reset demo data</button>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href);
                  onMenu(null);
                }}
              >
                <Link2 size={13} /> Copy link to this app
              </button>
              <Link href="/"><Sparkles size={13} /> Project overview</Link>
              <a href="https://github.com/samshanmukh/gloss" target="_blank" rel="noreferrer">
                <BookOpen size={13} /> View source on GitHub
              </a>
            </div>
          )}
        </div>
      </div>
      <button className="search" onClick={onSearch}>
        <Search size={15} /><span>Search your knowledge</span><kbd>⌘ K</kbd>
      </button>
      <div className="menu-anchor">
        <button className="icon-button" aria-label="Notifications" onClick={(event) => toggle("bell", event)}>
          <Bell size={16} />
          {unreadCount > 0 && <i className="badge">{unreadCount}</i>}
        </button>
        {openMenu === "bell" && (
          <div className="menu notifications-menu" onClick={(event) => event.stopPropagation()}>
            <p className="menu-title">Notifications</p>
            {notifications.length ? (
              notifications.slice(0, 8).map((notification) => (
                <div className="notification" key={notification.id}>
                  <strong>{notification.text}</strong>
                  {notification.detail && <p>{notification.detail}</p>}
                  <small>{relativeTime(notification.at)}</small>
                </div>
              ))
            ) : (
              <p className="menu-empty">Nothing yet. Confirm a concept to see activity here.</p>
            )}
          </div>
        )}
      </div>
      <div className="menu-anchor">
        <button className="avatar" aria-label="Account" onClick={(event) => toggle("avatar", event)}>
          {(learner?.name ?? "?").slice(0, 1).toUpperCase()}
        </button>
        {openMenu === "avatar" && (
          <div className="menu avatar-menu" onClick={(event) => event.stopPropagation()}>
            <p className="menu-title">{learner?.name ?? "Signed out"}</p>
            <p className="menu-subtitle">Learner ID · {learner?.id ?? "—"}</p>
            <button onClick={onSwitchLearner}><UserRound size={13} /> Switch learner</button>
            <button onClick={onSignOut}><LogOut size={13} /> Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ── demo paper pane ─────────────────────────────────────────────── */

/** Text with every previously-explained phrase wrapped in a clickable familiarity mark. */
function ConceptText({
  text,
  concepts,
  onConceptClick,
}: {
  text: string;
  concepts: ExplainedConcept[];
  onConceptClick: (conceptId: string) => void;
}) {
  const matches = useMemo(() => findConceptMatches(text, concepts), [text, concepts]);
  if (!matches.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    parts.push(
      <mark
        key={`${match.concept.id}-${match.start}`}
        className="concept-highlight"
        role="button"
        tabIndex={0}
        title={`You asked about “${match.concept.phrase.slice(0, 80)}” before — click to revisit`}
        onClick={(event) => {
          event.stopPropagation();
          onConceptClick(match.concept.id);
        }}
        onKeyDown={(event) => event.key === "Enter" && onConceptClick(match.concept.id)}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    );
    cursor = match.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function PaperPane({
  paper,
  explained,
  concepts,
  onExplain,
  onConceptClick,
}: {
  paper: PaperId;
  explained: boolean;
  concepts: ExplainedConcept[];
  onExplain: () => void;
  onConceptClick: (conceptId: string) => void;
}) {
  const copy = PAPER_COPY[paper];
  return (
    <article className="paper-pane">
      <div className="reader-toolbar">
        <Menu size={15} /><span className="page-number">12</span><span>/ 36</span>
        <span className="toolbar-spacer" />
        <Search size={15} /><span>125%</span><ChevronDown size={13} /><Focus size={15} /><PanelRight size={15} />
      </div>
      <div className="paper-page">
        <p className="paper-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p><ConceptText text={copy.intro} concepts={concepts} onConceptClick={onConceptClick} /></p>
        <button className={`selected-passage ${explained ? "explained" : ""}`} onClick={onExplain}>
          {copy.selection}
          {!explained && <span className="explain-chip"><Sparkles size={13} /> Explain this</span>}
        </button>
        <p><ConceptText text={copy.after} concepts={concepts} onConceptClick={onConceptClick} /></p>
        {paper === "td" ? <TDFormula /> : <ClosedLoopFigure concepts={concepts} onConceptClick={onConceptClick} />}
        <small className="figure-caption"><ConceptText text={copy.caption} concepts={concepts} onConceptClick={onConceptClick} /></small>
        <div className="paper-footnote">
          <span>Gloss demo excerpt · Page 12</span>
          <button onClick={onExplain}><Sparkles size={14} /> Ask about this page</button>
        </div>
      </div>
    </article>
  );
}

function TDFormula() {
  return (
    <div className="paper-figure td-figure">
      <div className="formula">V(s<sub>t</sub>) ← V(s<sub>t</sub>) + α [r<sub>t+1</sub> + γV(s<sub>t+1</sub>) − V(s<sub>t</sub>)]</div>
      <div className="flow-diagram">
        <span className="flow-node blue">Current<br />estimate</span><b>→</b>
        <span className="flow-node green">Reward<br />received</span><b>→</b>
        <span className="flow-node orange">Next<br />estimate</span><b>→</b>
        <span className="flow-node purple">Updated<br />estimate</span>
      </div>
    </div>
  );
}

function ClosedLoopFigure({
  concepts,
  onConceptClick,
}: {
  concepts: ExplainedConcept[];
  onConceptClick: (conceptId: string) => void;
}) {
  return (
    <div className="paper-figure loop-figure">
      <div className="culture"><BrainCircuit size={30} /><strong>Neural culture</strong><span>chooses an action</span></div>
      <div className="loop-arrows"><span>action →</span><span>← scalar feedback</span></div>
      <div className="culture environment">
        <Focus size={30} /><strong>Environment</strong>
        <span><ConceptText text="returns “odor” value" concepts={concepts} onConceptClick={onConceptClick} /></span>
      </div>
    </div>
  );
}

/* ── explanation pane ────────────────────────────────────────────── */

function FeedbackRow({
  id,
  feedback,
  onFeedback,
}: {
  id: string;
  feedback: Record<string, FeedbackValue>;
  onFeedback: (key: string, value: FeedbackValue) => void;
}) {
  const value = feedback[id];
  return (
    <div className="feedback-row">
      <span>{value ? (value === "up" ? "Thanks — noted." : "Thanks — we’ll adjust.") : "Was this helpful?"}</span>
      <button
        className={value === "up" ? "on" : ""}
        aria-label="Helpful"
        onClick={() => onFeedback(id, "up")}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        className={value === "down" ? "on down" : ""}
        aria-label="Not helpful"
        onClick={() => onFeedback(id, "down")}
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}

function ExplanationPane({
  source,
  pdfSelection,
  activeConcept,
  explained,
  activePanel,
  personalized,
  confirmed,
  syncState,
  note,
  notes,
  noteSyncing,
  noteFocusTick,
  qaEntries,
  feedback,
  voiceContext,
  onFeedback,
  onVoiceComplete,
  onAsk,
  onNote,
  onSaveNote,
  onDeleteNote,
  onPanelChange,
  onConfirm,
  onClose,
  onCitationClick,
}: {
  source: SourceId;
  pdfSelection: PdfSelectedContent | null;
  activeConcept: ExplainedConcept | null;
  explained: boolean;
  activePanel: ReadingPanel;
  personalized: boolean;
  confirmed: boolean;
  syncState: MemorySyncState;
  note: string;
  notes: ReadingNote[];
  noteSyncing: boolean;
  noteFocusTick: number;
  qaEntries: QAEntry[];
  feedback: Record<string, FeedbackValue>;
  voiceContext: { learnerId: string; passage: string; paperTitle: string };
  onFeedback: (key: string, value: FeedbackValue) => void;
  onVoiceComplete: (response: VoiceTutorResponse) => void;
  onAsk: (question: string) => void;
  onNote: (note: string) => void;
  onSaveNote: (content: string, id?: string) => void;
  onDeleteNote: (note: ReadingNote) => void;
  onPanelChange: (panel: "explain" | "notes") => void;
  onConfirm: () => void;
  onClose: () => void;
  onCitationClick: (page: number) => void;
}) {
  const [question, setQuestion] = useState("");
  const [editingNote, setEditingNote] = useState<ReadingNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const isPdf = source === "pdf";
  const pending = qaEntries.some((entry) => entry.pending);

  useEffect(() => {
    if (noteFocusTick > 0) {
      window.setTimeout(() => {
        noteRef.current?.focus();
      }, 0);
    }
  }, [noteFocusTick]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [qaEntries.length, pending]);

  function submitQuestion() {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    onAsk(trimmed);
    setQuestion("");
  }

  const showEmpty = !explained || (isPdf && !pdfSelection);

  return (
    <section className="explanation-pane">
      <div className="panel-tabs">
        <button className={activePanel === "explain" ? "active" : ""} onClick={() => onPanelChange("explain")}>Explain</button>
        <button className={activePanel === "notes" ? "active" : ""} onClick={() => onPanelChange("notes")}>Notes ({notes.length})</button>
        <span />
        <button onClick={onClose} aria-label="Close panel"><X size={16} /></button>
      </div>
      {activePanel === "notes" ? (
        <div className="notes-panel">
          <div className="notes-composer">
            <textarea
              aria-label="Write a new note"
              placeholder="Write a note about what you are reading…"
              value={note}
              onChange={(event) => onNote(event.target.value)}
            />
            <button disabled={!note.trim() || noteSyncing} onClick={() => onSaveNote(note)}>
              {noteSyncing ? <Loader2 className="spin" size={13} /> : <Save size={13} />}
              Save note
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="notes-empty"><StickyNote size={22} /><strong>No notes yet</strong><p>Save a thought and Gloss will sync it to EverOS and map its concepts.</p></div>
          ) : (
            <div className="notes-list">
              {notes.map((savedNote) => (
                <article className="saved-note" key={savedNote.id}>
                  {editingNote?.id === savedNote.id ? (
                    <>
                      <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} />
                      <div className="note-actions">
                        <button onClick={() => setEditingNote(null)}>Cancel</button>
                        <button
                          className="primary"
                          disabled={!editContent.trim() || noteSyncing}
                          onClick={() => {
                            onSaveNote(editContent, savedNote.id);
                            setEditingNote(null);
                          }}
                        ><Save size={12} /> Save</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{savedNote.content}</p>
                      <footer>
                        <span>{savedNote.sourceTitle}{savedNote.page ? ` · p. ${savedNote.page}` : ""}</span>
                        <time>{new Date(savedNote.updatedAt).toLocaleDateString()}</time>
                      </footer>
                      <div className="note-actions">
                        <button onClick={() => { setEditingNote(savedNote); setEditContent(savedNote.content); }}>Edit</button>
                        <button className="danger" onClick={() => onDeleteNote(savedNote)}><Trash2 size={12} /> Delete</button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : showEmpty ? (
        <div className="empty-explanation">
          <div><Highlighter size={24} /></div>
          <h2>Select something you want to understand</h2>
          <p>
            {isPdf
              ? "Select any text in the PDF and Gloss will explain it, grounded in the page you are reading."
              : "Highlight a passage in the paper and Gloss will explain it using the source and what you already know."}
          </p>
        </div>
      ) : (
        <div className="explanation-content">
          <div className="trust-row"><span><Check size={14} /> Grounded in this paper</span><ChevronDown size={14} /></div>

          {activeConcept && activeConcept.visits > 0 && (
            <div className="familiar-banner pop-in">
              <Highlighter size={14} />
              <span>
                You’ve asked about <strong>“{activeConcept.phrase.slice(0, 60)}{activeConcept.phrase.length > 60 ? "…" : ""}”</strong> before
                — seen {activeConcept.visits + 1} times now. Your conversation continues below.
              </span>
            </div>
          )}

          {isPdf && pdfSelection ? (
            <>
              <p className="eyebrow">Selected {pdfSelection.kind} · page {pdfSelection.page}</p>
              <blockquote className="pdf-quote">
                {pdfSelection.text.slice(0, 280)}
                {pdfSelection.text.length > 280 ? "…" : ""}
              </blockquote>
            </>
          ) : (
            <>
              <p className="eyebrow">Explanation</p>
              <p className="answer">{PAPER_COPY[source as PaperId].explanation}</p>
              <div className="analogy-card">
                <span><Sparkles size={14} /> Analogy</span>
                <p>{source === "td"
                  ? "Like checking your GPS arrival time: the difference between the ETA and when you actually arrive helps the GPS improve its next estimate."
                  : "Like a thermostat getting one number back: warmer or colder. That tiny signal is enough to steer what it tries next."}</p>
              </div>
              <FeedbackRow id={`${source}-base`} feedback={feedback} onFeedback={onFeedback} />
            </>
          )}

          {personalized && !isPdf && (
            <div className="memory-section">
              <p className="eyebrow">Built on your knowledge</p>
              <div className="memory-card">
                <div className="memory-icon"><Link2 size={15} /></div>
                <div><strong>Reward signal</strong><p>Retrieved via EverOS · <em>Embodied Neurocomputation</em></p><button>View in graph →</button></div>
              </div>
            </div>
          )}

          {qaEntries.length > 0 && (
            <div className="qa-thread" ref={threadRef}>
              {qaEntries.map((entry) => (
                <div className="qa-entry" key={entry.id}>
                  <p className="qa-question"><UserRound size={12} /> {entry.question}</p>
                  {entry.pending ? (
                    <p className="qa-answer pending"><span className="dot-pulse" /> Thinking…</p>
                  ) : (
                    <>
                      <p className={`qa-answer ${entry.error ? "error" : ""}`}>{entry.answer}</p>
                      {!entry.error && (
                        <div className="answer-provenance">
                          <button onClick={() => onCitationClick(pdfSelection?.page ?? 12)}>
                            <FileText size={11} />
                            {pdfSelection ? `Page ${pdfSelection.page} · selected ${pdfSelection.kind}` : `Page 12 · source passage`}
                          </button>
                          <span className={/source (?:does not|doesn't|cannot|isn't)|general knowledge/i.test(entry.answer) ? "general" : "grounded"}>
                            {/source (?:does not|doesn't|cannot|isn't)|general knowledge/i.test(entry.answer) ? "Includes general knowledge" : "Verified against selection"}
                          </span>
                        </div>
                      )}
                      {!entry.error && <FeedbackRow id={entry.id} feedback={feedback} onFeedback={onFeedback} />}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="ask-row">
            <input
              value={question}
              placeholder="Ask a question about this…"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitQuestion()}
            />
            <VoiceRecorder
              learnerId={voiceContext.learnerId}
              passage={voiceContext.passage}
              paperTitle={voiceContext.paperTitle}
              disabled={!voiceContext.passage.trim() || pending}
              onComplete={onVoiceComplete}
            />
            <button aria-label="Ask" disabled={!question.trim() || pending} onClick={submitQuestion}>
              <CornerDownLeft size={14} />
            </button>
          </div>

          <div className="note-compose-inline">
            <textarea
              ref={noteRef}
              className="note-input"
              aria-label="Add a note"
              placeholder="Add a note in your own words…"
              value={note}
              onChange={(event) => onNote(event.target.value)}
            />
            <button aria-label="Save note" disabled={!note.trim() || noteSyncing} onClick={() => onSaveNote(note)}>
              {noteSyncing ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
            </button>
          </div>
          <div className="explanation-footer">
            <span>{confirmed
              ? syncState === "offline" ? "Saved on this device" : "Saved to your understanding"
              : "Does this make sense?"}</span>
            <button className={`understand-button ${confirmed ? "confirmed" : ""}`} onClick={onConfirm}>
              {confirmed ? <Check size={15} /> : <BrainCircuit size={15} />}
              {confirmed ? "Understood" : "Add to understanding"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── knowledge graph pane ────────────────────────────────────────── */

const GRAPH_WIDTH = 380;

export function GraphPane({
  paneRef,
  concepts,
  dynamicGraph,
  notes,
  mastered,
  activeTab,
  onTab,
  crossPaper,
}: {
  paneRef: React.RefObject<HTMLElement | null>;
  concepts: typeof BASE_CONCEPTS;
  dynamicGraph: KnowledgeGraph;
  notes: ReadingNote[];
  mastered: string[];
  activeTab: GraphTab;
  onTab: (tab: GraphTab) => void;
  crossPaper: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [viewportRect, setViewportRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseNodes = concepts.map((concept) => ({
    ...concept,
    label: concept.label.replace("\n", " "),
    summary: {
      sensor: "Information returned from the environment after an action.",
      "closed-loop": "A cycle where actions change the environment and feedback shapes the next action.",
      action: "The possible choices available to an agent.",
      reward: "A scalar value indicating how well the latest action performed.",
      prediction: "An estimate of future reward or value.",
      "td-error": "The gap between expected and observed outcomes.",
      update: "The rule that adjusts estimates using the TD error.",
    }[concept.id] ?? "A concept in your reading.",
    sourceTitle: PAPER_META[concept.paper].title,
    sourceType: "paper" as const,
  }));
  const dynamicNodes = dynamicGraph.nodes.map((node, index) => ({
    ...node,
    x: 70 + (index % 3) * 120,
    y: 300 + Math.floor(index / 3) * 95,
    paper: "note" as const,
  }));
  const allNodes = [...baseNodes, ...dynamicNodes];
  const graphHeight = Math.max(275, 375 + Math.max(0, Math.ceil(dynamicNodes.length / 3) - 1) * 95);
  const baseEdges: KnowledgeEdge[] = [
    { id: "base-1", from: "sensor", to: "closed-loop", relation: "provides feedback to" },
    { id: "base-2", from: "closed-loop", to: "action", relation: "selects from" },
    { id: "base-3", from: "closed-loop", to: "reward", relation: "uses" },
    { id: "base-4", from: "prediction", to: "td-error", relation: "is compared by" },
    { id: "base-5", from: "td-error", to: "update", relation: "drives" },
    ...(crossPaper ? [{ id: "cross-paper", from: "reward", to: "td-error", relation: "grounds understanding of" }] : []),
  ];
  const allEdges = [...baseEdges, ...dynamicGraph.edges];
  const selectedNode = allNodes.find((node) => node.id === selectedId);
  const selectedEdges = allEdges.filter((edge) => edge.from === selectedId || edge.to === selectedId);

  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const totalW = el.scrollWidth || 1;
    const totalH = el.scrollHeight || 1;
    setViewportRect({
      x: el.scrollLeft / totalW,
      y: el.scrollTop / totalH,
      w: Math.min(1, el.clientWidth / totalW),
      h: Math.min(1, el.clientHeight / totalH),
    });
  }, []);

  useEffect(() => {
    updateViewport();
  }, [zoom, activeTab, updateViewport]);

  function navigateMinimap(event: React.MouseEvent<SVGSVGElement>) {
    const el = scrollRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.scrollTo({
      left: Math.max(0, x * el.scrollWidth - el.clientWidth / 2),
      top: Math.max(0, y * el.scrollHeight - el.clientHeight / 2),
      behavior: "smooth",
    });
  }

  return (
    <aside className="graph-pane" ref={paneRef}>
      <div className="graph-header">
        <div><Network size={16} /><strong>Your knowledge</strong></div>
        <button aria-label="About the knowledge graph" onClick={() => setShowHelp((value) => !value)}><CircleHelp size={15} /></button>
      </div>
      {showHelp && <div className="graph-help pop-in">Notes are synced to EverOS, then Butterbase AI extracts grounded concepts and relationships. Click any node to inspect its source.</div>}
      <div className="graph-tabs">
        <button className={activeTab === "graph" ? "active" : ""} onClick={() => onTab("graph")}>Graph</button>
        <button className={activeTab === "timeline" ? "active" : ""} onClick={() => onTab("timeline")}>Timeline</button>
        <button className={activeTab === "list" ? "active" : ""} onClick={() => onTab("list")}>List</button>
      </div>

      {activeTab === "graph" && (
        <>
          <div className="graph-legend">
            <span><i className="paper-one" /> Paper 1</span><span><i className="paper-two" /> Paper 2</span><span><i className="note" /> Notes</span><span><i className="mastered" /> Mastered</span>
          </div>
          <div className="knowledge-canvas zoomable" ref={scrollRef} onScroll={updateViewport}>
            <svg
              viewBox={`0 0 ${GRAPH_WIDTH} ${graphHeight}`}
              style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
              role="img"
              aria-label="Knowledge graph connecting concepts from two papers"
            >
              <defs>
                <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L7,3.5 z" fill="#a8a4c7" />
                </marker>
                <linearGradient id="cross" x1="0" x2="1"><stop stopColor="#47a7ff" /><stop offset="1" stopColor="#8a5cf5" /></linearGradient>
              </defs>
              {allEdges.map((edge) => {
                const from = allNodes.find((node) => node.id === edge.from);
                const to = allNodes.find((node) => node.id === edge.to);
                if (!from || !to) return null;
                return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={edge.id === "cross-paper" ? "cross-line" : "graph-line"} markerEnd="url(#arrow)" />;
              })}
              {allNodes.map((concept) => (
                <g
                  key={concept.id}
                  className={`concept-node ${"paper" in concept ? concept.paper : "note"} ${concept.status} ${concept.id === "td-error" && crossPaper ? "arrive" : ""} ${selectedId === concept.id ? "selected" : ""}`}
                  transform={`translate(${concept.x} ${concept.y})`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(concept.id)}
                  onKeyDown={(event) => event.key === "Enter" && setSelectedId(concept.id)}
                >
                  <circle r={concept.id === "td-error" || concept.id === "closed-loop" ? 35 : 29} />
                  <text textAnchor="middle">
                    {concept.label.match(/.{1,14}(?:\s|$)/g)?.slice(0, 3).map((line, i) => <tspan x="0" dy={i === 0 ? "-2" : "13"} key={line}>{line.trim()}</tspan>)}
                  </text>
                  {concept.status === "mastered" && <g transform="translate(21 -22)"><circle className="check-dot" r="8" /><path d="M-3 0 l2 2 4 -5" /></g>}
                </g>
              ))}
            </svg>
          </div>

          <div className="graph-controls">
            <div className="minimap">
              <svg viewBox={`0 0 ${GRAPH_WIDTH} ${graphHeight}`} onClick={navigateMinimap} role="button" aria-label="Navigate knowledge graph">
                {allNodes.map((concept) => (
                  <circle
                    key={concept.id}
                    cx={concept.x}
                    cy={concept.y}
                    r="11"
                    className={`mini-node ${"paper" in concept ? concept.paper : "note"} ${concept.status}`}
                  />
                ))}
                <rect
                  className="mini-viewport"
                  x={viewportRect.x * GRAPH_WIDTH}
                  y={viewportRect.y * graphHeight}
                  width={viewportRect.w * GRAPH_WIDTH}
                  height={viewportRect.h * graphHeight}
                  rx="4"
                />
              </svg>
            </div>
            <div className="zoom-buttons">
              <button aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))}><Plus size={13} /></button>
              <button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.25))}><Minus size={13} /></button>
            </div>
          </div>

          {selectedNode && (
            <div className="node-inspector pop-in">
              <button className="inspector-close" onClick={() => setSelectedId(null)} aria-label="Close concept details"><X size={13} /></button>
              <span className="eyebrow">{"sourceType" in selectedNode && selectedNode.sourceType === "note" ? "From your note" : "From paper"}</span>
              <strong>{selectedNode.label}</strong>
              <p>{selectedNode.summary}</p>
              <small>{selectedNode.sourceTitle}</small>
              {selectedEdges.map((edge) => {
                const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                const other = allNodes.find((node) => node.id === otherId);
                return <button className="relation-chip" key={edge.id} onClick={() => setSelectedId(otherId)}>{edge.relation} → {other?.label ?? otherId}</button>;
              })}
            </div>
          )}

          {crossPaper ? (
            <div className="connection-card pop-in">
              <div className="connection-icon"><Link2 size={16} /></div>
              <div><strong>Cross-paper connection</strong><p>Reward signal shaped your explanation of TD error.</p><button onClick={() => setSelectedId("reward")}>Explore connection →</button></div>
            </div>
          ) : dynamicNodes.length > 0 ? (
            <div className="graph-hint"><Sparkles size={16} /><span>{dynamicNodes.length} concepts were extracted from {notes.length} saved note{notes.length === 1 ? "" : "s"}.</span></div>
          ) : (
            <div className="graph-hint"><Sparkles size={16} /><span>Master a concept, then open Paper 2 to watch your knowledge transfer.</span></div>
          )}
        </>
      )}

      {activeTab === "timeline" && (
        <div className="timeline">
          <div className="timeline-item complete"><i /><span><small>Paper 1</small><strong>Closed-loop learning</strong><p>3 concepts mastered</p></span></div>
          <div className={`timeline-item ${crossPaper ? "complete" : ""}`}><i /><span><small>Paper 2</small><strong>Temporal-difference learning</strong><p>{crossPaper ? "Connected to reward signal" : "Ready to explore"}</p></span></div>
            {notes.map((note) => <div className="timeline-item complete" key={note.id}><i /><span><small>{new Date(note.updatedAt).toLocaleDateString()}</small><strong>Note · {note.sourceTitle}</strong><p>{note.content.slice(0, 80)}</p></span></div>)}
        </div>
      )}

      {activeTab === "list" && (
        <div className="concept-list">
          {concepts.map((concept) => (
            <button className="concept-row" key={concept.id} onClick={() => { setSelectedId(concept.id); onTab("graph"); }}>
              <ListTree size={13} />
              <span className="concept-name">{concept.label.replace("\n", " ")}</span>
              <span className={`concept-paper ${concept.paper}`}>{PAPER_META[concept.paper].shortTitle}</span>
              <span className={`concept-status ${concept.status}`}>{concept.status}</span>
            </button>
          ))}
          {dynamicNodes.map((concept) => (
            <button className="concept-row" key={concept.id} onClick={() => { setSelectedId(concept.id); onTab("graph"); }}>
              <ListTree size={13} />
              <span className="concept-name">{concept.label}</span>
              <span className="concept-paper note">Note</span>
              <span className={`concept-status ${concept.status}`}>{concept.status}</span>
            </button>
          ))}
          {mastered
            .filter((id) => id.startsWith("pdf:"))
            .map((id) => (
              <div className="concept-row" key={id}>
                <ListTree size={13} />
                <span className="concept-name">{id.slice(4)}…</span>
                <span className="concept-paper pdf">PDF</span>
                <span className="concept-status mastered">mastered</span>
              </div>
            ))}
        </div>
      )}
    </aside>
  );
}

/* ── progress bar ────────────────────────────────────────────────── */

function ProgressBar({
  source,
  confirmed,
  crossPaper,
  masteredCount,
  readingSeconds,
  learnerName,
}: {
  source: SourceId;
  confirmed: boolean;
  crossPaper: boolean;
  masteredCount: number;
  readingSeconds: number;
  learnerName: string;
}) {
  const goalSeconds = READING_GOAL_HOURS * 3600;
  const percent = Math.min(100, Math.round((readingSeconds / goalSeconds) * 100));
  return (
    <footer className="progress-bar">
      <div className="today-progress">
        <div className="ring" style={{ background: `radial-gradient(closest-side, white 75%, transparent 77% 99%), conic-gradient(var(--purple) ${percent}%, #e8e5f4 0)` }}>
          <span>{percent}%</span>
        </div>
        <span>
          <strong>Today’s progress</strong>
          <small>{formatHours(readingSeconds)} of {READING_GOAL_HOURS.toFixed(1)} hours · keep going, {learnerName}.</small>
        </span>
      </div>
      <div className="metric"><strong>{5 + masteredCount}</strong><span>Concepts mastered</span></div>
      <div className="metric"><strong>{crossPaper ? 9 : 8}</strong><span>Connections drawn</span></div>
      <div className="metric"><strong>{source === "cortical" ? 1 : 2}</strong><span>Papers explored</span></div>
      <div className="recent">
        <strong>Recent understanding</strong>
        <span className="recent-chip green">Closed loop</span>
        {confirmed && <span className="recent-chip blue">Reward signal</span>}
        {crossPaper && <span className="recent-chip purple">TD error</span>}
      </div>
    </footer>
  );
}

/* ── sign-in ─────────────────────────────────────────────────────── */

function SignInModal({
  current,
  onCancel,
  onSubmit,
}: {
  current: Learner | null;
  onCancel?: () => void;
  onSubmit: (learner: Learner) => void;
}) {
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ id: learnerStore.toId(trimmed), name: trimmed });
  }

  return (
    <div className="overlay center" role="dialog" aria-label="Sign in to Gloss">
      <div className="signin" onClick={(event) => event.stopPropagation()}>
        <div className="brand-mark large"><Sparkles size={20} /></div>
        <h2>{current ? "Switch learner" : "Sign in to Gloss"}</h2>
        <p>Your confirmed concepts, feedback, and reading time follow your learner profile. Memory is stored in EverOS per learner.</p>
        <input
          autoFocus
          value={name}
          placeholder="Your name (e.g. Sam)"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
        />
        <div className="signin-actions">
          {onCancel && <button className="ghost" onClick={onCancel}>Cancel</button>}
          <button className="primary" disabled={!name.trim()} onClick={submit}>Continue</button>
        </div>
        {current && <small>Currently signed in as {current.name}</small>}
      </div>
    </div>
  );
}
