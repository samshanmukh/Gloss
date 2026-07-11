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
  Sparkles,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import PdfReader from "@/components/PdfReader";
import {
  AppNotification,
  BASE_CONCEPTS,
  DEFAULT_LEARNER,
  FeedbackValue,
  Learner,
  MemorySyncState,
  PAPER_META,
  PaperId,
  QAEntry,
  READING_GOAL_HOURS,
  SourceId,
  feedbackStore,
  formatHours,
  initialMemory,
  learnerStore,
  memoryAdapter,
  readingTimeStore,
} from "@/lib/gloss";

type GraphTab = "graph" | "timeline" | "list";
type OpenMenu = "bell" | "more" | "avatar" | null;

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
  const [source, setSource] = useState<SourceId>("cortical");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfSelection, setPdfSelection] = useState<{ text: string; page: number } | null>(null);
  const [memory, setMemory] = useState(initialMemory(DEFAULT_LEARNER.id));
  const [explained, setExplained] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [graphTab, setGraphTab] = useState<GraphTab>("graph");
  const [showGraph, setShowGraph] = useState(false);
  const [note, setNote] = useState("");
  const [noteFocusTick, setNoteFocusTick] = useState(0);
  const [syncState, setSyncState] = useState<MemorySyncState>("checking");
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([]);
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const graphPaneRef = useRef<HTMLElement>(null);
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
  }, []);

  function loadLearner(active: Learner) {
    const stored = memoryAdapter.read(active.id);
    setMemory(stored);
    setConfirmed(stored.mastered.includes("reward_signal"));
    setFeedback(feedbackStore.read(active.id));
    setReadingSeconds(readingTimeStore.read(active.id));
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
  const concepts = useMemo(
    () =>
      BASE_CONCEPTS.map((concept) => {
        if (concept.id === "reward" && confirmed) return { ...concept, status: "mastered" as const };
        if (concept.id === "td-error" && memory.mastered.includes("td_error"))
          return { ...concept, status: "mastered" as const };
        if (concept.id === "td-error" && personalized && explained)
          return { ...concept, status: "learning" as const };
        return concept;
      }),
    [confirmed, explained, personalized, memory.mastered],
  );

  async function openPaper(next: PaperId) {
    setSource(next);
    setExplained(false);
    setPdfSelection(null);
    setQaEntries([]);
    setShowGraph(next === "td" && memory.mastered.includes("reward_signal"));
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

  function openPdf(file: File) {
    setPdfFile(file);
    setSource("pdf");
    setExplained(false);
    setPdfSelection(null);
    setQaEntries([]);
    setNote("");
    notify("PDF added to your library", file.name);
  }

  function explainSelection() {
    setExplained(true);
    if (source === "td" && memory.mastered.includes("reward_signal")) {
      window.setTimeout(() => setShowGraph(true), 400);
    }
  }

  function onPdfSelect(text: string, page: number) {
    setPdfSelection({ text, page });
    setExplained(true);
    setQaEntries([]);
    void askQuestion("Explain this passage in simple terms.", { text, page });
  }

  async function askQuestion(question: string, selection?: { text: string; page: number }) {
    const active = selection ?? pdfSelection;
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
    const history = qaEntries
      .filter((item) => !item.pending && !item.error)
      .flatMap((item) => [
        { role: "user" as const, content: item.question },
        { role: "assistant" as const, content: item.answer },
      ]);

    try {
      const answer = await memoryAdapter.ask({ learnerId, question, passage, paperTitle, history });
      setQaEntries((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, answer, pending: false } : item)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The tutor is unavailable right now.";
      setQaEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, answer: message, pending: false, error: true } : item,
        ),
      );
    }
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
      window.setTimeout(() => setShowGraph(true), 300);
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

  function resetDemo() {
    memoryAdapter.reset(learnerId);
    setMemory(initialMemory(learnerId));
    setSource("cortical");
    setExplained(true);
    setConfirmed(false);
    setShowGraph(false);
    setQaEntries([]);
    setPdfSelection(null);
    setSyncState("connected");
    setOpenMenu(null);
    notify("Demo reset", "Local memory cleared for this learner");
  }

  function switchLearner(next: Learner) {
    learnerStore.write(next);
    setLearner(next);
    setSignInOpen(false);
    setSource("cortical");
    setExplained(true);
    setShowGraph(false);
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

  const focusGraph = useCallback(() => {
    setGraphTab("graph");
    graphPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <main className="app-shell" onClick={() => setOpenMenu(null)}>
      <Sidebar
        source={source}
        pdfName={pdfFile?.name ?? null}
        learner={learner}
        onOpenPaper={openPaper}
        onOpenPdf={() => pdfFile && setSource("pdf")}
        onUpload={openPdf}
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
          onExplain={() => (source === "pdf" ? setExplained(true) : explainSelection())}
          onTakeNote={() => {
            setExplained(true);
            setNoteFocusTick((tick) => tick + 1);
          }}
          onSearch={() => setPaletteOpen(true)}
          onReset={resetDemo}
          onSignOut={signOut}
          onSwitchLearner={() => setSignInOpen(true)}
        />
        <div className="reading-grid">
          {source === "pdf" && pdfFile ? (
            <PdfReader key={`${pdfFile.name}-${pdfFile.size}`} file={pdfFile} onSelectText={onPdfSelect} />
          ) : (
            <PaperPane paper={source as PaperId} explained={explained} onExplain={explainSelection} />
          )}
          <ExplanationPane
            source={source}
            pdfSelection={pdfSelection}
            explained={explained}
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
            noteFocusTick={noteFocusTick}
            qaEntries={qaEntries}
            feedback={feedback}
            onFeedback={setFeedbackValue}
            onAsk={(question) => void askQuestion(question)}
            onNote={setNote}
            onConfirm={() => void confirmUnderstanding()}
            onClose={() => setExplained(false)}
          />
          <GraphPane
            paneRef={graphPaneRef}
            concepts={concepts}
            mastered={memory.mastered}
            activeTab={graphTab}
            onTab={setGraphTab}
            crossPaper={showGraph}
          />
        </div>
        <ProgressBar
          source={source}
          confirmed={confirmed}
          crossPaper={showGraph}
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
          onFocusGraph={focusGraph}
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
  source,
  pdfName,
  learner,
  onOpenPaper,
  onOpenPdf,
  onUpload,
  onReset,
  confirmed,
  syncState,
  collapsed,
  onToggle,
}: {
  source: SourceId;
  pdfName: string | null;
  learner: Learner | null;
  onOpenPaper: (paper: PaperId) => void;
  onOpenPdf: () => void;
  onUpload: (file: File) => void;
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
        <div className="brand-mark"><Sparkles size={16} /></div>
        <div className="brand-copy"><strong>Gloss</strong><span>Read. Understand. Remember.</span></div>
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
        <button className="active"><Library size={17} /> Library</button>
        <button><Network size={17} /> Knowledge</button>
        <button><StickyNote size={17} /> Notes</button>
        <button><BrainCircuit size={17} /> Memory</button>
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

function PaperPane({
  paper,
  explained,
  onExplain,
}: {
  paper: PaperId;
  explained: boolean;
  onExplain: () => void;
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
        <p>{copy.intro}</p>
        <button className={`selected-passage ${explained ? "explained" : ""}`} onClick={onExplain}>
          {copy.selection}
          {!explained && <span className="explain-chip"><Sparkles size={13} /> Explain this</span>}
        </button>
        <p>{copy.after}</p>
        {paper === "td" ? <TDFormula /> : <ClosedLoopFigure />}
        <small className="figure-caption">{copy.caption}</small>
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

function ClosedLoopFigure() {
  return (
    <div className="paper-figure loop-figure">
      <div className="culture"><BrainCircuit size={30} /><strong>Neural culture</strong><span>chooses an action</span></div>
      <div className="loop-arrows"><span>action →</span><span>← scalar feedback</span></div>
      <div className="culture environment"><Focus size={30} /><strong>Environment</strong><span>returns “odor” value</span></div>
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
  explained,
  personalized,
  confirmed,
  syncState,
  note,
  noteFocusTick,
  qaEntries,
  feedback,
  onFeedback,
  onAsk,
  onNote,
  onConfirm,
  onClose,
}: {
  source: SourceId;
  pdfSelection: { text: string; page: number } | null;
  explained: boolean;
  personalized: boolean;
  confirmed: boolean;
  syncState: MemorySyncState;
  note: string;
  noteFocusTick: number;
  qaEntries: QAEntry[];
  feedback: Record<string, FeedbackValue>;
  onFeedback: (key: string, value: FeedbackValue) => void;
  onAsk: (question: string) => void;
  onNote: (note: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const isPdf = source === "pdf";
  const pending = qaEntries.some((entry) => entry.pending);

  useEffect(() => {
    if (noteFocusTick > 0) noteRef.current?.focus();
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
      <div className="panel-tabs"><button className="active">Explain</button><button>Notes (2)</button><span /><button onClick={onClose} aria-label="Close panel"><X size={16} /></button></div>
      {showEmpty ? (
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

          {isPdf && pdfSelection ? (
            <>
              <p className="eyebrow">Selected · page {pdfSelection.page}</p>
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
            <button aria-label="Ask" disabled={!question.trim() || pending} onClick={submitQuestion}>
              <CornerDownLeft size={14} />
            </button>
          </div>

          <textarea
            ref={noteRef}
            className="note-input"
            aria-label="Add a note"
            placeholder="Add a note in your own words…"
            value={note}
            onChange={(event) => onNote(event.target.value)}
          />
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

const GRAPH_VIEW = { width: 380, height: 275 };

function GraphPane({
  paneRef,
  concepts,
  mastered,
  activeTab,
  onTab,
  crossPaper,
}: {
  paneRef: React.RefObject<HTMLElement | null>;
  concepts: typeof BASE_CONCEPTS;
  mastered: string[];
  activeTab: GraphTab;
  onTab: (tab: GraphTab) => void;
  crossPaper: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [viewportRect, setViewportRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <aside className="graph-pane" ref={paneRef}>
      <div className="graph-header"><div><Network size={16} /><strong>Your knowledge</strong></div><CircleHelp size={15} /></div>
      <div className="graph-tabs">
        <button className={activeTab === "graph" ? "active" : ""} onClick={() => onTab("graph")}>Graph</button>
        <button className={activeTab === "timeline" ? "active" : ""} onClick={() => onTab("timeline")}>Timeline</button>
        <button className={activeTab === "list" ? "active" : ""} onClick={() => onTab("list")}>List</button>
      </div>

      {activeTab === "graph" && (
        <>
          <div className="graph-legend">
            <span><i className="paper-one" /> Paper 1</span><span><i className="paper-two" /> Paper 2</span><span><i className="mastered" /> Mastered</span>
          </div>
          <div className="knowledge-canvas zoomable" ref={scrollRef} onScroll={updateViewport}>
            <svg
              viewBox={`0 0 ${GRAPH_VIEW.width} ${GRAPH_VIEW.height}`}
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
              {[
                [68, 72, 146, 118], [146, 118, 58, 176], [146, 118, 175, 54],
                [276, 83, 323, 154], [323, 154, 251, 213],
              ].map((line, index) => (
                <line key={index} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} className="graph-line" markerEnd="url(#arrow)" />
              ))}
              {crossPaper && <line x1="175" y1="54" x2="323" y2="154" className="cross-line" markerEnd="url(#arrow)" />}
              {concepts.map((concept) => (
                <g key={concept.id} className={`concept-node ${concept.paper} ${concept.status} ${concept.id === "td-error" && crossPaper ? "arrive" : ""}`} transform={`translate(${concept.x} ${concept.y})`}>
                  <circle r={concept.id === "td-error" || concept.id === "closed-loop" ? 35 : 29} />
                  <text textAnchor="middle">
                    {concept.label.split("\n").map((line, i) => <tspan x="0" dy={i === 0 ? "-2" : "13"} key={line}>{line}</tspan>)}
                  </text>
                  {concept.status === "mastered" && <g transform="translate(21 -22)"><circle className="check-dot" r="8" /><path d="M-3 0 l2 2 4 -5" /></g>}
                </g>
              ))}
            </svg>
          </div>

          <div className="graph-controls">
            <div className="minimap" aria-hidden>
              <svg viewBox={`0 0 ${GRAPH_VIEW.width} ${GRAPH_VIEW.height}`}>
                {concepts.map((concept) => (
                  <circle
                    key={concept.id}
                    cx={concept.x}
                    cy={concept.y}
                    r="11"
                    className={`mini-node ${concept.paper} ${concept.status}`}
                  />
                ))}
                <rect
                  className="mini-viewport"
                  x={viewportRect.x * GRAPH_VIEW.width}
                  y={viewportRect.y * GRAPH_VIEW.height}
                  width={viewportRect.w * GRAPH_VIEW.width}
                  height={viewportRect.h * GRAPH_VIEW.height}
                  rx="4"
                />
              </svg>
            </div>
            <div className="zoom-buttons">
              <button aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))}><Plus size={13} /></button>
              <button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.25))}><Minus size={13} /></button>
            </div>
          </div>

          {crossPaper ? (
            <div className="connection-card pop-in">
              <div className="connection-icon"><Link2 size={16} /></div>
              <div><strong>Cross-paper connection</strong><p>Reward signal shaped your explanation of TD error.</p><button>Explore connection →</button></div>
            </div>
          ) : (
            <div className="graph-hint"><Sparkles size={16} /><span>Master a concept, then open Paper 2 to watch your knowledge transfer.</span></div>
          )}
        </>
      )}

      {activeTab === "timeline" && (
        <div className="timeline">
          <div className="timeline-item complete"><i /><span><small>Paper 1</small><strong>Closed-loop learning</strong><p>3 concepts mastered</p></span></div>
          <div className={`timeline-item ${crossPaper ? "complete" : ""}`}><i /><span><small>Paper 2</small><strong>Temporal-difference learning</strong><p>{crossPaper ? "Connected to reward signal" : "Ready to explore"}</p></span></div>
        </div>
      )}

      {activeTab === "list" && (
        <div className="concept-list">
          {concepts.map((concept) => (
            <div className="concept-row" key={concept.id}>
              <ListTree size={13} />
              <span className="concept-name">{concept.label.replace("\n", " ")}</span>
              <span className={`concept-paper ${concept.paper}`}>{PAPER_META[concept.paper].shortTitle}</span>
              <span className={`concept-status ${concept.status}`}>{concept.status}</span>
            </div>
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
