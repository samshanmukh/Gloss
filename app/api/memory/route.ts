import { NextResponse } from "next/server";
import { retrieveLearnerMemory, storeConfirmedConcept } from "@/lib/everos-server";

// Required for Butterbase Edge SSR deployment (Cloudflare Workers).
export const runtime = "edge";

type MemoryRequest =
  | { action: "retrieve"; learnerId: string; query: string }
  | {
      action: "confirm";
      learnerId: string;
      concept: string;
      understanding: string;
      learnedFrom: string;
    };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MemoryRequest;

    if (!body.learnerId || body.learnerId.length > 128) {
      return NextResponse.json({ error: "A valid learnerId is required" }, { status: 400 });
    }

    if (body.action === "retrieve") {
      if (!body.query?.trim()) {
        return NextResponse.json({ error: "A retrieval query is required" }, { status: 400 });
      }
      return NextResponse.json(await retrieveLearnerMemory(body.learnerId, body.query));
    }

    if (body.action === "confirm") {
      if (!body.concept || !body.understanding || !body.learnedFrom) {
        return NextResponse.json({ error: "Concept details are required" }, { status: 400 });
      }
      return NextResponse.json(await storeConfirmedConcept(body));
    }

    return NextResponse.json({ error: "Unsupported memory action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EverOS request failed";
    const unavailable = message.includes("EVEROS_API_KEY");
    return NextResponse.json(
      { available: false, error: message },
      { status: unavailable ? 503 : 502 },
    );
  }
}
