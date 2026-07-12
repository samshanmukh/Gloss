"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Database,
  Layers3,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserRound,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_CONCEPTS,
  KnowledgeGraph,
  Learner,
  LearnerMemory,
  ReadingNote,
  graphStore,
  learnerStore,
  memoryAdapter,
  noteStore,
} from "@/lib/gloss";

type MemoryView = "overview" | "timeline" | "explorer";

const QUICK_SEARCHES = [
  "What concepts have I mastered?",
  "What have I learned about reward signals?",
  "Show my reading notes",
  "What explanation style works for me?",
];

function conceptName(id: string) {
  const known: Record<string, string> = {
    reward_signal: "Reward signal",
    td_error: "Temporal-difference error",
  };
  return known[id] ?? id.replace(/^pdf:/, "").replace(/[_-]/g, " ");
}

function MemoryGlyph({ index }: { index: number }) {
  const icons = [BrainCircuit, Sparkles, BookOpen, StickyNote];
  const Icon = icons[index % icons.length];
  return <Icon size={15} />;
}

export default function MemoryWorkspace() {
  const [learner, setLearner] = useState<Learner>({ id: "sam", name: "Sam" });
  const [memory, setMemory] = useState<LearnerMemory>({ learnerId: "sam", preferredStyle: "short_plus_analogy", mastered: [] });
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], edges: [] });
  const [evidence, setEvidence] = useState<string[]>([]);
  const [query, setQuery] = useState("confirmed concepts, reading notes, tutor questions, and learning preferences");
  const [lastQuery, setLastQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [view, setView] = useState<MemoryView>("overview");
  const [expanded, setExpanded] = useState<number | null>(0);
  const [motion, setMotion] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const active = learnerStore.read();
      setLearner(active);
      setMemory(memoryAdapter.read(active.id));
      setNotes(noteStore.read(active.id));
      setGraph(graphStore.read(active.id));
      void retrieve(active.id, query);
    });
    return () => window.cancelAnimationFrame(frame);
    // query is the initial retrieval seed; later changes only run on explicit search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retrieve(learnerId: string, search: string) {
    if (!search.trim()) return;
    setLoading(true);
    setLastQuery(search);
    try {
      const result = await memoryAdapter.retrieve(learnerId, search.trim());
      setEvidence(result.evidence);
      setConnected(true);
    } catch {
      setEvidence([]);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  function runSearch(search = query) {
    setQuery(search);
    setView("explorer");
    setExpanded(0);
    void retrieve(learner.id, search);
  }

  const learnedNodes = useMemo(() => {
    const base = BASE_CONCEPTS.filter((concept) => {
      if (concept.id === "reward") return memory.mastered.includes("reward_signal");
      if (concept.id === "td-error") return memory.mastered.includes("td_error");
      return concept.status === "mastered";
    }).map((concept) => concept.label.replace("\n", " "));
    const dynamic = graph.nodes.map((node) => node.label);
    return Array.from(new Set([...base, ...dynamic]));
  }, [graph.nodes, memory.mastered]);

  const timeline = useMemo(
    () =>
      [
        ...notes.map((note) => ({
          id: note.id,
          at: note.updatedAt,
          type: "note" as const,
          title: `Note · ${note.sourceTitle}`,
          copy: note.content,
        })),
        ...memory.mastered.map((id, index) => ({
          id: `mastered-${id}`,
          at: Date.now() - (index + 1) * 3_600_000,
          type: "concept" as const,
          title: `Confirmed · ${conceptName(id)}`,
          copy: "Added to your durable understanding and available to personalize future explanations.",
        })),
      ].sort((a, b) => b.at - a.at),
    [memory.mastered, notes],
  );

  return (
    <main className={`memory-workspace ${motion ? "with-motion" : ""}`}>
      <div className="mw-ambient one" /><div className="mw-ambient two" />
      <header className="mw-topbar">
        <div className="mw-title">
          <Link className="mw-logo" href="/"><BrainCircuit size={18} /></Link>
          <div><strong>Memory Studio</strong><span>{learner.name}’s durable learning context</span></div>
        </div>
        <nav className="mw-tabs">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><Layers3 size={14} /> Overview</button>
          <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><Clock3 size={14} /> Timeline</button>
          <button className={view === "explorer" ? "active" : ""} onClick={() => setView("explorer")}><Search size={14} /> Explorer</button>
        </nav>
        <div className="mw-actions">
          <button className={motion ? "active" : ""} onClick={() => setMotion((value) => !value)}><WandSparkles size={14} /> Motion</button>
          <Link href="/knowledge"><Network size={14} /> Knowledge</Link>
          <Link href="/reader"><ArrowLeft size={14} /> Reader</Link>
        </div>
      </header>

      <section className="mw-shell">
        <aside className="mw-sidebar">
          <div className="mw-profile">
            <div className="mw-avatar">{learner.name.slice(0, 1).toUpperCase()}</div>
            <span><strong>{learner.name}</strong><small>learner/{learner.id}</small></span>
            <i className={connected ? "" : "offline"} />
          </div>
          <div className={`mw-connection ${connected ? "" : "offline"}`}>
            {connected ? <Cloud size={15} /> : <Database size={15} />}
            <div><strong>{connected ? "EverOS connected" : "Local fallback"}</strong><span>{connected ? "Hybrid memory online" : "Remote memory unavailable"}</span></div>
          </div>
          <div className="mw-metrics">
            <article><strong>{memory.mastered.length}</strong><span>Confirmed</span></article>
            <article><strong>{notes.length}</strong><span>Notes</span></article>
            <article><strong>{graph.nodes.length}</strong><span>AI concepts</span></article>
            <article><strong>{evidence.length}</strong><span>Retrieved</span></article>
          </div>
          <p className="mw-label">Memory layers</p>
          <div className="mw-layers">
            <button className="active" onClick={() => setView("overview")}><Zap size={14} /><span><strong>Working context</strong><small>Current learner state</small></span><i>{memory.mastered.length}</i></button>
            <button onClick={() => setView("timeline")}><Clock3 size={14} /><span><strong>Episodic memory</strong><small>Notes and tutor exchanges</small></span><i>{notes.length}</i></button>
            <button onClick={() => setView("explorer")}><BrainCircuit size={14} /><span><strong>Hybrid retrieval</strong><small>Semantic + keyword search</small></span><i>{evidence.length}</i></button>
          </div>
          <div className="mw-security"><ShieldCheck size={15} /><span><strong>Server-only credentials</strong><small>Memory is isolated by learner ID</small></span></div>
        </aside>

        <div className="mw-content">
          <div className="mw-search">
            <Search size={16} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
              placeholder="Ask your memory about a concept, note, question, or preference…"
            />
            {query && <button className="clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }}><X size={14} /></button>}
            <button className="submit" disabled={!query.trim() || loading} onClick={() => runSearch()}>
              {loading ? <Loader2 className="spin" size={14} /> : <><Sparkles size={14} /> Search memory</>}
            </button>
          </div>
          <div className="mw-quick-searches">
            {QUICK_SEARCHES.map((item) => <button key={item} onClick={() => runSearch(item)}>{item}</button>)}
          </div>

          {view === "overview" && (
            <div className="mw-overview">
              <section className="mw-hero-card">
                <div className="mw-memory-core">
                  <span className="core-ring one" /><span className="core-ring two" /><span className="core-ring three" />
                  <BrainCircuit size={34} />
                  <i>{memory.mastered.length + notes.length}</i>
                </div>
                <div><span>MEMORY PROFILE</span><h1>Your learning context is alive.</h1><p>Gloss retrieves these memories before answering so new explanations begin from concepts you have already confirmed.</p></div>
              </section>

              <div className="mw-overview-grid">
                <section className="mw-panel confirmed">
                  <header><div><Check size={15} /><span><strong>Confirmed understanding</strong><small>Durable concepts available across papers</small></span></div><em>{learnedNodes.length}</em></header>
                  <div className="mw-concept-cloud">
                    {learnedNodes.length ? learnedNodes.map((name, index) => <button key={name} onClick={() => runSearch(`What do I understand about ${name}?`)} style={{ animationDelay: `${index * 70}ms` }}><Check size={11} />{name}</button>) : <p>Confirm a concept in the reader to begin your durable profile.</p>}
                  </div>
                </section>

                <section className="mw-panel preferences">
                  <header><div><UserRound size={15} /><span><strong>Learning preferences</strong><small>How Gloss should explain new ideas</small></span></div></header>
                  <dl>
                    <div><dt>Style</dt><dd>Short first</dd></div>
                    <div><dt>Scaffolding</dt><dd>Analogy-led</dd></div>
                    <div><dt>Field</dt><dd>Neuroscience</dd></div>
                    <div><dt>Level</dt><dd>Biology strong · ML new</dd></div>
                  </dl>
                </section>

                <section className="mw-panel recent">
                  <header><div><StickyNote size={15} /><span><strong>Recent notes</strong><small>Explicit thoughts synced to memory</small></span></div><em>{notes.length}</em></header>
                  <div className="mw-note-stack">
                    {notes.length ? notes.slice(0, 4).map((note) => <article key={note.id}><StickyNote size={13} /><span><strong>{note.content}</strong><small>{note.sourceTitle}</small></span></article>) : <p>No saved notes yet.</p>}
                  </div>
                </section>

                <section className="mw-panel retrieval">
                  <header><div><BrainCircuit size={15} /><span><strong>Latest EverOS retrieval</strong><small>{lastQuery || "Initial learner context"}</small></span></div><button onClick={() => void retrieve(learner.id, lastQuery || query)}><RefreshCw size={13} /></button></header>
                  <div className="mw-evidence-preview">
                    {loading ? <div className="mw-loading"><Loader2 className="spin" size={18} /> Retrieving context…</div> : evidence.length ? evidence.slice(0, 2).map((item, index) => <article key={index}><MemoryGlyph index={index} /><p>{item.slice(0, 240)}{item.length > 240 ? "…" : ""}</p></article>) : <p>No evidence returned for this query.</p>}
                  </div>
                </section>
              </div>
            </div>
          )}

          {view === "timeline" && (
            <div className="mw-view">
              <div className="mw-view-heading"><span>EPISODIC MEMORY</span><h1>Your learning, in sequence.</h1><p>Notes and confirmed concepts form a durable record that future explanations can build on.</p></div>
              <div className="mw-timeline">
                {timeline.length ? timeline.map((item, index) => (
                  <article key={item.id} style={{ animationDelay: `${index * 65}ms` }}>
                    <div className={`mw-time-icon ${item.type}`}>{item.type === "note" ? <StickyNote size={15} /> : <Check size={15} />}</div>
                    <time>{new Date(item.at).toLocaleString()}</time>
                    <span><strong>{item.title}</strong><p>{item.copy}</p></span>
                  </article>
                )) : <div className="mw-empty"><Clock3 size={28} /><strong>No learning events yet</strong><p>Save notes or confirm concepts in the reader.</p></div>}
              </div>
            </div>
          )}

          {view === "explorer" && (
            <div className="mw-view">
              <div className="mw-view-heading"><span>HYBRID EXPLORER</span><h1>Retrieved from your memory.</h1><p>EverOS searches episodic memory, learner profile, and raw messages using semantic and keyword signals.</p></div>
              {loading ? (
                <div className="mw-explorer-loading"><div className="mw-scan"><BrainCircuit size={26} /></div><strong>Searching EverOS</strong><p>Combining semantic relevance with exact memory signals…</p></div>
              ) : evidence.length ? (
                <div className="mw-results">
                  <div className="mw-result-meta"><span><i /> {evidence.length} memories retrieved</span><small>Query: “{lastQuery}”</small></div>
                  {evidence.map((item, index) => (
                    <article className={expanded === index ? "expanded" : ""} key={`${index}-${item.slice(0, 24)}`} style={{ animationDelay: `${index * 80}ms` }}>
                      <button onClick={() => setExpanded(expanded === index ? null : index)}>
                        <span className="mw-result-icon"><MemoryGlyph index={index} /></span>
                        <span><small>{item.includes("[GLOSS_NOTE]") ? "Reading note" : index === 0 ? "Highest relevance" : "Related memory"}</small><strong>{item.slice(0, 115)}{item.length > 115 ? "…" : ""}</strong></span>
                        <ChevronDown size={15} />
                      </button>
                      {expanded === index && <div className="mw-result-body"><p>{item}</p><footer><BrainCircuit size={12} /> Retrieved through EverOS hybrid search</footer></div>}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mw-empty"><Search size={28} /><strong>No matching memories</strong><p>Try a concept name, paper title, or ask about your learning preferences.</p></div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
