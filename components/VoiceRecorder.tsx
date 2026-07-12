"use client";

import { Check, Loader2, Mic, MicOff, ShieldCheck, Square, Volume2, X } from "lucide-react";
import { useRef, useState } from "react";
import { VoiceTutorResponse, memoryAdapter } from "@/lib/gloss";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function recordingToWav(recording: Blob) {
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await recording.arrayBuffer());
    const sampleRate = 16_000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), sampleRate);
  } finally {
    await audioContext.close();
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function VoiceRecorder({
  learnerId,
  passage,
  paperTitle,
  disabled,
  onComplete,
}: {
  learnerId: string;
  passage: string;
  paperTitle: string;
  disabled?: boolean;
  onComplete: (response: VoiceTutorResponse) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "processing" | "complete" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [remember, setRemember] = useState(false);
  const [result, setResult] = useState<VoiceTutorResponse | null>(null);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const canceledRef = useRef(false);
  const rememberRef = useRef(false);

  function cleanup() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function processRecording(blob: Blob) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const transcript = transcriptRef.current.trim();
    if (!transcript) {
      throw new Error("No speech transcript was captured. Use Chrome and allow microphone and speech permissions.");
    }
    const wav = await recordingToWav(blob);
    const audioBase64 = await blobToBase64(wav);
    const response = await memoryAdapter.askVoice({
      learnerId,
      audioBase64,
      transcript,
      passage,
      paperTitle,
      rememberTranscript: rememberRef.current,
    });
    setResult(response);
    setState("complete");
    onComplete(response);
  }

  async function startRecording() {
    setError("");
    setResult(null);
    setLiveTranscript("");
    setSeconds(0);
    transcriptRef.current = "";
    canceledRef.current = false;
    try {
      const SpeechRecognition =
        (window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
        (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
      if (!SpeechRecognition) throw new Error("Voice transcription requires Chrome or another browser with Speech Recognition.");
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Audio recording is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let transcript = "";
        for (let index = 0; index < event.results.length; index += 1) transcript += `${event.results[index][0].transcript} `;
        transcriptRef.current = transcript.trim();
        setLiveTranscript(transcript.trim());
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted" && event.error !== "no-speech") setError(`Speech recognition: ${event.error}`);
      };
      recognition.start();
      recognitionRef.current = recognition;

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        cleanup();
        if (canceledRef.current) {
          setState("idle");
          return;
        }
        setState("processing");
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void processRecording(blob).catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Voice processing failed");
          setState("error");
        });
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setState("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => {
          if (value >= 29) {
            window.setTimeout(() => stopRecording(), 0);
            return 30;
          }
          return value + 1;
        });
      }, 1000);
    } catch (reason) {
      cleanup();
      setError(reason instanceof Error ? reason.message : "Could not start recording");
      setState("error");
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function cancelRecording() {
    canceledRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else {
      cleanup();
      setState("idle");
    }
  }

  function closePanel() {
    if (state === "recording") cancelRecording();
    setState("idle");
    setResult(null);
    setError("");
  }

  const open = state !== "idle";

  return (
    <div className={`voice-recorder ${open ? "open" : ""}`}>
      <button
        className={`voice-trigger ${state === "recording" ? "recording" : ""}`}
        aria-label={state === "recording" ? "Stop voice question" : "Start voice question"}
        disabled={disabled || state === "processing"}
        onClick={() => state === "recording" ? stopRecording() : void startRecording()}
      >
        {state === "processing" ? <Loader2 className="spin" size={15} /> : state === "recording" ? <Square size={13} /> : <Mic size={15} />}
      </button>

      {open && (
        <div className="voice-panel pop-in">
          <header>
            <div><span className={`voice-status-dot ${state}`} /><strong>{state === "recording" ? "Listening…" : state === "processing" ? "Gloss is thinking…" : state === "complete" ? "Voice answer ready" : "Voice question"}</strong></div>
            <button aria-label="Close voice panel" onClick={closePanel}><X size={14} /></button>
          </header>

          {state === "recording" && (
            <>
              <div className="voice-wave" aria-hidden>{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -55}ms` }} />)}</div>
              <div className="voice-live-transcript">{liveTranscript || "Start speaking your question…"}</div>
              <div className="voice-recording-actions">
                <span>0:{String(seconds).padStart(2, "0")} / 0:30</span>
                <button className="cancel" onClick={cancelRecording}><MicOff size={13} /> Cancel</button>
                <button className="stop" onClick={stopRecording}><Square size={12} /> Stop</button>
              </div>
              <label className="voice-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => {
                    setRemember(event.target.checked);
                    rememberRef.current = event.target.checked;
                  }}
                />
                <span><strong>Remember this transcript</strong><small>Store the transcript and answer in EverOS. Raw audio is never stored.</small></span>
              </label>
            </>
          )}

          {state === "processing" && (
            <div className="voice-processing"><div><Loader2 className="spin" size={22} /></div><p>Grounding your question in the selected passage and learner memory, then generating speech.</p></div>
          )}

          {state === "complete" && result && (
            <div className="voice-result">
              <div className="voice-transcript"><span>You asked</span><p>{result.transcript}</p></div>
              <div className="voice-answer"><span><Volume2 size={12} /> Gloss answered</span><p>{result.answer}</p></div>
              <audio controls src={result.audioData} preload="metadata" />
              <footer>
                <span><ShieldCheck size={12} /> Raw audio not stored</span>
                {result.privacy.transcriptStored ? <span><Check size={12} /> Transcript saved to EverOS</span> : <span>Transcript not saved</span>}
              </footer>
            </div>
          )}

          {state === "error" && (
            <div className="voice-error"><MicOff size={20} /><strong>Voice question unavailable</strong><p>{error}</p><button onClick={() => void startRecording()}>Try again</button></div>
          )}
        </div>
      )}
    </div>
  );
}
