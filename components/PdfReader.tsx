"use client";

import { ChevronLeft, ChevronRight, Loader2, Maximize2, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ConceptMatch, ExplainedConcept, findConceptMatches } from "@/lib/gloss";

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const MIN_SELECTION_LENGTH = 3;

function clearConceptHighlights(root: HTMLElement) {
  root.querySelectorAll("mark.concept-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

// A phrase can span several absolutely-positioned text-layer spans, so wrap
// each overlapping text-node slice in its own mark. Matches are processed
// last-to-first so splitText never invalidates earlier offsets.
function wrapMatch(nodes: Array<{ node: Text; start: number }>, match: ConceptMatch) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const { node, start } = nodes[i];
    const length = node.nodeValue?.length ?? 0;
    if (start >= match.end || start + length <= match.start) continue;
    const from = Math.max(0, match.start - start);
    const target = node.splitText(from);
    target.splitText(Math.min(length, match.end - start) - from);
    const mark = document.createElement("mark");
    mark.className = "concept-highlight";
    mark.dataset.conceptId = match.concept.id;
    mark.tabIndex = 0;
    mark.setAttribute("role", "button");
    mark.setAttribute("aria-label", `Revisit your explanation of “${match.concept.phrase.slice(0, 80)}”`);
    mark.title = `You asked about “${match.concept.phrase.slice(0, 80)}” before — click to revisit`;
    target.parentNode?.replaceChild(mark, target);
    mark.appendChild(target);
  }
}

function applyConceptHighlights(root: HTMLElement, concepts: ExplainedConcept[]) {
  clearConceptHighlights(root);
  if (!concepts.length) return;
  // Walk elements too: pdf.js marks line ends with <br>, and adjacent line spans
  // carry no whitespace of their own — without a separator "…Flow" + "Food…"
  // would glue into "FlowFood" and word-boundary matching would miss it.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const nodes: Array<{ node: Text; start: number }> = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).tagName === "BR") text += "\n";
      continue;
    }
    nodes.push({ node: node as Text, start: text.length });
    text += node.nodeValue ?? "";
  }
  if (!text) return;
  const matches = findConceptMatches(text, concepts);
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    wrapMatch(nodes, matches[i]);
  }
}

export default function PdfReader({
  file,
  concepts,
  onSelectText,
  onConceptClick,
}: {
  file: File;
  concepts: ExplainedConcept[];
  onSelectText: (text: string, page: number) => void;
  onConceptClick: (conceptId: string, page: number) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selection, setSelection] = useState("");
  const conceptsRef = useRef(concepts);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const renderTask = useRef<{ cancel: () => void } | null>(null);

  // The parent remounts this component per file (via key), so state starts fresh.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const data = await file.arrayBuffer();
        loaded = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        setDoc(loaded);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      void loaded?.loadingTask.destroy();
    };
  }, [file]);

  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    if (!doc || !canvas || !textLayerDiv) return;

    renderTask.current?.cancel();
    const pdfjs = await import("pdfjs-dist");
    const pdfPage = await doc.getPage(page);
    const scale = ZOOM_LEVELS[zoomIndex];
    const viewport = pdfPage.getViewport({ scale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    const task = pdfPage.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
    });
    renderTask.current = task;

    textLayerDiv.innerHTML = "";
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
    textLayerDiv.style.setProperty("--scale-factor", String(scale));
    textLayerDiv.style.setProperty("--total-scale-factor", String(scale));
    const textLayer = new pdfjs.TextLayer({
      textContentSource: pdfPage.streamTextContent(),
      container: textLayerDiv,
      viewport,
    });

    try {
      await Promise.all([task.promise, textLayer.render()]);
      applyConceptHighlights(textLayerDiv, conceptsRef.current);
    } catch {
      // Render tasks are cancelled when the page or zoom changes quickly.
    }
  }, [doc, page, zoomIndex]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  useEffect(() => {
    conceptsRef.current = concepts;
    if (textLayerRef.current) applyConceptHighlights(textLayerRef.current, concepts);
  }, [concepts]);

  function captureSelection() {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSelection(text.length >= MIN_SELECTION_LENGTH ? text : "");
  }

  function handleConceptClick(event: React.MouseEvent) {
    if (window.getSelection()?.isCollapsed === false) return;
    const mark = (event.target as HTMLElement).closest?.("mark.concept-highlight");
    const conceptId = mark?.getAttribute("data-concept-id");
    if (conceptId) onConceptClick(conceptId, page);
  }

  function handleConceptKey(event: React.KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const mark = (event.target as HTMLElement).closest?.("mark.concept-highlight");
    const conceptId = mark?.getAttribute("data-concept-id");
    if (conceptId) {
      event.preventDefault();
      onConceptClick(conceptId, page);
    }
  }

  function explainSelection() {
    if (!selection) return;
    onSelectText(selection.slice(0, 2400), page);
    setSelection("");
    window.getSelection()?.removeAllRanges();
  }

  if (status === "error") {
    return (
      <article className="paper-pane pdf-pane">
        <div className="pdf-status">Could not read this PDF. Try a different file.</div>
      </article>
    );
  }

  return (
    <article className="paper-pane pdf-pane">
      <div className="reader-toolbar">
        <button className="toolbar-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft size={15} />
        </button>
        <span className="page-number">{page}</span>
        <span>/ {doc?.numPages ?? "…"}</span>
        <button className="toolbar-button" aria-label="Next page" disabled={!doc || page >= doc.numPages} onClick={() => setPage((p) => Math.min(doc?.numPages ?? p, p + 1))}>
          <ChevronRight size={15} />
        </button>
        <span className="toolbar-spacer" />
        <button className="toolbar-button" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}>
          <ZoomOut size={15} />
        </button>
        <span className="zoom-value">{Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%</span>
        <button className="toolbar-button" aria-label="Zoom in" disabled={zoomIndex >= ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}>
          <ZoomIn size={15} />
        </button>
        <button
          className="toolbar-button"
          aria-label="Fullscreen"
          onClick={() => void pageWrapRef.current?.closest(".pdf-pane")?.requestFullscreen?.()}
        >
          <Maximize2 size={15} />
        </button>
      </div>

      <div className="pdf-scroll" onMouseUp={captureSelection} onClick={handleConceptClick} onKeyDown={handleConceptKey}>
        {status === "loading" && (
          <div className="pdf-status"><Loader2 className="spin" size={18} /> Opening {file.name}…</div>
        )}
        <div className={`pdf-page-wrap ${status === "ready" ? "" : "hidden"}`} ref={pageWrapRef}>
          <canvas ref={canvasRef} />
          <div className="textLayer pdf-text-layer" ref={textLayerRef} />
        </div>
        {selection && (
          <div className="pdf-explain-bar pop-in">
            <p>“{selection.slice(0, 140)}{selection.length > 140 ? "…" : ""}”</p>
            <button onClick={explainSelection}><Sparkles size={13} /> Explain this</button>
          </div>
        )}
      </div>
    </article>
  );
}
