import { NextResponse } from "next/server";
import { extractKnowledgeFromNote } from "@/lib/model-server";

export const runtime = "edge";

type GraphRequest = {
  note?: {
    id?: string;
    content?: string;
    sourceTitle?: string;
    passage?: string;
  };
  existingNodes?: Array<{ id: string; label: string; summary: string }>;
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GraphRequest;
    const note = body.note;
    if (!note?.id || !note.content?.trim() || !note.sourceTitle) {
      return NextResponse.json({ error: "A saved note is required" }, { status: 400 });
    }

    const extraction = await extractKnowledgeFromNote({
      content: note.content.slice(0, 8_000),
      sourceTitle: note.sourceTitle.slice(0, 300),
      passage: note.passage?.slice(0, 2_000),
      existingNodes: (body.existingNodes ?? []).slice(0, 50),
    });
    const notePrefix = slug(note.id).slice(-18);
    const idMap = new Map<string, string>();
    const nodes = extraction.concepts
      .filter((concept) => concept.label?.trim() && concept.summary?.trim())
      .map((concept, index) => {
        const rawId = slug(concept.id || concept.label);
        const id = `note-${notePrefix}-${rawId || index + 1}`;
        idMap.set(concept.id, id);
        const angle = (index / Math.max(1, extraction.concepts.length)) * Math.PI * 2;
        return {
          id,
          label: concept.label.trim().slice(0, 50),
          summary: concept.summary.trim().slice(0, 300),
          sourceTitle: note.sourceTitle!,
          sourceType: "note" as const,
          status: "learning" as const,
          x: Math.round(190 + Math.cos(angle) * 120),
          y: Math.round(138 + Math.sin(angle) * 85),
        };
      });
    const validCanonical = new Set([
      "sensor",
      "closed-loop",
      "action",
      "reward",
      "prediction",
      "td-error",
      "update",
      ...(body.existingNodes ?? []).map((node) => node.id),
      ...nodes.map((node) => node.id),
    ]);
    const edges = extraction.relationships
      .map((edge, index) => ({
        id: `edge-${notePrefix}-${index}`,
        from: idMap.get(edge.from) ?? edge.from,
        to: idMap.get(edge.to) ?? edge.to,
        relation: edge.relation?.trim().slice(0, 80) || "relates to",
        sourceNoteId: note.id,
      }))
      .filter((edge) => validCanonical.has(edge.from) && validCanonical.has(edge.to) && edge.from !== edge.to);

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge extraction failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
