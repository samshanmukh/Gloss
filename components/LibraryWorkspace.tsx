"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  FilePlus2,
  FileText,
  Grid2X2,
  HardDrive,
  Library,
  List,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  LibraryPdf,
  PAPER_META,
  PaperId,
  graphStore,
  learnerStore,
  noteStore,
  pdfStore,
} from "@/lib/gloss";

type LibraryView = "grid" | "list";
type LibraryFilter = "all" | "included" | "uploaded";

type LibraryItem = {
  id: string;
  type: "included" | "uploaded";
  title: string;
  subtitle: string;
  progress: number;
  size?: number;
  addedAt: number;
  href: string;
  paperId?: PaperId;
  file?: LibraryPdf;
  concepts: number;
  notes: number;
};

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryWorkspace() {
  const [learnerId, setLearnerId] = useState("sam");
  const [learnerName, setLearnerName] = useState("Sam");
  const [uploads, setUploads] = useState<LibraryPdf[]>([]);
  const [view, setView] = useState<LibraryView>("grid");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [dynamicConcepts, setDynamicConcepts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh(activeLearnerId: string) {
    setUploads(await pdfStore.list(activeLearnerId));
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const learner = learnerStore.read();
      setLearnerId(learner.id);
      setLearnerName(learner.name);
      const notes = noteStore.read(learner.id);
      const counts = notes.reduce<Record<string, number>>((acc, note) => {
        acc[note.sourceTitle] = (acc[note.sourceTitle] ?? 0) + 1;
        return acc;
      }, {});
      setNoteCounts(counts);
      setDynamicConcepts(graphStore.read(learner.id).nodes.length);
      void refresh(learner.id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const items = useMemo<LibraryItem[]>(() => {
    const included = (Object.keys(PAPER_META) as PaperId[]).map((id) => {
      const meta = PAPER_META[id];
      const concepts = id === "cortical" ? 4 : 3;
      return {
        id,
        type: "included" as const,
        title: meta.title,
        subtitle: meta.authors,
        progress: meta.progress,
        addedAt: id === "cortical" ? 1 : 2,
        href: `/reader?paper=${id}`,
        paperId: id,
        concepts,
        notes: noteCounts[meta.title] ?? 0,
      };
    });
    const uploaded = uploads.map((paper, index) => ({
      id: paper.id,
      type: "uploaded" as const,
      title: paper.name,
      subtitle: `Private PDF · ${formatBytes(paper.size)}`,
      progress: index === 0 ? 12 : 0,
      size: paper.size,
      addedAt: paper.addedAt,
      href: `/reader?pdf=${encodeURIComponent(paper.id)}`,
      file: paper,
      concepts: dynamicConcepts,
      notes: noteCounts[paper.name] ?? 0,
    }));
    return [...uploaded, ...included].filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;
      const normalized = query.trim().toLowerCase();
      const matchesQuery = !normalized || item.title.toLowerCase().includes(normalized) || item.subtitle.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [dynamicConcepts, filter, noteCounts, query, uploads]);

  async function addFiles(files: File[]) {
    const pdfs = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      setMessage("Choose PDF files to add to your private library.");
      return;
    }
    setSaving(true);
    try {
      for (const file of pdfs) await pdfStore.write(learnerId, file);
      await refresh(learnerId);
      setMessage(`${pdfs.length} PDF${pdfs.length === 1 ? "" : "s"} saved privately in this browser.`);
    } catch {
      setMessage("The browser could not persist these files. Check available storage.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setMessage(""), 4500);
    }
  }

  async function removePdf(paper: LibraryPdf) {
    await pdfStore.remove(learnerId, paper.id);
    await refresh(learnerId);
    setMessage(`${paper.name} removed from this browser.`);
    window.setTimeout(() => setMessage(""), 3500);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  const totalNotes = Object.values(noteCounts).reduce((sum, count) => sum + count, 0);

  return (
    <main className="library-workspace">
      <div className="lw-glow one" /><div className="lw-glow two" />
      <header className="lw-topbar">
        <div className="lw-title">
          <Link className="lw-logo" href="/"><Library size={18} /></Link>
          <div><strong>Research Library</strong><span>{learnerName}’s private paper collection</span></div>
        </div>
        <div className="lw-top-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your papers…" />{query && <button onClick={() => setQuery("")}><X size={13} /></button>}</div>
        <div className="lw-actions">
          <Link href="/knowledge"><Network size={14} /> Knowledge</Link>
          <Link href="/memory"><BrainCircuit size={14} /> Memory</Link>
          <Link href="/reader"><ArrowLeft size={14} /> Reader</Link>
        </div>
      </header>

      <section className="lw-shell">
        <aside className="lw-sidebar">
          <div className="lw-profile"><div>{learnerName.slice(0, 1).toUpperCase()}</div><span><strong>{learnerName}</strong><small>learner/{learnerId}</small></span><i /></div>
          <p className="lw-label">Library</p>
          <nav className="lw-filters">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><Library size={14} /><span>All papers</span><i>{uploads.length + 2}</i></button>
            <button className={filter === "included" ? "active" : ""} onClick={() => setFilter("included")}><BookOpen size={14} /><span>Included papers</span><i>2</i></button>
            <button className={filter === "uploaded" ? "active" : ""} onClick={() => setFilter("uploaded")}><HardDrive size={14} /><span>Private uploads</span><i>{uploads.length}</i></button>
          </nav>
          <div className="lw-summary">
            <p className="lw-label">Collection</p>
            <article><FileText size={14} /><span><strong>{uploads.length + 2} papers</strong><small>{uploads.length} stored in-browser</small></span></article>
            <article><StickyNote size={14} /><span><strong>{totalNotes} notes</strong><small>Synced to EverOS</small></span></article>
            <article><Network size={14} /><span><strong>{dynamicConcepts + 7} concepts</strong><small>Across your graph</small></span></article>
          </div>
          <div className="lw-private"><ShieldCheck size={15} /><span><strong>Private by design</strong><small>Full PDFs never leave your browser.</small></span></div>
        </aside>

        <div className="lw-content">
          <section className="lw-hero">
            <div><span>YOUR RESEARCH HOME</span><h1>Pick up where you left off.</h1><p>Your papers, notes, concepts, and reading progress stay connected to one learner profile.</p></div>
            <div className="lw-hero-stats">
              <article><strong>{uploads.length + 2}</strong><span>Papers</span></article>
              <article><strong>{totalNotes}</strong><span>Notes</span></article>
              <article><strong>{dynamicConcepts + 7}</strong><span>Concepts</span></article>
            </div>
          </section>

          <section
            className={`lw-dropzone ${dragging ? "dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div><Upload size={20} /></div>
            <span><strong>{saving ? "Saving to your browser…" : "Drop PDFs to add them"}</strong><small>Files stay private in IndexedDB · select multiple at once</small></span>
            <button disabled={saving} onClick={() => inputRef.current?.click()}><FilePlus2 size={14} /> Choose files</button>
            <input ref={inputRef} hidden multiple type="file" accept="application/pdf,.pdf" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          </section>
          {message && <div className="lw-message"><Check size={13} />{message}</div>}

          <div className="lw-collection-head">
            <div><span>{filter === "all" ? "All papers" : filter === "included" ? "Included papers" : "Private uploads"}</span><small>{items.length} result{items.length === 1 ? "" : "s"}</small></div>
            <div className="lw-view-toggle"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={14} /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List view"><List size={14} /></button></div>
          </div>

          {items.length ? (
            <div className={`lw-papers ${view}`}>
              {items.map((item, index) => (
                <article className={`lw-paper ${item.type}`} key={item.id} style={{ animationDelay: `${index * 65}ms` }}>
                  <Link className="lw-paper-main" href={item.href}>
                    <div className={`lw-cover ${item.paperId ?? "upload"}`}>
                      <span>{item.type === "included" ? "GLOSS EDITION" : "PRIVATE PDF"}</span>
                      {item.paperId === "cortical" ? <BrainCircuit size={29} /> : item.paperId === "td" ? <Sparkles size={29} /> : <FileText size={29} />}
                      <strong>{item.title.replace(/[-_]/g, " ").slice(0, 45)}</strong>
                      <small>{item.type === "included" ? item.subtitle.split("·")[0] : formatBytes(item.size)}</small>
                      <i>{item.paperId === "cortical" ? "01" : item.paperId === "td" ? "02" : "PDF"}</i>
                    </div>
                    <div className="lw-paper-copy">
                      <span>{item.type === "included" ? "Included paper" : "Browser-stored PDF"}</span>
                      <h2>{item.title}</h2>
                      <p>{item.subtitle}</p>
                      <div className="lw-paper-meta"><span><Network size={12} /> {item.concepts} concepts</span><span><StickyNote size={12} /> {item.notes} notes</span></div>
                      <div className="lw-progress"><span><i style={{ width: `${item.progress}%` }} /></span><small>{item.progress}% read</small></div>
                    </div>
                    <span className="lw-open">Open <ArrowRight size={13} /></span>
                  </Link>
                  {item.file && <button className="lw-delete" aria-label={`Remove ${item.title}`} onClick={() => void removePdf(item.file!)}><Trash2 size={13} /></button>}
                </article>
              ))}
            </div>
          ) : (
            <div className="lw-empty"><Search size={28} /><strong>No papers found</strong><p>Try another search, change the filter, or upload a PDF.</p><button onClick={() => { setQuery(""); setFilter("all"); }}>Show all papers</button></div>
          )}
        </div>
      </section>
    </main>
  );
}
