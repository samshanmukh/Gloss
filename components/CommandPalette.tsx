"use client";

import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  FileText,
  History,
  Library,
  Loader2,
  Network,
  Search,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BASE_CONCEPTS,
  ExplainedConcept,
  KnowledgeGraph,
  LibraryPdf,
  PAPER_META,
  PaperId,
  ReadingNote,
  conceptStore,
  graphStore,
  memoryAdapter,
  noteStore,
  pdfStore,
} from "@/lib/gloss";

type Group = "Papers" | "Concepts" | "Notes" | "History" | "Navigate";

type PaletteResult = {
  id: string;
  group: Group;
  title: string;
  subtitle: string;
  keywords: string;
  icon: typeof FileText;
  badge?: string;
  action: () => void;
};

export default function CommandPalette({
  learnerId,
  mastered,
  note,
  onClose,
  onOpenPaper,
  onOpenConcept,
}: {
  learnerId: string;
  mastered: string[];
  note: string;
  onClose: () => void;
  onOpenPaper: (paper: PaperId) => void;
  onOpenConcept: (conceptId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [uploads, setUploads] = useState<LibraryPdf[]>([]);
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [concepts, setConcepts] = useState<ExplainedConcept[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], edges: [] });
  const [memoryState, setMemoryState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [memoryEvidence, setMemoryEvidence] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNotes(noteStore.read(learnerId));
      setConcepts(conceptStore.read(learnerId));
      setGraph(graphStore.read(learnerId));
      void pdfStore.list(learnerId).then(setUploads);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [learnerId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setMemoryState("loading");
      void memoryAdapter
        .retrieve(learnerId, query.trim())
        .then((remote) => {
          setMemoryEvidence(remote.evidence);
          setMemoryState("done");
        })
        .catch(() => setMemoryState("error"));
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [learnerId, query]);

  const navigate = useCallback((path: string) => {
    onClose();
    window.location.assign(path);
  }, [onClose]);

  const allResults = useMemo<PaletteResult[]>(() => {
    const included: PaletteResult[] = (Object.keys(PAPER_META) as PaperId[]).map((id) => ({
      id: `paper-${id}`,
      group: "Papers",
      title: PAPER_META[id].title,
      subtitle: PAPER_META[id].authors,
      keywords: `${PAPER_META[id].title} ${PAPER_META[id].authors}`,
      icon: BookOpen,
      badge: `${PAPER_META[id].progress}% read`,
      action: () => {
        onOpenPaper(id);
        onClose();
      },
    }));
    const uploaded: PaletteResult[] = uploads.map((paper) => ({
      id: `pdf-${paper.id}`,
      group: "Papers",
      title: paper.name,
      subtitle: `Private PDF · ${(paper.size / 1024 / 1024).toFixed(1)} MB`,
      keywords: `${paper.name} uploaded private pdf`,
      icon: FileText,
      badge: "Uploaded",
      action: () => navigate(`/reader?pdf=${encodeURIComponent(paper.id)}`),
    }));
    const baseConcepts: PaletteResult[] = BASE_CONCEPTS.map((concept) => ({
      id: `base-${concept.id}`,
      group: "Concepts",
      title: concept.label.replace("\n", " "),
      subtitle: `${PAPER_META[concept.paper].title} · ${
        mastered.includes(concept.id === "reward" ? "reward_signal" : concept.id) ? "mastered" : concept.status
      }`,
      keywords: `${concept.label} ${PAPER_META[concept.paper].title} ${concept.status}`,
      icon: Network,
      badge: mastered.includes(concept.id === "reward" ? "reward_signal" : concept.id) ? "Mastered" : concept.status,
      action: () => navigate("/knowledge"),
    }));
    const dynamicConcepts: PaletteResult[] = graph.nodes.map((concept) => ({
      id: `graph-${concept.id}`,
      group: "Concepts",
      title: concept.label,
      subtitle: concept.summary || concept.sourceTitle,
      keywords: `${concept.label} ${concept.summary} ${concept.sourceTitle}`,
      icon: Network,
      badge: concept.status,
      action: () => navigate(`/knowledge?focus=${encodeURIComponent(concept.id)}`),
    }));
    const savedNotes: PaletteResult[] = notes.map((saved) => ({
      id: `note-${saved.id}`,
      group: "Notes",
      title: saved.content.slice(0, 100),
      subtitle: `${saved.sourceTitle}${saved.page ? ` · page ${saved.page}` : ""}`,
      keywords: `${saved.content} ${saved.sourceTitle}`,
      icon: StickyNote,
      badge: new Date(saved.updatedAt).toLocaleDateString(),
      action: () => navigate("/reader?panel=notes"),
    }));
    const draft: PaletteResult[] = note.trim()
      ? [{
          id: "note-draft",
          group: "Notes",
          title: note.trim().slice(0, 100),
          subtitle: "Unsaved note on the current explanation",
          keywords: note,
          icon: StickyNote,
          badge: "Draft",
          action: () => navigate("/reader?panel=notes"),
        }]
      : [];
    const history: PaletteResult[] = concepts.map((concept) => ({
      id: `history-${concept.id}`,
      group: "History",
      title: concept.phrase,
      subtitle: `${concept.sourceTitle}${concept.page ? ` · page ${concept.page}` : ""} · ${concept.thread.length} questions`,
      keywords: `${concept.phrase} ${concept.sourceTitle} ${concept.thread.map((entry) => `${entry.question} ${entry.answer}`).join(" ")}`,
      icon: History,
      badge: `${concept.visits} visits`,
      action: () => {
        onOpenConcept(concept.id);
        onClose();
      },
    }));
    const navigation: PaletteResult[] = [
      { id: "go-library", group: "Navigate", title: "Open Research Library", subtitle: "Papers, uploads, reading queue, and progress", keywords: "library papers uploads", icon: Library, action: () => navigate("/library") },
      { id: "go-knowledge", group: "Navigate", title: "Open Knowledge Studio", subtitle: "Explore concepts and cross-paper connections", keywords: "knowledge graph concepts", icon: Network, action: () => navigate("/knowledge") },
      { id: "go-memory", group: "Navigate", title: "Open Memory Studio", subtitle: "Search EverOS learner memory", keywords: "memory everos profile", icon: BrainCircuit, action: () => navigate("/memory") },
      { id: "go-notes", group: "Navigate", title: "Open Notes", subtitle: "Create, edit, and connect reading notes", keywords: "notes annotations", icon: StickyNote, action: () => navigate("/reader?panel=notes") },
    ];
    return [...included, ...uploaded, ...baseConcepts, ...dynamicConcepts, ...savedNotes, ...draft, ...history, ...navigation];
  }, [concepts, graph.nodes, mastered, navigate, note, notes, onClose, onOpenConcept, onOpenPaper, uploads]);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return allResults;
    return allResults
      .map((item) => ({
        item,
        score: terms.reduce((score, term) => {
          const title = item.title.toLowerCase();
          const haystack = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
          return score + (title.startsWith(term) ? 5 : title.includes(term) ? 3 : haystack.includes(term) ? 1 : 0);
        }, 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [allResults, query]);

  const actionable = [
    ...results,
    ...(memoryState === "done"
      ? memoryEvidence.map((evidence, index) => ({
          id: `memory-${index}`,
          group: "History" as const,
          title: evidence.slice(0, 120),
          subtitle: "Retrieved from EverOS hybrid memory",
          keywords: evidence,
          icon: BrainCircuit,
          badge: "Memory",
          action: () => navigate(`/memory?q=${encodeURIComponent(query)}`),
        }))
      : []),
  ];
  const groups: Group[] = query.trim() ? ["Papers", "Concepts", "Notes", "History", "Navigate"] : ["Navigate", "Papers", "Concepts", "Notes", "History"];

  function moveActive(direction: number) {
    setActiveIndex((index) => Math.max(0, Math.min(actionable.length - 1, index + direction)));
  }

  return (
    <div className="overlay palette-overlay" role="dialog" aria-label="Search Gloss" onClick={onClose}>
      <div className="palette palette-v2" onClick={(event) => event.stopPropagation()}>
        <header className="palette-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            placeholder="Search papers, concepts, notes, explanations, or memory…"
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setActiveIndex(0);
              if (value.trim().length < 2) {
                setMemoryState("idle");
                setMemoryEvidence([]);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActive(1);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(-1);
              }
              if (event.key === "Enter" && actionable[activeIndex]) {
                event.preventDefault();
                actionable[activeIndex].action();
              }
            }}
          />
          {query && <button aria-label="Clear search" onClick={() => { setQuery(""); setMemoryState("idle"); setMemoryEvidence([]); setActiveIndex(0); }}><X size={15} /></button>}
          <kbd>ESC</kbd>
        </header>

        <div className="palette-body">
          <aside className="palette-scope">
            <strong>Search all of Gloss</strong>
            <span><FileText size={13} /> {uploads.length + 2} papers</span>
            <span><Network size={13} /> {BASE_CONCEPTS.length + graph.nodes.length} concepts</span>
            <span><StickyNote size={13} /> {notes.length} notes</span>
            <span><History size={13} /> {concepts.length} explanations</span>
            <i />
            <small>EverOS memory searches automatically after you type.</small>
          </aside>

          <div className="palette-results">
            {groups.map((group) => {
              const items = actionable.filter((item) => item.group === group);
              if (!items.length) return null;
              return (
                <section key={group}>
                  <p className="palette-group">{group}</p>
                  {items.slice(0, group === "Concepts" ? 8 : 5).map((item) => {
                    const index = actionable.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        className={`palette-item ${activeIndex === index ? "active" : ""}`}
                        key={item.id}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={item.action}
                      >
                        <span className="palette-item-icon"><Icon size={15} /></span>
                        <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                        {item.badge && <em>{item.badge}</em>}
                        <ArrowRight size={13} />
                      </button>
                    );
                  })}
                </section>
              );
            })}

            {query.trim().length >= 2 && memoryState === "loading" && (
              <div className="palette-memory-state"><Loader2 className="spin" size={15} /> Searching EverOS memory…</div>
            )}
            {query.trim().length >= 2 && memoryState === "error" && (
              <div className="palette-memory-state error"><BrainCircuit size={15} /> EverOS is unavailable; local results still work.</div>
            )}
            {!actionable.length && memoryState !== "loading" && (
              <div className="palette-empty"><Sparkles size={23} /><strong>No matching knowledge yet</strong><p>Try a paper title, concept, note text, or a question for your memory.</p></div>
            )}
          </div>
        </div>

        <footer className="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>esc</kbd> Close</span>
          <strong>{actionable.length} results</strong>
        </footer>
      </div>
    </div>
  );
}
