"use client";

import {
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Focus,
  GraduationCap,
  Highlighter,
  Library,
  Link2,
  Menu,
  Minus,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import PdfReader from "@/components/PdfReader";
import {
  BASE_CONCEPTS,
  ChatMessage,
  INITIAL_MEMORY,
  MemorySyncState,
  PAPER_META,
  PaperId,
  chatAdapter,
  memoryAdapter,
} from "@/lib/gloss";

type GraphTab = "graph" | "timeline";

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

export default function GlossApp() {
  const [paper, setPaper] = useState<PaperId>("cortical");
  const [memory, setMemory] = useState(INITIAL_MEMORY);
  const [explained, setExplained] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [graphTab, setGraphTab] = useState<GraphTab>("graph");
  const [showGraph, setShowGraph] = useState(false);
  const [note, setNote] = useState("");
  const [syncState, setSyncState] = useState<MemorySyncState>("checking");
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [uploadedSelection, setUploadedSelection] = useState("");
  const [pdfScale, setPdfScale] = useState(1);
  const [pdfPages, setPdfPages] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = memoryAdapter.read();
      setMemory(stored);
      setConfirmed(stored.mastered.includes("reward_signal"));
      void memoryAdapter
        .retrieve("confirmed concepts, learning style, and understanding of reward signals")
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
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const personalized = paper === "td" && memory.mastered.includes("reward_signal");
  const concepts = useMemo(
    () =>
      BASE_CONCEPTS.map((concept) => {
        if (concept.id === "reward" && confirmed) return { ...concept, status: "mastered" as const };
        if (concept.id === "td-error" && personalized && explained)
          return { ...concept, status: "learning" as const };
        return concept;
      }),
    [confirmed, explained, personalized],
  );

  async function openPaper(next: PaperId) {
    setUploadedPdf(null);
    setUploadedSelection("");
    setPaper(next);
    setExplained(false);
    setShowGraph(next === "td" && memory.mastered.includes("reward_signal"));
    setNote("");
    setChatMessages([]);
    setChatDraft("");
    setChatError("");
    if (next === "td") {
      setSyncState("checking");
      try {
        const remote = await memoryAdapter.retrieve(
          "What has Sam already mastered that relates to rewards, predictions, and temporal-difference learning?",
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

  function explainSelection() {
    setExplained(true);
    if (paper === "td" && memory.mastered.includes("reward_signal")) {
      window.setTimeout(() => setShowGraph(true), 400);
    }
  }

  function openUploadedPdf(file: File) {
    setUploadedPdf(file);
    setUploadedSelection("");
    setPdfPages(0);
    setPdfScale(1);
    setExplained(false);
    setShowGraph(false);
    setNote("");
    setChatMessages([]);
    setChatDraft("");
    setChatError("");
  }

  const explainUploadedSelection = useCallback((text: string) => {
    setUploadedSelection(text);
    setExplained(true);
    setChatMessages([]);
    setChatDraft("");
    setChatError("");
  }, []);

  async function askTutor() {
    const question = chatDraft.trim();
    const passage = uploadedPdf ? uploadedSelection : PAPER_COPY[paper].selection;
    const paperTitle = uploadedPdf?.name ?? PAPER_META[paper].title;
    if (!question || !passage || chatLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const previousMessages = chatMessages;
    setChatMessages((messages) => [...messages, userMessage]);
    setChatDraft("");
    setChatError("");
    setChatLoading(true);

    try {
      const result = await chatAdapter.send({
        passage,
        paperTitle,
        question,
        history: previousMessages,
      });
      setChatMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          provider: result.provider,
          model: result.model,
        },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Gloss could not answer right now.");
    } finally {
      setChatLoading(false);
    }
  }

  async function confirmUnderstanding() {
    const conceptId = paper === "cortical" ? "reward_signal" : "td_error";
    if (memory.mastered.includes(conceptId)) return;
    const next = {
      ...memory,
      mastered: Array.from(new Set([...memory.mastered, conceptId])),
    };
    setMemory(next);
    memoryAdapter.write(next);
    if (paper === "cortical") setConfirmed(true);
    setSyncState("syncing");

    try {
      await memoryAdapter.confirm({
        concept: paper === "cortical" ? "reward signal" : "temporal-difference error",
        understanding:
          paper === "cortical"
            ? "a scalar feedback value that tells an agent whether its latest action moved it closer to its goal"
            : "the surprise gap between the reward an agent expected and the reward it actually received",
        learnedFrom: PAPER_META[paper].title,
      });
      setSyncState("synced");
    } catch {
      setSyncState("offline");
    }
  }

  function resetDemo() {
    memoryAdapter.reset();
    setMemory(INITIAL_MEMORY);
    setPaper("cortical");
    setExplained(true);
    setConfirmed(false);
    setShowGraph(false);
    setSyncState("connected");
    setUploadedPdf(null);
    setUploadedSelection("");
    setChatMessages([]);
    setChatDraft("");
    setChatError("");
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 320, damping: 30 }}>
      <motion.main className="app-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Sidebar
          paper={paper}
          onOpenPaper={openPaper}
          onReset={resetDemo}
          confirmed={confirmed}
          syncState={syncState}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
        />

        <motion.section className="workspace" initial={{ x: 12 }} animate={{ x: 0 }}>
          <Header paper={paper} uploadedPdf={uploadedPdf} onUpload={openUploadedPdf} />
          <div className="reading-grid">
            <PaperPane
              paper={paper}
              explained={explained}
              onExplain={explainSelection}
              uploadedPdf={uploadedPdf}
              pdfPages={pdfPages}
              pdfScale={pdfScale}
              onPdfPages={setPdfPages}
              onPdfScale={setPdfScale}
              onPdfSelection={explainUploadedSelection}
            />
            <ExplanationPane
              paper={paper}
              explained={explained}
              personalized={!uploadedPdf && personalized}
              confirmed={paper === "cortical" ? confirmed : memory.mastered.includes("td_error")}
              syncState={syncState}
              uploadedSelection={uploadedSelection}
              uploadedName={uploadedPdf?.name}
              chatMessages={chatMessages}
              chatDraft={chatDraft}
              chatLoading={chatLoading}
              chatError={chatError}
              onChatDraft={setChatDraft}
              onAskTutor={askTutor}
              note={note}
              onNote={setNote}
              onConfirm={confirmUnderstanding}
              onClose={() => setExplained(false)}
            />
            <GraphPane
              concepts={concepts}
              activeTab={graphTab}
              onTab={setGraphTab}
              crossPaper={showGraph}
            />
          </div>
          <ProgressBar paper={paper} confirmed={confirmed} crossPaper={showGraph} />
        </motion.section>
      </motion.main>
    </MotionConfig>
  );
}

function Sidebar({
  paper,
  onOpenPaper,
  onReset,
  confirmed,
  syncState,
  collapsed,
  onToggle,
}: {
  paper: PaperId;
  onOpenPaper: (paper: PaperId) => void;
  onReset: () => void;
  confirmed: boolean;
  syncState: MemorySyncState;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const syncMessage = {
    checking: "Retrieving learner memory…",
    connected: confirmed ? "Memory retrieved" : "Connected · ready",
    syncing: "Writing confirmed concept…",
    synced: "Concept saved to EverOS",
    offline: "Offline · saved on device",
  }[syncState];

  return (
    <motion.aside
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      initial={{ x: -24 }}
      animate={{ x: 0, width: collapsed ? 72 : 236, flexBasis: collapsed ? 72 : 236 }}
    >
      <motion.div className="brand" whileHover={{ x: 2 }}>
        <motion.div className="brand-mark" whileHover={{ rotate: 8, scale: 1.08 }}><Sparkles size={16} /></motion.div>
        <div className="brand-copy"><strong>Gloss</strong><span>Read. Understand. Remember.</span></div>
        <motion.button
          className="sidebar-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
          whileTap={{ scale: .9 }}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </motion.button>
      </motion.div>
      <nav className="primary-nav" aria-label="Primary navigation">
        <motion.button title="Library" whileHover={{ x: 3 }} whileTap={{ scale: .98 }} className="active"><Library size={17} /> Library</motion.button>
        <motion.button title="Knowledge" whileHover={{ x: 3 }} whileTap={{ scale: .98 }}><Network size={17} /> Knowledge</motion.button>
        <motion.button title="Notes" whileHover={{ x: 3 }} whileTap={{ scale: .98 }}><StickyNote size={17} /> Notes</motion.button>
        <motion.button title="Memory" whileHover={{ x: 3 }} whileTap={{ scale: .98 }}><BrainCircuit size={17} /> Memory</motion.button>
      </nav>

      <p className="side-label">Your papers</p>
      {(Object.keys(PAPER_META) as PaperId[]).map((id) => (
        <motion.button
          layout
          whileHover={{ x: 3, backgroundColor: "rgba(255,255,255,.07)" }}
          whileTap={{ scale: .98 }}
          className={`paper-card ${paper === id ? "selected" : ""}`}
          key={id}
          title={PAPER_META[id].title}
          onClick={() => onOpenPaper(id)}
        >
          <FileText size={17} />
          <span>
            <strong>{PAPER_META[id].title}</strong>
            <small>{PAPER_META[id].authors}</small>
            <i><b style={{ width: `${PAPER_META[id].progress}%` }} /></i>
          </span>
        </motion.button>
      ))}

      <motion.div className="profile-card" whileHover={{ y: -2 }}>
        <div className="profile-heading"><GraduationCap size={17} /><strong>Sam’s learning profile</strong></div>
        <dl>
          <div><dt>Field</dt><dd>Neuroscience</dd></div>
          <div><dt>Level</dt><dd>Biology strong · ML new</dd></div>
          <div><dt>Style</dt><dd>Short · analogy first</dd></div>
        </dl>
      </motion.div>
      <motion.div className="sync-card" layout animate={{ borderColor: syncState === "offline" ? "#6a4f32" : "#1d4a3c" }}>
        <span className={`sync-dot ${syncState !== "offline" ? "live" : ""} ${syncState}`} />
        <div><strong>EverOS memory</strong><small>{syncMessage}</small></div>
        {syncState === "synced" || syncState === "connected" ? <Check size={14} /> : <BrainCircuit size={14} />}
      </motion.div>
      <button className="reset-button" onClick={onReset}><RotateCcw size={14} /> Reset local demo</button>
    </motion.aside>
  );
}

function Header({
  paper,
  uploadedPdf,
  onUpload,
}: {
  paper: PaperId;
  uploadedPdf: File | null;
  onUpload: (file: File) => void;
}) {
  const title = uploadedPdf?.name ?? PAPER_META[paper].title;

  return (
    <motion.header className="topbar" initial={{ y: -12 }} animate={{ y: 0 }}>
      <div className="reading-title"><BookOpen size={16} /> Reading: <AnimatePresence mode="wait"><motion.strong key={title} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>{title}</motion.strong></AnimatePresence><ChevronDown size={14} /></div>
      <div className="top-actions">
        <motion.label whileHover={{ y: -1 }} whileTap={{ scale: .96 }} className="upload-button">
          <Upload size={14} /> Upload PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
        </motion.label>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .96 }} className="action-primary"><Sparkles size={14} /> Explain</motion.button>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .96 }}><StickyNote size={14} /> Take note</motion.button>
      </div>
      <div className="search"><Search size={15} /><span>Search your knowledge</span><kbd>⌘ K</kbd></div>
      <motion.div className="avatar" whileHover={{ scale: 1.08 }}>S</motion.div>
    </motion.header>
  );
}

