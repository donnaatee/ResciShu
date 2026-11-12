import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sun, Timer, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, parseDurations, type StepTimer } from "@/lib/timers";
import { cn } from "@/lib/utils";

/* ---------- Keep the screen on (Screen Wake Lock API) ---------- */
function useWakeLock() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) { void lock.release(); return; }
        setOn(true);
        lock.addEventListener("release", () => setOn(false));
      } catch { setOn(false); }
    };
    // The browser drops the lock when you switch apps, so ask again when you come back
    const onVisible = () => { if (document.visibilityState === "visible") void request(); };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); void lock?.release(); };
  }, []);
  return on;
}

/* ---------- Read text aloud (Web Speech API) ---------- */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* voice unavailable: the steps still show on screen */ }
}
/** Phones only allow speech after a tap: call this inside the tap that opens cook mode. */
export function unlockSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try { window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* ignore */ }
}
function stopSpeaking() {
  try { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

/* ---------- Alarm sound ---------- */
function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.4;
    gain.gain.setValueAtTime(0.25, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  }
}

/* ---------- Timers ---------- */
type TimerState = StepTimer & { key: string; step: number; endsAt: number | null; left: number; done: boolean };

export function CookMode({ recipeName, steps, onClose }: { recipeName: string; steps: string[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [voice, setVoice] = useState(true);
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const [, tick] = useState(0);
  const timersRef = useRef(timers);
  timersRef.current = timers;
  const audio = useRef<AudioContext | null>(null);
  const awake = useWakeLock();

  // Sound needs to be unlocked by a tap; opening cook mode was that tap
  useEffect(() => {
    try { audio.current = new AudioContext(); } catch { audio.current = null; }
    return () => { stopSpeaking(); void audio.current?.close(); };
  }, []);

  const read = useCallback((n: number) => speak(`Step ${n + 1} of ${steps.length}. ${steps[n] ?? ""}`), [steps]);
  useEffect(() => { if (voice) read(i); else stopSpeaking(); }, [i, voice, read]);

  // Re-draw every quarter second while a timer runs; ring when one finishes
  const running = Object.values(timers).some((t) => t.endsAt != null);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      const finished = Object.values(timersRef.current).filter((t) => t.endsAt != null && t.endsAt <= now);
      if (finished.length) {
        const next = { ...timersRef.current };
        for (const t of finished) next[t.key] = { ...t, endsAt: null, left: 0, done: true };
        timersRef.current = next;
        setTimers(next);
        beep(audio.current);
        navigator.vibrate?.([400, 200, 400]);
        speak(finished.map((t) => `Timer done for step ${t.step + 1}.`).join(" "));
      }
      tick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  // Arrow keys on a computer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  const remaining = (t: TimerState) => (t.endsAt != null ? (t.endsAt - Date.now()) / 1000 : t.left);
  const stepTimers = (n: number) => parseDurations(steps[n] ?? "").map((p, k) => {
    const key = `${n}-${k}`;
    return timers[key] ?? { ...p, key, step: n, endsAt: null, left: p.seconds, done: false };
  });

  function start(t: TimerState) {
    void audio.current?.resume();
    setTimers((p) => ({ ...p, [t.key]: { ...t, endsAt: Date.now() + (t.done ? t.seconds : t.left) * 1000, done: false, left: t.done ? t.seconds : t.left } }));
  }
  function pause(t: TimerState) { setTimers((p) => ({ ...p, [t.key]: { ...t, endsAt: null, left: remaining(t) } })); }
  function reset(t: TimerState) { setTimers((p) => ({ ...p, [t.key]: { ...t, endsAt: null, left: t.seconds, done: false } })); }

  const current = stepTimers(i);
  // Timers from other steps that are running or just finished stay visible at the top
  const elsewhere = Object.values(timers).filter((t) => t.step !== i && (t.endsAt != null || t.done));
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Cooking ${recipeName}`}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-bold">{recipeName}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sun className="size-3" />{awake ? "Screen will stay on" : "Your browser may still let the screen turn off"}
          </div>
        </div>
        <Button size="icon" variant="ghost" aria-label={voice ? "Mute voice" : "Turn voice on"} onClick={() => setVoice(!voice)}>{voice ? <Volume2 /> : <VolumeX />}</Button>
        <Button size="icon" variant="ghost" aria-label="Close cook mode" onClick={onClose}><X /></Button>
      </header>

      {elsewhere.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border bg-muted/40 px-4 py-2">
          {elsewhere.map((t) => (
            <button key={t.key} type="button" onClick={() => setI(t.step)}
              className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums", t.done ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-card border border-border")}>
              <Timer className="size-3.5" />Step {t.step + 1}: {t.done ? "Done!" : formatClock(remaining(t))}
            </button>
          ))}
        </div>
      )}

      <main className="flex flex-1 flex-col justify-center gap-6 overflow-auto px-6 py-8 mx-auto w-full max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-wide text-accent">Step {i + 1} of {steps.length}</div>
        <p className="text-2xl leading-snug md:text-3xl">{steps[i]}</p>
        <div className="grid gap-3">
          {current.map((t) => (
            <div key={t.key} className={cn("card-soft flex items-center gap-3 p-4", t.done && "border-destructive")}>
              <Timer className="size-6 text-accent" />
              <div className="flex-1">
                <div className="font-display text-4xl font-bold tabular-nums">{t.done ? "Done!" : formatClock(remaining(t))}</div>
                <div className="text-xs text-muted-foreground">{t.label} timer</div>
              </div>
              {t.endsAt != null
                ? <Button size="lg" variant="outline" onClick={() => pause(t)}><Pause />Pause</Button>
                : <Button size="lg" onClick={() => start(t)}><Play />{t.done ? "Again" : t.left < t.seconds ? "Resume" : "Start"}</Button>}
              <Button size="icon" variant="ghost" aria-label="Reset timer" onClick={() => reset(t)}><RotateCcw /></Button>
            </div>
          ))}
        </div>
        {voice && <button type="button" onClick={() => read(i)} className="self-start text-sm text-primary underline">Read this step again</button>}
      </main>

      <footer className="grid grid-cols-2 gap-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="lg" variant="outline" className="h-14 text-base" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft />Back</Button>
        {last
          ? <Button size="lg" className="h-14 text-base" onClick={onClose}>Finish</Button>
          : <Button size="lg" className="h-14 text-base" onClick={() => setI(i + 1)}>Next<ChevronRight /></Button>}
      </footer>
    </div>
  );
}
