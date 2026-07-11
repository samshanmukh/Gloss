# Gloss

Gloss turns any paper into a reading tutor that explains what you select by building on what you already know, then grows a visible map of that understanding across papers.

## Demo flow

1. In **Embodied Neurocomputation**, select the highlighted scalar sensor passage.
2. Add the reward-signal explanation to Sam's understanding.
3. Open **Temporal-Difference Learning** from the sidebar.
4. Select the highlighted TD-error passage.
5. Gloss reuses the confirmed reward-signal memory and draws a cross-paper graph connection.

You can also choose **Upload PDF** in the top bar. PDF.js renders the file entirely in the browser with selectable text layers; selecting text sends that exact passage into the explanation pane. The original file is never uploaded to the Gloss server.

Confirmed concepts are written to EverOS and flushed for extraction. Opening the second paper performs a hybrid EverOS retrieval before personalizing the explanation. A browser-local cache keeps the demo usable when the service is unavailable, and the UI labels that fallback as offline.

Every selected passage has a conversational **Ask Gloss** thread. Before each answer, the server retrieves relevant learner memory from EverOS, then sends the source passage, memory, and recent thread to Claude through Butterbase's OpenAI-compatible AI Gateway. The system prompt strictly separates source evidence from personalization memory and requires the model to state when the passage does not support an answer. Each completed exchange is recorded back to EverOS.

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your EVEROS_API_KEY and BUTTERBASE_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run build
```

## Architecture

- Next.js and React for the reading experience
- PDF.js for local PDF rendering, zooming, and selectable text layers
- A source-grounded explanation demo with explicit memory provenance
- Server-only EverOS v1 API integration for confirmed concept writes and hybrid retrieval
- Butterbase AI Gateway for configurable OpenAI-compatible model inference
- Grounded per-selection chat with recent-thread context and EverOS personalization
- Browser `localStorage` fallback behind `memoryAdapter` for resilient demo persistence
- Framer Motion for spring-based transitions with reduced-motion support
- React and SVG for the animated concept graph
- Responsive desktop, tablet, and mobile layouts

EverOS and Butterbase credentials are read only by server routes and are never sent to the browser. Raven remains a separate optional harness integration; this app uses its memory-first retrieve → ground → personalize → write pattern directly. The included excerpts are purpose-built demo content, not rendered source PDFs.