function PaperPane({
  paper,
  explained,
  onExplain,
  uploadedPdf,
  pdfPages,
  pdfScale,
  onPdfPages,
  onPdfScale,
  onPdfSelection,
}: {
  paper: PaperId;
  explained: boolean;
  onExplain: () => void;
  uploadedPdf: File | null;
  pdfPages: number;
  pdfScale: number;
  onPdfPages: (pages: number) => void;
  onPdfScale: (scale: number) => void;
  onPdfSelection: (text: string) => void;
}) {
  const copy = PAPER_COPY[paper];

  if (uploadedPdf) {
    return (
      <article className="paper-pane uploaded-paper-pane">
        <div className="reader-toolbar">
          <Menu size={15} />
          <span className="uploaded-file-name">{uploadedPdf.name}</span>
          <span className="page-total">{pdfPages ? `${pdfPages} pages` : "Loading…"}</span>
          <span className="toolbar-spacer" />
          <button
            aria-label="Zoom out"
            disabled={pdfScale <= .6}
            onClick={() => onPdfScale(Math.max(.6, Number((pdfScale - .1).toFixed(1))))}
          ><Minus size={14} /></button>
          <span className="zoom-value">{Math.round(pdfScale * 100)}%</span>
          <button
            aria-label="Zoom in"
            disabled={pdfScale >= 2}
            onClick={() => onPdfScale(Math.min(2, Number((pdfScale + .1).toFixed(1))))}
          ><Plus size={14} /></button>
          <Focus size={15} />
        </div>
        <PdfReader
          file={uploadedPdf}
          scale={pdfScale}
          onDocumentReady={onPdfPages}
          onTextSelected={onPdfSelection}
        />
      </article>
    );
  }

  return (
    <article className="paper-pane">
      <div className="reader-toolbar">
        <Menu size={15} /><span className="page-number">12</span><span>/ 36</span>
        <span className="toolbar-spacer" />
        <Search size={15} /><span>125%</span><ChevronDown size={13} /><Focus size={15} /><PanelRight size={15} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          className="paper-page"
          key={paper}
          initial={{ opacity: 0, x: 18, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -12, filter: "blur(3px)" }}
          transition={{ duration: .28, ease: "easeOut" }}
        >
          <p className="paper-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
          <motion.button
            className={`selected-passage ${explained ? "explained" : ""}`}
            onClick={onExplain}
            whileTap={{ scale: .995 }}
          >
            {copy.selection}
            <AnimatePresence>
              {!explained && (
                <motion.span
                  className="explain-chip"
                  initial={{ opacity: 0, y: -6, scale: .92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: .94 }}
                >
                  <Sparkles size={13} /> Explain this
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <p>{copy.after}</p>
          {paper === "td" ? <TDFormula /> : <ClosedLoopFigure />}
          <small className="figure-caption">{copy.caption}</small>
          <div className="paper-footnote">
            <span>Gloss demo excerpt · Page 12</span>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .97 }} onClick={onExplain}><Sparkles size={14} /> Ask about this page</motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </article>
  );
}

