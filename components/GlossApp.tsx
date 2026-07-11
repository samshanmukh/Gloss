"use client";

import {
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Focus,
  GraduationCap,
  Highlighter,
  Library,
  Link2,
  Menu,
  MessageSquareText,
  Network,
  PanelRight,
  RotateCcw,
  Search,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BASE_CONCEPTS, INITIAL_MEMORY, PAPER_META, PaperId, memoryAdapter } from "@/lib/gloss";

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

  useEffect(() => {
    const stored = memoryAdapter.read();
    setMemory(stored);
    setConfirmed(stored.mastered.includes("reward_signal"));
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

  function openPaper(next: PaperId) {
    setPaper(next);
    setExplained(false);
    setShowGraph(next === "td" && memory.mastered.includes("reward_signal"));
    setNote("");
  }

  function explainSelection() {
    setExplained(true);
    if (paper === "td" && memory.mastered.includes("reward_signal")) {
      window.setTimeout(() => setShowGraph(true), 400);
    }
  }

  function confirmUnderstanding() {
    const next = {
      ...memory,
      mastered: Array.from(new Set([...memory.mastered, paper === "cortical" ? "reward_signal" : "td_error"])),
    };
    setMemory(next);
    memoryAdapter.write(next);
    if (paper === "cortical") setConfirmed(true);
  }

  function resetDemo() {
    memoryAdapter.reset();
    setMemory(INITIAL_MEMORY);
    setPaper("cortical");
    setExplained(true);
    setConfirmed(false);
    setShowGraph(false);
  }

  return (
    <main className="app-shell">
      <Sidebar paper={paper} onOpenPaper={openPaper} onReset={resetDemo} confirmed={confirmed} />

      <section className="workspace">
        <Header paper={paper} />
        <div className="reading-grid">
          <PaperPane paper={paper} explained={explained} onExplain={explainSelection} />
          <ExplanationPane
            paper={paper}
            explained={explained}
            personalized={personalized}
            confirmed={paper === "cortical" ? confirmed : memory.mastered.includes("td_error")}
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
      </section>
    </main>
  );
}

function Sidebar({
  paper,
  onOpenPaper,
  onReset,
  confirmed,
}: {
  paper: PaperId;
  onOpenPaper: (paper: PaperId) => void;
  onReset: () => void;
  confirmed: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Sparkles size={16} /></div>
        <div><strong>Gloss</strong><span>Read. Understand. Remember.</span></div>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        <button className="active"><Library size={17} /> Library</button>
        <button><Network size={17} /> Knowledge</button>
        <button><StickyNote size={17} /> Notes</button>
        <button><BrainCircuit size={17} /> Memory</button>
      </nav>

      <p className="side-label">Your papers</p>
      {(Object.keys(PAPER_META) as PaperId[]).map((id) => (
        <button className={`paper-card ${paper === id ? "selected" : ""}`} key={id} onClick={() => onOpenPaper(id)}>
          <FileText size={17} />
          <span>
            <strong>{PAPER_META[id].title}</strong>
            <small>{PAPER_META[id].authors}</small>
            <i><b style={{ width: `${PAPER_META[id].progress}%` }} /></i>
          </span>
        </button>
      ))}

      <div className="profile-card">
        <div className="profile-heading"><GraduationCap size={17} /><strong>Sam’s learning profile</strong></div>
        <dl>
          <div><dt>Field</dt><dd>Neuroscience</dd></div>
          <div><dt>Level</dt><dd>Biology strong · ML new</dd></div>
          <div><dt>Style</dt><dd>Short · analogy first</dd></div>
        </dl>
      </div>
      <div className="sync-card">
        <span className={`sync-dot ${confirmed ? "live" : ""}`} />
        <div><strong>EverOS memory</strong><small>{confirmed ? "Reward signal synced" : "Ready to remember"}</small></div>
        <Check size={14} />
      </div>
      <button className="reset-button" onClick={onReset}><RotateCcw size={14} /> Reset demo</button>
    </aside>
  );
}

function Header({ paper }: { paper: PaperId }) {
  return (
    <header className="topbar">
      <div className="reading-title"><BookOpen size={16} /> Reading: <strong>{PAPER_META[paper].title}</strong><ChevronDown size={14} /></div>
      <div className="top-actions">
        <button className="action-primary"><Sparkles size={14} /> Explain</button>
        <button><StickyNote size={14} /> Take note</button>
      </div>
      <div className="search"><Search size={15} /><span>Search your knowledge</span><kbd>⌘ K</kbd></div>
      <div className="avatar">S</div>
    </header>
  );
}

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

function ExplanationPane({
  paper,
  explained,
  personalized,
  confirmed,
  note,
  onNote,
  onConfirm,
  onClose,
}: {
  paper: PaperId;
  explained: boolean;
  personalized: boolean;
  confirmed: boolean;
  note: string;
  onNote: (note: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <section className="explanation-pane">
      <div className="panel-tabs"><button className="active">Explain</button><button>Notes (2)</button><span /><button onClick={onClose}><X size={16} /></button></div>
      {!explained ? (
        <div className="empty-explanation">
          <div><Highlighter size={24} /></div>
          <h2>Select something you want to understand</h2>
          <p>Highlight a passage in the paper and Gloss will explain it using the source and what you already know.</p>
        </div>
      ) : (
        <div className="explanation-content">
          <div className="trust-row"><span><Check size={14} /> Grounded in this paper</span><ChevronDown size={14} /></div>
          <p className="eyebrow">Explanation</p>
          <p className="answer">{PAPER_COPY[paper].explanation}</p>
          <div className="analogy-card">
            <span><Sparkles size={14} /> Analogy</span>
            <p>{paper === "td"
              ? "Like checking your GPS arrival time: the difference between the ETA and when you actually arrive helps the GPS improve its next estimate."
              : "Like a thermostat getting one number back: warmer or colder. That tiny signal is enough to steer what it tries next."}</p>
          </div>

          {personalized && (
            <div className="memory-section">
              <p className="eyebrow">Built on your knowledge</p>
              <div className="memory-card">
                <div className="memory-icon"><Link2 size={15} /></div>
                <div><strong>Reward signal</strong><p>From <em>Embodied Neurocomputation</em></p><button>View in graph →</button></div>
              </div>
            </div>
          )}

          <textarea
            className="note-input"
            aria-label="Add a note"
            placeholder="Add a note in your own words…"
            value={note}
            onChange={(event) => onNote(event.target.value)}
          />
          <div className="explanation-footer">
            <span>{confirmed ? "Saved to your understanding" : "Does this make sense?"}</span>
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
    <aside className="graph-pane">
      <div className="graph-header"><div><Network size={16} /><strong>Your knowledge</strong></div><CircleHelp size={15} /></div>
      <div className="graph-tabs">
        <button className={activeTab === "graph" ? "active" : ""} onClick={() => onTab("graph")}>Graph</button>
        <button className={activeTab === "timeline" ? "active" : ""} onClick={() => onTab("timeline")}>Timeline</button>
      </div>
      {activeTab === "graph" ? (
        <>
          <div className="graph-legend">
            <span><i className="paper-one" /> Paper 1</span><span><i className="paper-two" /> Paper 2</span><span><i className="mastered" /> Mastered</span>
          </div>
          <div className="knowledge-canvas">
            <svg viewBox="0 0 380 275" role="img" aria-label="Knowledge graph connecting concepts from two papers">
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
          {crossPaper ? (
            <div className="connection-card pop-in">
              <div className="connection-icon"><Link2 size={16} /></div>
              <div><strong>Cross-paper connection</strong><p>Reward signal shaped your explanation of TD error.</p><button>Explore connection →</button></div>
            </div>
          ) : (
            <div className="graph-hint"><Sparkles size={16} /><span>Master a concept, then open Paper 2 to watch your knowledge transfer.</span></div>
          )}
        </>
      ) : (
        <div className="timeline">
          <div className="timeline-item complete"><i /><span><small>Paper 1</small><strong>Closed-loop learning</strong><p>3 concepts mastered</p></span></div>
          <div className={`timeline-item ${crossPaper ? "complete" : ""}`}><i /><span><small>Paper 2</small><strong>Temporal-difference learning</strong><p>{crossPaper ? "Connected to reward signal" : "Ready to explore"}</p></span></div>
        </div>
      )}
    </aside>
  );
}

function ProgressBar({ paper, confirmed, crossPaper }: { paper: PaperId; confirmed: boolean; crossPaper: boolean }) {
  return (
    <footer className="progress-bar">
      <div className="today-progress">
        <div className="ring"><span>{crossPaper ? "82" : confirmed ? "72" : "48"}%</span></div>
        <span><strong>Today’s progress</strong><small>{confirmed ? "Your understanding is taking shape." : "Keep reading, Sam."}</small></span>
      </div>
      <div className="metric"><strong>{confirmed ? 6 : 5}</strong><span>Concepts mastered</span></div>
      <div className="metric"><strong>{crossPaper ? 9 : 8}</strong><span>Connections drawn</span></div>
      <div className="metric"><strong>{paper === "td" ? 2 : 1}</strong><span>Papers explored</span></div>
      <div className="recent">
        <strong>Recent understanding</strong>
        <span className="recent-chip green">Closed loop</span>
        <span className="recent-chip blue">Reward signal</span>
        {crossPaper && <span className="recent-chip purple">TD error</span>}
      </div>
    </footer>
  );
}
