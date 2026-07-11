# Gloss

Gloss turns any paper into a reading tutor that explains what you select by building on what you already know, then grows a visible map of that understanding across papers.

## Demo flow

1. In **Embodied Neurocomputation**, select the highlighted scalar sensor passage.
2. Add the reward-signal explanation to Sam's understanding.
3. Open **Temporal-Difference Learning** from the sidebar.
4. Select the highlighted TD-error passage.
5. Gloss reuses the confirmed reward-signal memory and draws a cross-paper graph connection.

Confirmed concepts are written to EverOS and flushed for extraction. Opening the second paper performs a hybrid EverOS retrieval before personalizing the explanation. A browser-local cache keeps the demo usable when the service is unavailable, and the UI labels that fallback as offline.

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your EVEROS_API_KEY to .env.local
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
- A source-grounded explanation demo with explicit memory provenance
- Server-only EverOS v1 API integration for confirmed concept writes and hybrid retrieval
- Browser `localStorage` fallback behind `memoryAdapter` for resilient demo persistence
- React and SVG for the animated concept graph
- Responsive desktop, tablet, and mobile layouts

The EverOS API key is read only by the server route and is never sent to the browser. PDF.js document ingestion and production Raven, Butterbase, and model adapters are the next integration layer. The included excerpts are purpose-built demo content, not rendered source PDFs.
