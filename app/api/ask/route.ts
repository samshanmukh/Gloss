import { NextResponse } from "next/server";
import { retrieveLearnerMemory } from "@/lib/everos-server";

export const runtime = "edge";

const DEFAULT_GATEWAY_URL = "https://api.butterbase.ai/v1";
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
const REQUEST_TIMEOUT_MS = 25_000;

type AskRequest = {
  learnerId?: string;
  question?: string;
  context?: string;
  source?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.BUTTERBASE_API_KEY;
  const appId = process.env.BUTTERBASE_APP_ID;
  if (!apiKey || !appId) {
    return NextResponse.json(
      { error: "The AI tutor is not configured on this deployment" },
      { status: 503 },
    );
  }

  let body: AskRequest;
  try {
    body = (await request.json()) as AskRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question || question.length > 600) {
    return NextResponse.json({ error: "A question up to 600 characters is required" }, { status: 400 });
  }
  const context = (body.context ?? "").slice(0, 6000);
  const source = (body.source ?? "the paper").slice(0, 200);
  const learnerId = (body.learnerId ?? "sam").slice(0, 128);

  // Personalize with confirmed EverOS memories when the service is reachable.
  let memoryEvidence: string[] = [];
  try {
    const memory = await retrieveLearnerMemory(learnerId, question);
    memoryEvidence = memory.evidence.slice(0, 3);
  } catch {
    // Q&A still works without learner memory.
  }

  const system = [
    "You are Gloss, a reading tutor. The learner selected a passage from a paper and asked a question.",
    "Answer in at most 120 words. Be concrete and plain-spoken, lead with the core idea, and include one short analogy when it helps.",
    "Ground your answer in the provided passage. If the passage does not contain the answer, say so briefly before answering from general knowledge.",
    memoryEvidence.length
      ? `The learner has previously confirmed understanding of these ideas — build on them instead of re-explaining: ${memoryEvidence.join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const user = `Source: ${source}\n\nPassage:\n"""\n${context || "(no passage selected)"}\n"""\n\nQuestion: ${question}`;

  const gatewayUrl = (process.env.BUTTERBASE_GATEWAY_URL ?? DEFAULT_GATEWAY_URL).replace(/\/$/, "");
  const model = process.env.BUTTERBASE_MODEL ?? DEFAULT_MODEL;

  try {
    const response = await fetch(`${gatewayUrl}/${appId}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message || `AI gateway responded with status ${response.status}`);
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("The AI gateway returned an empty answer");

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
