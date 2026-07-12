"use client";

import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Maximize2, Sigma, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
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

type NormalizedRect = { x: number; y: number; width: number; height: number };

type DetectedRegion = {
  id: string;
  kind: "image" | "formula";
  label: string;
  text: string;
  page: number;
  rect: NormalizedRect;
};

export type PdfSelectedContent = {
  id: string;
  kind: "text" | "image" | "formula";
  text: string;
  page: number;
  imageData?: string;
};

export default function PdfReader({
  file,
  concepts,
  onSelectContent,
  onClearSelection,
  onConceptClick,
}: {
  file: File;
  concepts: ExplainedConcept[];
  onSelectContent: (selection: PdfSelectedContent) => void;
  onClearSelection: () => void;
  onConceptClick: (conceptId: string, page: number) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selection, setSelection] = useState<PdfSelectedContent | null>(null);
  const [selectionRects, setSelectionRects] = useState<NormalizedRect[]>([]);
  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const conceptsRef = useRef(concepts);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const renderTask = useRef<{ cancel: () => void } | null>(null);

  function normalizeRect(rect: { left: number; top: number; width: number; height: number }, container: DOMRect): NormalizedRect {
    return {
      x: (rect.left - container.left) / container.width,
      y: (rect.top - container.top) / container.height,
      width: rect.width / container.width,
      height: rect.height / container.height,
    };
  }

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
    const textContent = await pdfPage.getTextContent();
    const textLayer = new pdfjs.TextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport,
    });

    try {
      await Promise.all([task.promise, textLayer.render()]);
      applyConceptHighlights(textLayerDiv, conceptsRef.current);
      const detected: DetectedRegion[] = [];
      const operatorList = await pdfPage.getOperatorList();
      const stack: number[][] = [];
      let ctm = [1, 0, 0, 1, 0, 0];
      const imageOps = new Set([
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintInlineImageXObject,
        pdfjs.OPS.paintImageXObjectRepeat,
        pdfjs.OPS.paintImageMaskXObject,
      ]);
      let imageIndex = 0;
      operatorList.fnArray.forEach((fn, index) => {
        if (fn === pdfjs.OPS.save) stack.push([...ctm]);
        else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        else if (fn === pdfjs.OPS.transform) {
          ctm = pdfjs.Util.transform(ctm, operatorList.argsArray[index] as number[]);
        } else if (imageOps.has(fn)) {
          const matrix = pdfjs.Util.transform(viewport.transform, ctm);
          const apply = (point: [number, number]) => {
            const result = [...point];
            pdfjs.Util.applyTransform(result, matrix);
            return result;
          };
          const corners = [
            apply([0, 0]),
            apply([1, 0]),
            apply([0, 1]),
            apply([1, 1]),
          ];
          const xs = corners.map((point) => point[0]);
          const ys = corners.map((point) => point[1]);
          const left = Math.min(...xs);
          const top = Math.min(...ys);
          const width = Math.max(...xs) - left;
          const height = Math.max(...ys) - top;
          if (
            width >= 70 &&
            height >= 50 &&
            width <= viewport.width * 0.94 &&
            height <= viewport.height * 0.94
          ) {
            detected.push({
              id: `image-${page}-${imageIndex++}`,
              kind: "image",
              label: "Figure",
              text: `Selected figure or diagram on page ${page}. Analyze the visual structure, labels, arrows, and relationships shown in the image.`,
              page,
              rect: {
                x: Math.max(0, left / viewport.width),
                y: Math.max(0, top / viewport.height),
                width: Math.min(1, width / viewport.width),
                height: Math.min(1, height / viewport.height),
              },
            });
          }
        }
      });

      const wrap = pageWrapRef.current?.getBoundingClientRect();
      if (wrap) {
        const spans = Array.from(textLayerDiv.querySelectorAll("span"));
        spans.forEach((span, index) => {
          const value = span.textContent?.trim() ?? "";
          const formulaLike =
            /(?:=|≤|≥|∑|√|∫|softmax|attention\s*\(|exp\s*\(|log\s*\(|[A-Z][A-Za-z]*\([^)]*,[^)]*\))/i.test(value);
          if (!formulaLike || value.length < 2) return;
          const rect = span.getBoundingClientRect();
          if (rect.width < 18 || rect.height < 6) return;
          const nearby = spans
            .slice(Math.max(0, index - 2), index + 3)
            .map((item) => item.textContent?.trim())
            .filter(Boolean)
            .join(" ");
          detected.push({
            id: `formula-${page}-${index}`,
            kind: "formula",
            label: "Formula",
            text: `Selected mathematical formula on page ${page}: ${nearby || value}`,
            page,
            rect: normalizeRect(
              { left: rect.left - 7, top: rect.top - 5, width: rect.width + 14, height: rect.height + 10 },
              wrap,
            ),
          });
        });
      }
      setRegions(detected.slice(0, 12));
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
    const browserSelection = window.getSelection();
    const text = browserSelection?.toString().replace(/\s+/g, " ").trim() ?? "";
    const wrap = pageWrapRef.current;
    if (!browserSelection || !wrap || text.length < MIN_SELECTION_LENGTH || browserSelection.rangeCount === 0) return;
    if (!textLayerRef.current?.contains(browserSelection.anchorNode)) return;
    const container = wrap.getBoundingClientRect();
    const rects = Array.from(browserSelection.getRangeAt(0).getClientRects())
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .map((rect) => normalizeRect(rect, container));
    setSelection({
      id: `text-${page}-${Date.now()}`,
      kind: "text",
      text: text.slice(0, 2400),
      page,
    });
    setSelectionRects(rects);
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
    onSelectContent(selection);
  }

  function cropRegion(rect: NormalizedRect): string | undefined {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const sx = Math.max(0, rect.x * canvas.width);
    const sy = Math.max(0, rect.y * canvas.height);
    const sw = Math.min(canvas.width - sx, rect.width * canvas.width);
    const sh = Math.min(canvas.height - sy, rect.height * canvas.height);
    if (sw < 10 || sh < 10) return undefined;
    const maxDimension = 900;
    const ratio = Math.min(1, maxDimension / Math.max(sw, sh));
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(sw * ratio));
    crop.height = Math.max(1, Math.round(sh * ratio));
    crop.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    return crop.toDataURL("image/jpeg", 0.78);
  }

  function selectRegion(region: DetectedRegion, explain: boolean) {
    const selected: PdfSelectedContent = {
      id: region.id,
      kind: region.kind,
      text: region.text,
      page: region.page,
      imageData: region.kind === "image" ? cropRegion(region.rect) : undefined,
    };
    setSelection(selected);
    setSelectionRects([region.rect]);
    window.getSelection()?.removeAllRanges();
    if (explain) onSelectContent(selected);
  }

  function clearSelection() {
    setSelection(null);
    setSelectionRects([]);
    window.getSelection()?.removeAllRanges();
    onClearSelection();
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
          {regions.map((region) => (
            <div
              className={`pdf-smart-region ${region.kind} ${selection?.id === region.id ? "active" : ""}`}
              key={region.id}
              style={{
                left: `${region.rect.x * 100}%`,
                top: `${region.rect.y * 100}%`,
                width: `${region.rect.width * 100}%`,
                height: `${region.rect.height * 100}%`,
              }}
              onClick={() => selectRegion(region, false)}
            >
              <span className="pdf-region-type">{region.kind === "image" ? <ImageIcon size={12} /> : <Sigma size={12} />}{region.label}</span>
              <span className="pdf-region-actions">
                <button onClick={(event) => { event.stopPropagation(); selectRegion(region, true); }}><Sparkles size={12} /> Explain this</button>
                {selection?.id === region.id && <button className="close" aria-label="Clear selected content" onClick={(event) => { event.stopPropagation(); clearSelection(); }}><X size={12} /></button>}
              </span>
            </div>
          ))}
          {selection?.page === page && selectionRects.map((rect, index) => (
            <span
              className={`pdf-selection-pin ${selection.kind}`}
              key={`${selection.id}-${index}`}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
              }}
            />
          ))}
        </div>
        {selection && (
          <div className="pdf-explain-bar pop-in">
            <span className={`pdf-selection-kind ${selection.kind}`}>{selection.kind === "image" ? <ImageIcon size={12} /> : selection.kind === "formula" ? <Sigma size={12} /> : <Sparkles size={12} />}{selection.kind}</span>
            <p>“{selection.text.slice(0, 140)}{selection.text.length > 140 ? "…" : ""}”</p>
            <button onClick={explainSelection}><Sparkles size={13} /> Explain this</button>
            <button className="clear-selection" aria-label="Clear selected content" onClick={clearSelection}><X size={13} /></button>
          </div>
        )}
      </div>
    </article>
  );
}
