import { NextResponse } from "next/server";
import { recordReadingNote } from "@/lib/everos-server";

export const runtime = "edge";

type NotePayload = {
  id?: string;
  learnerId?: string;
  content?: string;
  sourceTitle?: string;
  passage?: string;
  page?: number;
  createdAt?: number;
  updatedAt?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      operation?: "upsert" | "delete";
      note?: NotePayload;
    };
    const note = body.note;
    if (body.action !== "sync" || !note || !body.operation) {
      return NextResponse.json({ error: "A note sync operation is required" }, { status: 400 });
    }
    if (
      !note.id ||
      !note.learnerId ||
      !note.sourceTitle ||
      typeof note.content !== "string" ||
      note.id.length > 160 ||
      note.learnerId.length > 128 ||
      note.content.length > 8_000
    ) {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    }

    await recordReadingNote({
      learnerId: note.learnerId,
      operation: body.operation,
      note: {
        id: note.id,
        content: note.content,
        sourceTitle: note.sourceTitle.slice(0, 300),
        passage: note.passage?.slice(0, 2_000),
        page: note.page,
        createdAt: note.createdAt ?? Date.now(),
        updatedAt: note.updatedAt ?? Date.now(),
      },
    });
    return NextResponse.json({ available: true, synced: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Note sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
