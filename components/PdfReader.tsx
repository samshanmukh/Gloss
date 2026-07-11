"use client";

import { FileWarning, LoaderCircle, MousePointer2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type PdfReaderProps = {
  file: File;
  scale: number;
  onDocumentReady: (pages: number) => void;
  onTextSelected: (text: string) => void;
};

export default function PdfReader({
  file,
  scale,
  onDocumentReady,
  onTextSelected,
}: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let loadingTask: { destroy: () => Promise<void> } | undefined;
    let document: { destroy: () => Promise<void> } | undefined;
    const renderTasks: Array<{ cancel: () => void }> = [];
    const textLayers: Array<{ cancel: () => void }> = [];

    async function renderPdf() {
      const container = containerRef.current;
      if (!container) return;

      setStatus("loading");
      setError("");
      container.replaceChildren();

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const data = new Uint8Array(await file.arrayBuffer());
        const task = pdfjs.getDocument({ data });
        loadingTask = task;
        const pdf = await task.promise;
        document = pdf;
        if (disposed) return;

        onDocumentReady(pdf.numPages);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (disposed) break;

          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale });
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);
          const pageShell = window.document.createElement("section");
          const canvas = window.document.createElement("canvas");
          const textLayerElement = window.document.createElement("div");
          const pageLabel = window.document.createElement("span");
          const context = canvas.getContext("2d");

          if (!context) throw new Error("Canvas rendering is not available in this browser.");

          pageShell.className = "uploaded-pdf-page";
          pageShell.style.width = `${viewport.width}px`;
          pageShell.style.height = `${viewport.height}px`;
          pageShell.style.setProperty("--scale-factor", String(viewport.scale));
          pageLabel.className = "uploaded-page-label";
          pageLabel.textContent = `${pageNumber}`;
          canvas.className = "uploaded-pdf-canvas";
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          textLayerElement.className = "textLayer uploaded-text-layer";

          pageShell.append(canvas, textLayerElement, pageLabel);
          container.append(pageShell);

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          });
          renderTasks.push(renderTask);

          const textLayer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerElement,
            viewport,
          });
          textLayers.push(textLayer);

          await Promise.all([renderTask.promise, textLayer.render()]);
        }

        if (!disposed) setStatus("ready");
      } catch (reason) {
        if (disposed) return;
        setError(reason instanceof Error ? reason.message : "This PDF could not be opened.");
        setStatus("error");
      }
    }

    void renderPdf();

    return () => {
      disposed = true;
      renderTasks.forEach((task) => task.cancel());
      textLayers.forEach((layer) => layer.cancel());
      void document?.destroy();
      void loadingTask?.destroy();
    };
  }, [file, onDocumentReady, scale]);

  function captureSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().replace(/\s+/g, " ").trim();
    const anchor = selection?.anchorNode;
    if (text && text.length > 1 && anchor && containerRef.current?.contains(anchor)) {
      onTextSelected(text);
    }
  }

  return (
    <div className="uploaded-pdf-stage">
      {status === "loading" && (
        <motion.div className="pdf-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <LoaderCircle className="spin" size={22} />
          <strong>Rendering {file.name}</strong>
          <span>PDF.js is building selectable text layers.</span>
        </motion.div>
      )}
      {status === "error" && (
        <div className="pdf-status error">
          <FileWarning size={24} />
          <strong>Couldn’t open this PDF</strong>
          <span>{error}</span>
        </div>
      )}
      {status === "ready" && (
        <div className="selection-tip"><MousePointer2 size={13} /> Select any text to explain it</div>
      )}
      <div
        ref={containerRef}
        className={`uploaded-pdf-document ${status === "ready" ? "ready" : ""}`}
        onMouseUp={captureSelection}
      />
    </div>
  );
}
