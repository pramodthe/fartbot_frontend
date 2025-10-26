"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wind, Volume2, VolumeX, Trash2, Sparkles, Zap, Rocket, Laugh, CloudFog } from "lucide-react";
import ClientOnly from "@/components/ClientOnly";

// --- Tiny sound synth using Web Audio API (no external assets) ---
function useTootSynth() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  function ensureCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctxRef.current;
  }

  const setEnabled = (v: boolean) => { enabledRef.current = v; };
  const isEnabled = () => enabledRef.current;

  function playFart({
    duration = 1.2,
    wet = 0.5, // 0 = dry puff, 1 = very wet 💦
    pitch = 70, // base frequency in Hz
    vibrato = 6, // Hz
    vibratoDepth = 8, // Hz deviation
    volume = 0.7,
  } = {}) {
    if (!enabledRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return; // AudioContext might not be supported
    const t0 = ctx.currentTime;

    // --- Add more randomness to parameters ---
    const randDuration = duration * (1 + (Math.random() - 0.5) * 0.2); // +/- 10%
    const randPitch = pitch * (1 + (Math.random() - 0.5) * 0.3); // +/- 15%
    const randWet = Math.max(0, Math.min(1, wet + (Math.random() - 0.5) * 0.4)); // +/- 0.2
    const randVibratoDepth = vibratoDepth * (1 + (Math.random() - 0.5) * 0.5); // +/- 25%

    // Master gain with envelope
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(volume, t0 + 0.03);
    master.gain.exponentialRampToValueAtTime(0.001, t0 + randDuration); // Use randDuration
    master.connect(ctx.destination);

    // Low bass oscillator (the core toot)
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";

    // Vibrato
    const vibr = ctx.createOscillator();
    vibr.frequency.value = vibrato * (1 + (Math.random() - 0.5) * 0.2); // Randomize vibrato speed
    const vibrGain = ctx.createGain();
    vibrGain.gain.setValueAtTime(0, t0); // Vibrato fades in
    vibrGain.gain.linearRampToValueAtTime(randVibratoDepth, t0 + randDuration * 0.3); // Use randVibratoDepth
    vibrGain.gain.linearRampToValueAtTime(0, t0 + randDuration); // Vibrato fades out
    vibr.connect(vibrGain);

    const oscFreq = ctx.createGain();
    oscFreq.gain.value = 1;
    vibrGain.connect(oscFreq);

    const freqParam = osc.frequency as unknown as AudioParam; // TS appeasement
    osc.connect(master);

    // Pitch glide down and wobble
    freqParam.setValueAtTime(randPitch + Math.random() * 20, t0); // Use randPitch
    freqParam.exponentialRampToValueAtTime(Math.max(30, randPitch * 0.5), t0 + randDuration * 0.7); // Use randPitch and randDuration
    oscFreq.connect(freqParam);

    // Noisy component (air burst)
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    // --- Add envelope to bandpass frequency ---
    const bpFreq = pitch * (1 + randWet * 1.5); // Base freq on pitch and wetness
    bp.frequency.setValueAtTime(bpFreq * 2.5, t0); // Start high
    bp.frequency.exponentialRampToValueAtTime(bpFreq * 0.8, t0 + 0.1); // Quick drop ("pwow")
    bp.frequency.linearRampToValueAtTime(bpFreq, t0 + randDuration * 0.5); // Settle
    bp.Q.value = 0.3 + randWet * 6; // Use randWet

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    // --- Add envelope to lowpass frequency ---
    const lpFreq = 900 + randWet * 1200; // Use randWet
    lp.frequency.setValueAtTime(lpFreq, t0); // Start at freq
    lp.frequency.exponentialRampToValueAtTime(lpFreq * 0.6, t0 + randDuration); // Glide down
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.6 + randWet * 0.7, t0 + 0.05); // Use randWet
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + randDuration); // Use randDuration

    noise.connect(bp); bp.connect(lp); lp.connect(noiseGain); noiseGain.connect(master);

    // Occasional "sputter" via AM
    const sputterOsc = ctx.createOscillator();
    sputterOsc.type = "square";
    // --- Add envelope to sputter frequency ---
    const sputterFreq = 12 + Math.random() * 18;
    sputterOsc.frequency.setValueAtTime(sputterFreq, t0);
    sputterOsc.frequency.exponentialRampToValueAtTime(sputterFreq * 0.5, t0 + randDuration); // Sputter slows down
    const sputGain = ctx.createGain();
    sputGain.gain.value = 0.4 + randWet * 0.6; // Use randWet
    sputterOsc.connect(sputGain);
    const masterGainParam = master.gain as unknown as AudioParam;
    sputGain.connect(masterGainParam);

    vibr.start(t0);
    osc.start(t0);
    noise.start(t0);
    sputterOsc.start(t0 + 0.05 * Math.random());

    osc.stop(t0 + randDuration);
    noise.stop(t0 + randDuration);
    sputterOsc.stop(t0 + randDuration); // Use randDuration
  }

  return { playFart, setEnabled, isEnabled };
}

