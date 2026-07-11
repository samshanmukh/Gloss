"use client";

import { ChevronLeft, ChevronRight, Loader2, Maximize2, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function PdfReader({
  file,
  onSelectText,
}: {
  file: File;
  onSelectText: (text: string, page: number) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selection, setSelection] = useState("");
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
    } catch {
      // Render tasks are cancelled when the page or zoom changes quickly.
    }
  }, [doc, page, zoomIndex]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  function captureSelection() {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSelection(text.length >= 12 ? text : "");
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

      <div className="pdf-scroll" onMouseUp={captureSelection}>
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
