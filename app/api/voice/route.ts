import { NextResponse } from "next/server";
import { recordTutorExchange, retrieveLearnerMemory } from "@/lib/everos-server";
import { generateGroundedVoiceResponse } from "@/lib/model-server";

export const runtime = "edge";

type VoiceRequest = {
  learnerId?: string;
  audioBase64?: string;
  transcript?: string;
  passage?: string;
  paperTitle?: string;
  rememberTranscript?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VoiceRequest;
    const learnerId = body.learnerId?.trim() || "sam";
    const transcript = body.transcript?.trim();
    const passage = body.passage?.trim();
    const paperTitle = body.paperTitle?.trim() || "Uploaded PDF";
    const audioBase64 = body.audioBase64?.replace(/^data:audio\/[^;]+;base64,/i, "");

    if (!transcript || transcript.length > 2_000) {
      return NextResponse.json({ error: "A voice transcript under 2,000 characters is required" }, { status: 400 });
    }
    if (!passage || passage.length > 12_000) {
      return NextResponse.json({ error: "A source passage under 12,000 characters is required" }, { status: 400 });
    }
    if (!audioBase64 || audioBase64.length > 4_500_000 || !/^[A-Za-z0-9+/=]+$/.test(audioBase64)) {
      return NextResponse.json({ error: "A valid WAV recording under 3 MB is required" }, { status: 400 });
    }
    if (learnerId.length > 128) {
      return NextResponse.json({ error: "Invalid learner identifier" }, { status: 400 });
    }

    let evidence: string[] = [];
    let memoryAvailable = false;
    try {
      const memory = await retrieveLearnerMemory(
        learnerId,
        `${transcript} Relevant mastered concepts, learning level, and explanation preferences`,
      );
      evidence = memory.evidence;
      memoryAvailable = memory.available;
    } catch {
      // The spoken answer remains source-grounded when memory is unavailable.
    }

    const result = await generateGroundedVoiceResponse({
      audioBase64,
      transcript,
      passage,
      paperTitle,
      learnerMemory: evidence,
    });

    let memorySaved = false;
    if (body.rememberTranscript) {
      try {
        const sessionId = `gloss_voice_${paperTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64)}`;
        await recordTutorExchange({
          learnerId,
          sessionId,
          question: `Voice transcript while reading ${paperTitle}: ${transcript}`,
          answer: result.answer,
        });
        memorySaved = true;
      } catch {
        // Voice playback should still succeed when optional memory recording fails.
      }
    }

    return NextResponse.json({
      transcript,
      answer: result.answer,
      audioData: result.audioData,
      provider: result.provider,
      model: result.model,
      memory: {
        retrieved: memoryAvailable,
        evidenceCount: evidence.length,
        saved: memorySaved,
      },
      privacy: {
        rawAudioStored: false,
        transcriptStored: memorySaved,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The voice tutor could not respond";
    const unavailable = message.includes("API_KEY");
    return NextResponse.json({ error: message }, { status: unavailable ? 503 : 502 });
  }
}
