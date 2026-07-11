import { NextResponse } from "next/server";
import { recordTutorExchange, retrieveLearnerMemory } from "@/lib/everos-server";
import { generateGroundedTutorResponse, ModelMessage } from "@/lib/model-server";

// Required for Butterbase Edge SSR deployment (Cloudflare Workers).
export const runtime = "edge";

type ChatRequest = {
  learnerId?: string;
  passage?: string;
  paperTitle?: string;
  question?: string;
  history?: ModelMessage[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const learnerId = body.learnerId?.trim() || "sam";
    const passage = body.passage?.trim();
    const paperTitle = body.paperTitle?.trim() || "Uploaded PDF";
    const question = body.question?.trim();

    if (!passage || passage.length > 12_000) {
      return NextResponse.json({ error: "A source passage under 12,000 characters is required" }, { status: 400 });
    }
    if (!question || question.length > 2_000) {
      return NextResponse.json({ error: "A question under 2,000 characters is required" }, { status: 400 });
    }
    if (learnerId.length > 128) {
      return NextResponse.json({ error: "Invalid learner identifier" }, { status: 400 });
    }

    const history = (body.history ?? [])
      .filter(
        (message): message is ModelMessage =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string",
      )
      .map((message) => ({ ...message, content: message.content.slice(0, 4_000) }))
      .slice(-8);

    let evidence: string[] = [];
    let memoryAvailable = false;
    try {
      const memory = await retrieveLearnerMemory(
        learnerId,
        `${question} Relevant mastered concepts, learning level, and explanation preferences`,
      );
      evidence = memory.evidence;
      memoryAvailable = memory.available;
    } catch {
      // A model response can remain grounded in the source when memory is unavailable.
    }

    const result = await generateGroundedTutorResponse({
      passage,
      paperTitle,
      question,
      history,
      learnerMemory: evidence,
    });

    const sessionId = `gloss_chat_${paperTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64)}`;
    let memorySaved = false;
    try {
      await recordTutorExchange({
        learnerId,
        sessionId,
        question: `While reading ${paperTitle}, the learner asked: ${question}`,
        answer: result.content,
      });
      memorySaved = true;
    } catch {
      // Chat should still succeed if asynchronous memory recording is unavailable.
    }

    return NextResponse.json({
      answer: result.content,
      provider: result.provider,
      model: result.model,
      memory: {
        retrieved: memoryAvailable,
        evidenceCount: evidence.length,
        saved: memorySaved,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tutor could not respond";
    const unavailable = message.includes("API_KEY");
    return NextResponse.json({ error: message }, { status: unavailable ? 503 : 502 });
  }
}
