"use client";

import { BrainCircuit, FileText, Loader2, Network, Search, StickyNote, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BASE_CONCEPTS, PAPER_META, PaperId, memoryAdapter } from "@/lib/gloss";

type PaletteResult = {
  id: string;
  group: "Papers" | "Concepts" | "Notes";
  title: string;
  subtitle: string;
  action: () => void;
};

export default function CommandPalette({
  learnerId,
  mastered,
  note,
  onClose,
  onOpenPaper,
  onFocusGraph,
}: {
  learnerId: string;
  mastered: string[];
  note: string;
  onClose: () => void;
  onOpenPaper: (paper: PaperId) => void;
  onFocusGraph: () => void;
}) {
  const [query, setQuery] = useState("");
  const [memoryState, setMemoryState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [memoryEvidence, setMemoryEvidence] = useState<string[]>([]);

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase();
    const all: PaletteResult[] = [
      ...(Object.keys(PAPER_META) as PaperId[]).map((id) => ({
        id: `paper-${id}`,
        group: "Papers" as const,
        title: PAPER_META[id].title,
        subtitle: PAPER_META[id].authors,
        action: () => {
          onOpenPaper(id);
          onClose();
        },
      })),
      ...BASE_CONCEPTS.map((concept) => ({
        id: `concept-${concept.id}`,
        group: "Concepts" as const,
        title: concept.label.replace("\n", " "),
        subtitle: `${PAPER_META[concept.paper].shortTitle} · ${
          mastered.includes(concept.id === "reward" ? "reward_signal" : concept.id) ? "mastered" : concept.status
        }`,
        action: () => {
          onFocusGraph();
          onClose();
        },
      })),
      ...(note.trim()
        ? [
            {
              id: "note-current",
              group: "Notes" as const,
              title: note.trim().slice(0, 70),
              subtitle: "Your note on the current explanation",
              action: onClose,
            },
          ]
        : []),
    ];
    if (!q) return all;
    return all.filter(
      (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q),
    );
  }, [query, note, mastered, onClose, onOpenPaper, onFocusGraph]);

  async function searchMemory() {
    if (!query.trim()) return;
    setMemoryState("loading");
    try {
      const remote = await memoryAdapter.retrieve(learnerId, query.trim());
      setMemoryEvidence(remote.evidence);
      setMemoryState("done");
    } catch {
      setMemoryState("error");
    }
  }

  const groups = ["Papers", "Concepts", "Notes"] as const;

  return (
    <div className="overlay" role="dialog" aria-label="Search your knowledge" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <Search size={15} />
          <input
            autoFocus
            value={query}
            placeholder="Search papers, concepts, notes… or ask your memory"
            onChange={(event) => {
              setQuery(event.target.value);
              setMemoryState("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter" && query.trim()) void searchMemory();
            }}
          />
          <button aria-label="Close search" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="palette-results">
          {groups.map((group) => {
            const items = results.filter((item) => item.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <p className="palette-group">{group}</p>
                {items.map((item) => (
                  <button className="palette-item" key={item.id} onClick={item.action}>
                    {group === "Papers" ? <FileText size={14} /> : group === "Concepts" ? <Network size={14} /> : <StickyNote size={14} />}
                    <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  </button>
                ))}
              </div>
            );
          })}

          {query.trim() && (
            <div>
              <p className="palette-group">EverOS memory</p>
              {memoryState === "idle" && (
                <button className="palette-item" onClick={() => void searchMemory()}>
                  <BrainCircuit size={14} />
                  <span><strong>Search your memory for “{query.trim().slice(0, 50)}”</strong><small>Hybrid retrieval across confirmed concepts</small></span>
                </button>
              )}
              {memoryState === "loading" && (
                <div className="palette-item static"><Loader2 className="spin" size={14} /><span><strong>Searching EverOS…</strong></span></div>
              )}
              {memoryState === "error" && (
                <div className="palette-item static"><BrainCircuit size={14} /><span><strong>Memory unavailable</strong><small>EverOS could not be reached</small></span></div>
              )}
              {memoryState === "done" &&
                (memoryEvidence.length ? (
                  memoryEvidence.slice(0, 4).map((evidence, index) => (
                    <div className="palette-item static" key={index}>
                      <BrainCircuit size={14} />
                      <span><strong>{evidence.slice(0, 90)}{evidence.length > 90 ? "…" : ""}</strong><small>Retrieved from your EverOS memory</small></span>
                    </div>
                  ))
                ) : (
                  <div className="palette-item static">
                    <BrainCircuit size={14} />
                    <span><strong>No memories yet</strong><small>Confirm concepts while reading to build your memory</small></span>
                  </div>
                ))}
            </div>
          )}

          {!results.length && !query.trim() && (
            <p className="palette-empty">Type to search your knowledge.</p>
          )}
        </div>
      </div>
    </div>
  );
}