// --- Utility bits ---
const sampleBotLines = [
  "That was a real crowd-mover 💨",
  "Certified Grade-A toot. Notes of cheddar and chaos.",
  "Wind advisory issued. Keep windows open.",
  "Silent but devastating. Respect.",
  "I detect... hints of broccoli and bold ambition.",
  "Launching stink-to-orbit in 3...2...💥",
];

function generateBotReply(input: string) {
  const lower = input.toLowerCase();
  const spice = "💨".repeat(Math.min(6, Math.ceil((input.length % 9) / 2)));
  if (/silent|sbd|stealth/.test(lower)) return `Shhh... that one sneaked past RADAR. ${spice}`;
  if (/rocket|launch|blast/.test(lower)) return `Ignition confirmed. Thrust levels nominal. ${spice}`;
  if (/wet|squelch|soggy/.test(lower)) return `Moisture detected. Mop squad inbound. ${spice}`;
  if (/help|how/.test(lower)) return `Type anything and I'll rate the rip. Use the Toot Keys for custom blasts! ${spice}`;
  return sampleBotLines[Math.floor(Math.random() * sampleBotLines.length)] + ` ${spice}`;
}

function niceTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// --- Message bubble ---
function Bubble({ who, text, time }: { who: "user" | "bot"; text: string; time: number }) {
  const isUser = who === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ring-1 ${
        isUser
          ? "bg-gradient-to-br from-fuchsia-500/20 to-rose-500/20 ring-fuchsia-300/40"
          : "bg-white/80 backdrop-blur ring-slate-200"
      }`}
      >
        <div className={`text-sm ${isUser ? "text-fuchsia-900" : "text-slate-800"}`}>{text}</div>
        <div className="mt-1 text-[10px] opacity-60">{niceTime(time)}</div>
      </div>
    </motion.div>
  );
}

// --- Gas cloud background ---
function GasBackdrop() {
  const puffs = new Array(12).fill(0).map((_, i) => i);
  return (
    <ClientOnly>
      <div aria-hidden className="absolute inset-0 overflow-hidden -z-10">
        {puffs.map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-br from-lime-200/40 to-emerald-200/30 blur-3xl"
            style={{ width: 220, height: 220, left: Math.random() * 90 + "%", top: Math.random() * 90 + "%" }}
            animate={{
              y: [0, -20, 0],
              x: [0, 8, -8, 0],
              opacity: [0.25, 0.5, 0.25],
            }}
            transition={{ duration: 10 + Math.random() * 10, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </ClientOnly>
  );
}

// --- Main App ---
export default function App() {
  const [messages, setMessages] = useState<{ who: "user" | "bot"; text: string; time: number }[]>([
    { who: "bot", text: "Welcome to FartBot. I speak fluent 💨. Ask me anything!", time: 0 },
  ]);
  
  useEffect(() => {
    // Update initial message time after mount to avoid SSR mismatch
    setMessages(prev => {
      if (prev.length === 1 && prev[0].time === 0) {
        return [{ who: "bot", text: "Welcome to FartBot. I speak fluent 💨. Ask me anything!", time: Date.now() }];
      }
      return prev;
    });
  }, []);
  const [input, setInput] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { playFart, setEnabled } = useTootSynth();

  useEffect(() => { setEnabled(soundOn); }, [soundOn, setEnabled]);
  useEffect(() => { listRef.current?.scrollTo({ top: 999999, behavior: "smooth" }); }, [messages.length]);

  function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value) return;
    const now = Date.now();
    setMessages((m) => [...m, { who: "user", text: value, time: now }]);
    // Bot thinking & reply
    const reply = generateBotReply(value);
    const wet = Math.min(1, value.length / 24 + (/[aeiou]/i.test(value) ? 0.1 : 0));
    const pitch = 55 + (value.length % 30);
    setTimeout(() => {
      playFart({ wet, pitch, duration: 0.9 + (value.length % 5) * 0.1, vibratoDepth: 5 + wet * 10 });
      setMessages((m) => [...m, { who: "bot", text: reply, time: Date.now() }]);
    }, 150);
    setInput("");
  }

  function clearChat() { setMessages([{ who: "bot", text: "Chat cleared. Fresh air... for now.", time: Date.now() }]); }

  const tootPresets = [
    { label: "Puff", icon: <Wind size={16} />, params: { wet: 0.1, pitch: 90, duration: 0.5 } },
    { label: "SBD", icon: <CloudFog size={16} />, params: { wet: 0.2, pitch: 60, duration: 1.2 } },
    { label: "Rocket", icon: <Rocket size={16} />, params: { wet: 0.3, pitch: 110, duration: 0.8 } },
    { label: "Thunder", icon: <Zap size={16} />, params: { wet: 0.6, pitch: 45, duration: 1.6 } },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-lime-50 to-amber-50 text-slate-800 font-sans">
      <GasBackdrop />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-lime-200/70 bg-white/60 p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <motion.div initial={{ rotate: -12 }} animate={{ rotate: [ -12, 12, -12] }} transition={{ repeat: Infinity, duration: 6 }} className="grid h-10 w-10 place-items-center rounded-xl bg-lime-200/70">
              <Laugh className="opacity-80" />
            </motion.div>
            <div>
              <div className="text-lg font-bold tracking-tight">FartBot</div>
              <div className="text-xs opacity-60">The winds of wisdom 💨</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm hover:bg-white"
              onClick={() => setSoundOn((s) => !s)}
              aria-label={soundOn ? "Mute sound" : "Unmute sound"}
            >
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />} {soundOn ? "Sound on" : "Muted"}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white/90 px-3 py-2 text-sm shadow-sm hover:bg-white"
              onClick={clearChat}
              aria-label="Clear chat"
            >
              <Trash2 size={16} /> Clear
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div ref={listRef} className="h-[60vh] w-full overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/70 p-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <Bubble key={i + m.time} who={m.who} text={m.text} time={m.time} />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Toot keyboard */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tootPresets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                playFart(p.params as any);
                setMessages((m) => [...m, { who: "user", text: p.label + "!", time: Date.now() }]);
                setTimeout(() => setMessages((m) => [...m, { who: "bot", text: generateBotReply(p.label), time: Date.now() }]), 120);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-sm font-medium shadow-sm hover:bg-emerald-100"
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* Composer */}
        <div className="mt-3 flex items-stretch gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask FartBot anything... try 'silent but deadly' or 'launch'"
            className="flex-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-lime-300"
          />
          <button
            onClick={() => send()}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow active:translate-y-[1px]"
            aria-label="Send message"
          >
            <Send size={16} /> Send
          </button>
        </div>

        {/* Footer tips */}
        <div className="mt-4 text-center text-[11px] text-slate-500">
          Pro tip: Toggle sound for immersive realism. This demo is client-side only—no messages are sent to any server.
        </div>
      </div>
    </div>
  );
}