function TDFormula() {
  return (
    <motion.div className="paper-figure td-figure" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
      <div className="formula">V(s<sub>t</sub>) ← V(s<sub>t</sub>) + α [r<sub>t+1</sub> + γV(s<sub>t+1</sub>) − V(s<sub>t</sub>)]</div>
      <div className="flow-diagram">
        <span className="flow-node blue">Current<br />estimate</span><b>→</b>
        <span className="flow-node green">Reward<br />received</span><b>→</b>
        <span className="flow-node orange">Next<br />estimate</span><b>→</b>
        <span className="flow-node purple">Updated<br />estimate</span>
      </div>
    </motion.div>
  );
}

function ClosedLoopFigure() {
  return (
    <motion.div className="paper-figure loop-figure" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
      <div className="culture"><BrainCircuit size={30} /><strong>Neural culture</strong><span>chooses an action</span></div>
      <div className="loop-arrows"><span>action →</span><span>← scalar feedback</span></div>
      <div className="culture environment"><Focus size={30} /><strong>Environment</strong><span>returns “odor” value</span></div>
    </motion.div>
  );
}

function ExplanationPane({
  paper,
  explained,
  personalized,
  confirmed,
  syncState,
  uploadedSelection,
  uploadedName,
  chatMessages,
  chatDraft,
  chatLoading,
  chatError,
  onChatDraft,
  onAskTutor,
  note,
  onNote,
  onConfirm,
  onClose,
}: {
  paper: PaperId;
  explained: boolean;
  personalized: boolean;
  confirmed: boolean;
  syncState: MemorySyncState;
  uploadedSelection: string;
  uploadedName?: string;
  chatMessages: ChatMessage[];
  chatDraft: string;
  chatLoading: boolean;
  chatError: string;
  onChatDraft: (value: string) => void;
  onAskTutor: () => void;
  note: string;
  onNote: (note: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isUploaded = Boolean(uploadedName);

  return (
    <section className="explanation-pane">
      <div className="panel-tabs"><button className="active">Explain</button><button>Notes (2)</button><span /><button onClick={onClose}><X size={16} /></button></div>
      <AnimatePresence mode="wait">
      {!explained ? (
        <motion.div className="empty-explanation" key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div><Highlighter size={24} /></div>
          <h2>Select something you want to understand</h2>
          <p>Highlight a passage in the paper and Gloss will explain it using the source and what you already know.</p>
        </motion.div>
      ) : (
        <motion.div
          className="explanation-content"
          key={`${paper}-explanation`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <div className="trust-row"><span><Check size={14} /> {isUploaded ? "Captured from this PDF" : "Grounded in this paper"}</span><ChevronDown size={14} /></div>
          <p className="eyebrow">{isUploaded ? "Selected passage" : "Explanation"}</p>
          {isUploaded ? (
            <>
              <blockquote className="selection-quote">“{uploadedSelection}”</blockquote>
              <p className="answer upload-ready-copy">
                PDF.js captured this directly from <strong>{uploadedName}</strong>. The passage is ready to send as grounded context to the explanation model.
              </p>
            </>
          ) : (
            <p className="answer">{PAPER_COPY[paper].explanation}</p>
          )}
          {!isUploaded && <motion.div className="analogy-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
            <span><Sparkles size={14} /> Analogy</span>
            <p>{paper === "td"
              ? "Like checking your GPS arrival time: the difference between the ETA and when you actually arrive helps the GPS improve its next estimate."
              : "Like a thermostat getting one number back: warmer or colder. That tiny signal is enough to steer what it tries next."}</p>
          </motion.div>}

          <AnimatePresence>
          {personalized && (
            <motion.div className="memory-section" initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5 }}>
              <p className="eyebrow">Built on your knowledge</p>
              <motion.div className="memory-card" whileHover={{ y: -2 }}>
                <div className="memory-icon"><Link2 size={15} /></div>
                <div><strong>Reward signal</strong><p>Retrieved via EverOS · <em>Embodied Neurocomputation</em></p><button>View in graph →</button></div>
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>

          <div className="passage-chat">
            <div className="chat-heading">
              <span><Bot size={14} /> Ask Gloss</span>
              <em>Butterbase AI Gateway</em>
            </div>
            {chatMessages.length === 0 && (
              <div className="chat-suggestions">
                {["Explain this more simply", "Why does this matter?", "What does the passage not tell us?"].map((suggestion) => (
                  <button key={suggestion} onClick={() => onChatDraft(suggestion)}>{suggestion}</button>
                ))}
              </div>
            )}
            <AnimatePresence initial={false}>
              {chatMessages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`chat-message ${message.role}`}
                  initial={{ opacity: 0, y: 7, scale: .98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                >
                  <span>{message.role === "assistant" ? <Sparkles size={12} /> : "You"}</span>
                  <p>{message.content}</p>
                  {message.provider && <small>{message.provider} · {message.model}</small>}
                </motion.div>
              ))}
            </AnimatePresence>
            {chatLoading && (
              <motion.div className="chat-message assistant loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span><Sparkles size={12} /></span><p><i /><i /><i /></p>
              </motion.div>
            )}
            {chatError && <div className="chat-error">{chatError}</div>}
            <form
              className="chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                onAskTutor();
              }}
            >
              <input
                value={chatDraft}
                onChange={(event) => onChatDraft(event.target.value)}
                placeholder="Ask about this passage…"
                maxLength={2000}
                disabled={chatLoading}
              />
              <motion.button
                type="submit"
                aria-label="Ask Gloss"
                disabled={!chatDraft.trim() || chatLoading}
                whileTap={{ scale: .92 }}
              ><Send size={14} /></motion.button>
            </form>
          </div>

          <textarea
            className="note-input"
            aria-label="Add a note"
            placeholder="Add a note in your own words…"
            value={note}
            onChange={(event) => onNote(event.target.value)}
          />
          <div className="explanation-footer">
            <span>{isUploaded
              ? "Grounded selection ready"
              : confirmed
              ? syncState === "offline" ? "Saved on this device" : "Saved to your understanding"
              : "Does this make sense?"}</span>
            {!isUploaded && <motion.button
              layout
              whileHover={{ y: -1 }}
              whileTap={{ scale: .96 }}
              className={`understand-button ${confirmed ? "confirmed" : ""}`}
              onClick={onConfirm}
            >
              {confirmed ? <Check size={15} /> : <BrainCircuit size={15} />}
              {confirmed ? "Understood" : "Add to understanding"}
            </motion.button>}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </section>
  );
}

function GraphPane({
  concepts,
  activeTab,
  onTab,
  crossPaper,
}: {
  concepts: typeof BASE_CONCEPTS;
  activeTab: GraphTab;
  onTab: (tab: GraphTab) => void;
  crossPaper: boolean;
}) {
  return (
    <motion.aside className="graph-pane" initial={{ x: 16 }} animate={{ x: 0 }}>
      <div className="graph-header"><div><Network size={16} /><strong>Your knowledge</strong></div><CircleHelp size={15} /></div>
      <div className="graph-tabs">
        <motion.button whileTap={{ scale: .96 }} className={activeTab === "graph" ? "active" : ""} onClick={() => onTab("graph")}>Graph</motion.button>
        <motion.button whileTap={{ scale: .96 }} className={activeTab === "timeline" ? "active" : ""} onClick={() => onTab("timeline")}>Timeline</motion.button>
      </div>
      <AnimatePresence mode="wait">
      {activeTab === "graph" ? (
        <motion.div key="graph" className="graph-content" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
          <div className="graph-legend">
            <span><i className="paper-one" /> Paper 1</span><span><i className="paper-two" /> Paper 2</span><span><i className="mastered" /> Mastered</span>
          </div>
          <div className="knowledge-canvas">
            <motion.svg viewBox="0 0 380 275" role="img" aria-label="Knowledge graph connecting concepts from two papers">
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
                <motion.line
                  key={index}
                  x1={line[0]}
                  y1={line[1]}
                  x2={line[2]}
                  y2={line[3]}
                  className="graph-line"
                  markerEnd="url(#arrow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: .08 * index, duration: .45 }}
                />
              ))}
              <AnimatePresence>
                {crossPaper && (
                  <motion.line
                    x1="175" y1="54" x2="323" y2="154"
                    className="cross-line" markerEnd="url(#arrow)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{ duration: .8, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
              {concepts.map((concept) => (
                <motion.g
                  key={concept.id}
                  className={`concept-node ${concept.paper} ${concept.status}`}
                  transform={`translate(${concept.x} ${concept.y})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: .12 }}
                >
                  <circle r={concept.id === "td-error" || concept.id === "closed-loop" ? 35 : 29} />
                  <text textAnchor="middle">
                    {concept.label.split("\n").map((line, i) => <tspan x="0" dy={i === 0 ? "-2" : "13"} key={line}>{line}</tspan>)}
                  </text>
                  {concept.status === "mastered" && <g transform="translate(21 -22)"><circle className="check-dot" r="8" /><path d="M-3 0 l2 2 4 -5" /></g>}
                </motion.g>
              ))}
            </motion.svg>
          </div>
          <AnimatePresence mode="wait">
          {crossPaper ? (
            <motion.div key="connected" className="connection-card" initial={{ opacity: 0, y: 10, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5 }} whileHover={{ y: -2 }}>
              <div className="connection-icon"><Link2 size={16} /></div>
              <div><strong>Cross-paper connection</strong><p>Reward signal shaped your explanation of TD error.</p><button>Explore connection →</button></div>
            </motion.div>
          ) : (
            <motion.div key="hint" className="graph-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Sparkles size={16} /><span>Master a concept, then open Paper 2 to watch your knowledge transfer.</span></motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div key="timeline" className="timeline" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
          <div className="timeline-item complete"><i /><span><small>Paper 1</small><strong>Closed-loop learning</strong><p>3 concepts mastered</p></span></div>
          <div className={`timeline-item ${crossPaper ? "complete" : ""}`}><i /><span><small>Paper 2</small><strong>Temporal-difference learning</strong><p>{crossPaper ? "Connected to reward signal" : "Ready to explore"}</p></span></div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.aside>
  );
}

function ProgressBar({ paper, confirmed, crossPaper }: { paper: PaperId; confirmed: boolean; crossPaper: boolean }) {
  return (
    <motion.footer className="progress-bar" initial={{ y: 14 }} animate={{ y: 0 }}>
      <div className="today-progress">
        <motion.div className="ring" animate={{ rotate: crossPaper ? 360 : 0 }} transition={{ duration: .7 }}><span>{crossPaper ? "82" : confirmed ? "72" : "48"}%</span></motion.div>
        <span><strong>Today’s progress</strong><small>{confirmed ? "Your understanding is taking shape." : "Keep reading, Sam."}</small></span>
      </div>
      <div className="metric"><AnimatePresence mode="wait"><motion.strong key={confirmed ? 6 : 5} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{confirmed ? 6 : 5}</motion.strong></AnimatePresence><span>Concepts mastered</span></div>
      <div className="metric"><AnimatePresence mode="wait"><motion.strong key={crossPaper ? 9 : 8} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{crossPaper ? 9 : 8}</motion.strong></AnimatePresence><span>Connections drawn</span></div>
      <div className="metric"><AnimatePresence mode="wait"><motion.strong key={paper === "td" ? 2 : 1} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{paper === "td" ? 2 : 1}</motion.strong></AnimatePresence><span>Papers explored</span></div>
      <div className="recent">
        <strong>Recent understanding</strong>
        <span className="recent-chip green">Closed loop</span>
        <span className="recent-chip blue">Reward signal</span>
        <AnimatePresence>{crossPaper && <motion.span className="recent-chip purple" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>TD error</motion.span>}</AnimatePresence>
      </div>
    </motion.footer>
  );
}
