# Gloss

Gloss turns any paper into a reading tutor that explains what you select by building on what you already know, then grows a visible map of that understanding across papers.

## Demo flow

1. In **Embodied Neurocomputation**, select the highlighted scalar sensor passage.
2. Add the reward-signal explanation to Sam's understanding.
3. Open **Temporal-Difference Learning** from the sidebar.
4. Select the highlighted TD-error passage.
5. Gloss reuses the confirmed reward-signal memory and draws a cross-paper graph connection.

The current demo uses a typed browser-local memory adapter so it runs without external credentials. That boundary is intended to be replaced by the Raven/EverOS integration; the UI does not claim that local demo writes are remote service calls.

## Run locally

```bash
npm install
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
- Browser `localStorage` behind `memoryAdapter` for demo persistence
- React and SVG for the animated concept graph
- Responsive desktop, tablet, and mobile layouts

PDF.js document ingestion and production Raven, EverOS, Butterbase, and model adapters are the next integration layer. The included excerpts are purpose-built demo content, not rendered source PDFs.
