/**
 * Le synthétiseur des musiques, exécuté dans Chromium (Web Audio hors ligne,
 * Tone.js) : aucun échantillon, aucune musique sous licence, tout se calcule
 * à partir de la grille de la vidéo. Chargé par scripts/music.mjs, qui lui
 * passe la grille et récupère un WAV.
 *
 * Le caractère : une pop électronique qui garde un parfum de musique juive,
 * la gamme freygish (le mode « Ahava Rabba ») pour les mélodies, une
 * darbouka sur le rythme maqsoum, et des cordes pincées façon kanoun.
 */

/* global Tone */

// Gamme freygish (phrygien dominant) : ré, mi bémol, fa dièse, sol, la, si bémol, do.
const FREYGISH = [0, 1, 4, 5, 7, 8, 10];
// Mineur naturel, pour les motifs plus lumineux.
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/**
 * Motifs mélodiques de deux mesures, en doubles croches :
 * [pas, degré de la gamme, durée en pas]. Un degré au-delà de 6 monte
 * d'une octave, un degré négatif descend.
 */
const MOTIFS = {
  freygish: {
    scale: FREYGISH,
    notes: [
      [0, 4, 2], [2, 5, 1], [3, 4, 1], [4, 2, 2], [6, 3, 2], [8, 4, 3], [11, 5, 1],
      [12, 4, 1], [13, 3, 1], [14, 2, 1], [15, 1, 1],
      [16, 2, 3], [19, 1, 1], [20, 2, 2], [22, 3, 2], [24, 2, 2], [26, 1, 1], [27, 2, 1], [28, 0, 4],
    ],
  },
  envol: {
    scale: MINOR,
    notes: [
      [0, 0, 2], [2, 2, 2], [4, 4, 2], [6, 7, 3], [9, 6, 1], [10, 4, 2], [12, 5, 4],
      [16, 4, 2], [18, 2, 2], [20, 3, 2], [22, 4, 3], [25, 2, 1], [26, 1, 2], [28, 0, 4],
    ],
  },
  nigoun: {
    scale: FREYGISH,
    notes: [
      [0, 0, 1], [1, 1, 1], [2, 2, 2], [4, 2, 1], [5, 3, 1], [6, 4, 2], [8, 4, 1], [9, 5, 1],
      [10, 4, 1], [11, 3, 1], [12, 2, 4],
      [16, 4, 1], [17, 5, 1], [18, 4, 1], [19, 3, 1], [20, 2, 2], [22, 1, 2], [24, 2, 1], [25, 1, 1], [26, 0, 6],
    ],
  },
  lumiere: {
    scale: MINOR,
    notes: [
      [0, 7, 3], [3, 6, 1], [4, 4, 2], [6, 6, 2], [8, 7, 2], [10, 9, 2], [12, 8, 4],
      [16, 7, 3], [19, 6, 1], [20, 4, 2], [22, 3, 2], [24, 4, 2], [26, 2, 2], [28, 4, 4],
    ],
  },
  dabke: {
    scale: FREYGISH,
    notes: [
      [0, 4, 1], [1, 4, 1], [2, 5, 1], [3, 4, 1], [4, 2, 2], [6, 4, 1], [7, 2, 1], [8, 1, 2], [10, 2, 2],
      [12, 0, 4],
      [16, 4, 1], [17, 4, 1], [18, 5, 1], [19, 7, 1], [20, 5, 2], [22, 4, 2], [24, 2, 1], [25, 1, 1], [26, 2, 2], [28, 0, 4],
    ],
  },
};

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function degreeToMidi(scale, root, degree) {
  const octave = Math.floor(degree / scale.length);
  const index = ((degree % scale.length) + scale.length) % scale.length;
  return root + octave * 12 + scale[index];
}

/** Rend la piste et la renvoie en WAV 16 bits stéréo, encodé en base64. */
window.renderTrack = async function renderTrack(spec) {
  const { timeline, style, cues } = spec;
  const spb = 60 / timeline.bpm;
  const s16 = spb / 4;
  const beatTime = (b) => b * spb;
  const duration = beatTime(timeline.totalBeats) + timeline.tail + 1.5;
  const motif = MOTIFS[style.motif];
  const section = (kind) => timeline.sections.find((s) => s.kind === kind);

  const buffer = await Tone.Offline(async () => {
    // --- Bus et effets ------------------------------------------------------
    const limiter = new Tone.Limiter(-1).toDestination();
    const comp = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.008, release: 0.18 }).connect(limiter);
    const reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 1 });
    await reverb.generate();
    reverb.connect(comp);
    const revSend = (amount) => {
      const g = new Tone.Gain(amount);
      g.connect(reverb);
      return g;
    };
    const delay = new Tone.FeedbackDelay({ delayTime: spb * 0.75, feedback: 0.32, wet: 1 });
    const delayOut = new Tone.Gain(0.22).connect(comp);
    delay.connect(delayOut);

    // Le bus « musique » s'ouvre pendant l'accroche (filtre passe-bas qui
    // monte), et se fait pomper par la grosse caisse (sidechain).
    const musicFilter = new Tone.Filter({ type: "lowpass", frequency: 18000, rolloff: -24, Q: 0.7 }).connect(comp);
    const duck = new Tone.Gain(1).connect(musicFilter);
    const drumsBus = new Tone.Gain(1).connect(comp);

    // --- Instruments --------------------------------------------------------
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.045, octaves: 6.5, oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.05 },
      volume: 2,
    }).connect(drumsBus);
    const kickClick = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.0005, decay: 0.008, sustain: 0 }, volume: -16 });
    kickClick.connect(new Tone.Filter(3000, "highpass").connect(drumsBus));

    const clapFilter = new Tone.Filter({ type: "bandpass", frequency: 1400, Q: 0.9 });
    clapFilter.connect(drumsBus);
    clapFilter.connect(revSend(0.35));
    const clap = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -6 }).connect(clapFilter);

    const hatFilter = new Tone.Filter(8000, "highpass").connect(drumsBus);
    const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -17 }).connect(hatFilter);
    const openHat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.2, sustain: 0 }, volume: -20 }).connect(hatFilter);

    // Darbouka : le « doum » grave et le « tek » sec.
    const doum = new Tone.MembraneSynth({
      pitchDecay: 0.02, octaves: 1.6, envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.05 }, volume: -7,
    }).connect(drumsBus);
    const tekFilter = new Tone.Filter({ type: "bandpass", frequency: 3200, Q: 1.4 });
    tekFilter.connect(drumsBus);
    tekFilter.connect(revSend(0.15));
    const tek = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.0008, decay: 0.045, sustain: 0 }, volume: -9 }).connect(tekFilter);
    const tekTone = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 }, volume: -16 }).connect(drumsBus);

    const sub = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 }, volume: -6 }).connect(duck);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 3, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.004, decay: 0.18, sustain: 0.5, release: 0.06 },
      filterEnvelope: { attack: 0.003, decay: 0.16, sustain: 0.2, release: 0.1, baseFrequency: 90, octaves: 3.2 },
      volume: -11,
    }).connect(duck);

    const padFilter = new Tone.Filter(2400, "lowpass").connect(duck);
    padFilter.connect(revSend(0.4));
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 28 },
      envelope: { attack: 0.35, decay: 0.4, sustain: 0.65, release: 1.4 },
      volume: -21,
    }).connect(padFilter);

    // Corde pincée (Karplus-Strong) doublée d'une FM brillante : le kanoun.
    const leadBus = new Tone.Gain(1).connect(musicFilter);
    leadBus.connect(delay);
    leadBus.connect(revSend(0.3));
    const pluck = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 5200, resonance: 0.96, volume: -2 }).connect(leadBus);
    const shimmer = new Tone.FMSynth({
      harmonicity: 3.01, modulationIndex: 9,
      envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.1 },
      volume: -17,
    }).connect(leadBus);
    const arp = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 }, volume: -19 }).connect(leadBus);

    // Bruitages.
    const fxBus = new Tone.Gain(1).connect(comp);
    fxBus.connect(revSend(0.3));
    const riserFilter = new Tone.Filter({ type: "bandpass", frequency: 400, Q: 1.2 }).connect(fxBus);
    const riser = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 1, decay: 0.01, sustain: 1, release: 0.05 }, volume: -10 }).connect(riserFilter);
    const whooshFilter = new Tone.Filter({ type: "bandpass", frequency: 800, Q: 1.6 }).connect(fxBus);
    const whoosh = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.09, decay: 0.2, sustain: 0, release: 0.1 }, volume: -8 }).connect(whooshFilter);
    const boom = new Tone.MembraneSynth({
      pitchDecay: 0.5, octaves: 3, envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 0.4 }, volume: 0,
    }).connect(fxBus);
    boom.connect(revSend(0.5));
    const crash = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 1.4, sustain: 0 }, volume: -18 });
    crash.connect(new Tone.Filter(5000, "highpass").connect(fxBus));
    const tap = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 }, volume: -13 }).connect(fxBus);
    const chime = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5, modulationIndex: 4,
      envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 },
      volume: -18,
    }).connect(fxBus);

    // --- Aides --------------------------------------------------------------
    // Les synthés de Tone exigent des déclenchements dans l'ordre du temps :
    // tout passe par une file, triée puis jouée d'un bloc à la fin.
    const queue = [];
    const at = (t, fn) => queue.push({ t, i: queue.length, fn });
    const trig = (inst, ...args) => {
      const t = inst instanceof Tone.NoiseSynth ? args[1] : args[2];
      at(t, () => inst.triggerAttackRelease(...args));
    };
    const chordAt = (beat) => {
      const bar = Math.floor(beat / 4);
      return style.progression[bar % style.progression.length];
    };
    const pump = (t, depth = 0.25) => {
      at(t, () => {
        duck.gain.setValueAtTime(depth, t);
        duck.gain.linearRampToValueAtTime(1, t + spb * 0.42);
      });
    };
    const playKick = (t, vel = 1) => {
      trig(kick, 46, "8n", t, vel);
      trig(kickClick, 0.01, t, vel);
      pump(t);
    };
    const playMotif = (fromBeat, bars, { octave = 0, gain = 1, withShimmer = true } = {}) => {
      for (const [step, degree, len] of motif.notes) {
        if (step >= bars * 16) continue;
        const t = beatTime(fromBeat) + step * s16;
        const note = degreeToMidi(motif.scale, style.root + 12 + octave * 12, degree);
        trig(pluck, midiToFreq(note), len * s16, t, gain);
        if (withShimmer) trig(shimmer, midiToFreq(note + 12), len * s16 * 0.8, t, 0.6 * gain);
      }
    };
    const playPadBar = (beat, beats) => {
      const chord = chordAt(beat);
      const notes = chord.map((n) => midiToFreq(style.root - 12 + n));
      trig(pad, notes, beats * spb - 0.05, beatTime(beat), 0.8);
    };
    const playRiser = (fromBeat, beats) => {
      const t0 = beatTime(fromBeat);
      const t1 = beatTime(fromBeat + beats);
      at(t0, () => {
        riser.envelope.attack = t1 - t0;
        riserFilter.frequency.setValueAtTime(300, t0);
        riserFilter.frequency.exponentialRampToValueAtTime(9000, t1);
        riser.triggerAttackRelease(t1 - t0, t0, 0.9);
      });
    };
    const playImpact = (beat) => {
      const t = beatTime(beat);
      trig(boom, 55, 1.4, t, 1);
      trig(crash, 1.2, t, 0.9);
    };
    const playWhoosh = (beat) => {
      // Le souffle culmine sur le temps : il commence un peu avant.
      const t = Math.max(0, beatTime(beat) - 0.09);
      at(t, () => {
        whooshFilter.frequency.setValueAtTime(500, t);
        whooshFilter.frequency.exponentialRampToValueAtTime(4800, t + 0.28);
        whoosh.triggerAttackRelease(0.1, t, 0.85);
      });
    };

    // Grille de batterie d'une mesure entière, temps par temps.
    const grooveBeat = (b, { full = true, darbuka = true, hats = true, clapOn = true }) => {
      const t = beatTime(b);
      const inBar = ((b % 4) + 4) % 4;
      if (full) playKick(t);
      if (clapOn && (inBar === 1 || inBar === 3)) trig(clap, 0.1, t, 0.9);
      if (hats) {
        trig(hat, 0.02, t + s16 * 2, 0.9);
        trig(hat, 0.02, t + s16 * 1, 0.35);
        trig(hat, 0.02, t + s16 * 3, 0.45);
        if (inBar === 3) trig(openHat, 0.1, t + s16 * 2, 0.6);
      }
      if (darbuka) {
        // Maqsoum sur deux temps : doum tek _ tek | doum _ tek _
        const half = inBar % 2;
        if (half === 0) {
          trig(doum, 98, 0.2, t, 0.9);
          trig(tek, 0.03, t + s16 * 1, 0.8);
          trig(tekTone, 820, 0.02, t + s16 * 1, 0.7);
          trig(tek, 0.03, t + s16 * 3, 0.5);
        } else {
          trig(tek, 0.03, t + s16 * 2, 0.85);
          trig(tekTone, 820, 0.02, t + s16 * 2, 0.6);
          trig(tek, 0.03, t + s16 * 3, 0.35);
        }
      }
    };
    const bassBeat = (b, { offbeat = true, eighths = false }) => {
      const chord = chordAt(b);
      const rootNote = style.root - 24 + chord[0];
      const t = beatTime(b);
      trig(sub, midiToFreq(rootNote - 12 + 12), spb * 0.95, t, 0.8);
      if (eighths) {
        trig(bass, midiToFreq(rootNote), s16 * 1.6, t, 0.9);
        trig(bass, midiToFreq(rootNote + 12), s16 * 1.6, t + s16 * 2, 0.9);
      } else if (offbeat) {
        trig(bass, midiToFreq(rootNote + 12), s16 * 1.8, t + s16 * 2, 0.95);
      }
    };

    // --- Les sections ---------------------------------------------------------
    const hook = section("hook");
    const feature = section("feature");
    const brk = section("break");
    const montage = section("montage");
    const end = section("end");

    // Accroche : le filtre s'ouvre, le motif s'annonce, la darbouka seule.
    at(0, () => {
      musicFilter.frequency.setValueAtTime(1400, 0);
      musicFilter.frequency.exponentialRampToValueAtTime(16000, beatTime(feature.from));
    });
    for (let b = hook.from; b < hook.from + hook.beats; b += 4) playPadBar(b, Math.min(4, hook.from + hook.beats - b));
    // Les réseaux se jouent dans les deux premières secondes : l'accroche
    // frappe d'entrée, un impact et l'accord, puis le motif.
    playImpact(hook.from);
    trig(chime, style.progression[0].map((n) => midiToFreq(style.root + 24 + n)), 0.8, beatTime(hook.from), 0.9);
    playMotif(hook.from, Math.ceil(hook.beats / 4), { gain: 1, withShimmer: true });
    for (let b = hook.from; b < hook.from + hook.beats; b++) {
      grooveBeat(b, { full: false, hats: true, clapOn: true, darbuka: true });
    }
    playRiser(Math.max(hook.from, feature.from - 2), Math.min(2, hook.beats));

    // Fonctionnalité : le groove entier, le motif en boucle.
    playImpact(feature.from);
    for (let b = feature.from; b < feature.from + feature.beats; b++) {
      const fromStart = b - feature.from;
      grooveBeat(b, { full: true, darbuka: true, hats: fromStart >= 4 });
      bassBeat(b, { offbeat: true });
      if (fromStart % 4 === 0) playPadBar(b, Math.min(4, feature.from + feature.beats - b));
    }
    for (let b = feature.from; b < feature.from + feature.beats; b += 8) {
      const bars = Math.min(2, Math.ceil((feature.from + feature.beats - b) / 4));
      playMotif(b, bars, { gain: 0.9 });
    }
    // Arpège qui s'ajoute dans la seconde moitié.
    const arpFrom = feature.from + Math.floor(feature.beats / 2 / 4) * 4;
    for (let b = arpFrom; b < feature.from + feature.beats; b++) {
      const chord = chordAt(b);
      for (let i = 0; i < 4; i++) {
        const n = style.root + 12 + chord[(i + b) % chord.length];
        trig(arp, midiToFreq(n), s16, beatTime(b) + i * s16, 0.6);
      }
    }
    playRiser(feature.from + feature.beats - 2, 2);

    // Coupure « Mais aussi » : tout s'arrête sauf un accord en suspens.
    const brkT = beatTime(brk.from);
    trig(boom, 70, 1, brkT, 0.7);
    trig(chime, 
      style.progression[0].map((n) => midiToFreq(style.root + 24 + n)),
      0.8, brkT, 0.9,
    );
    trig(pad, 
      style.progression[0].map((n) => midiToFreq(style.root + n)),
      brk.beats * spb, brkT, 0.9,
    );
    // Roulement de darbouka qui relance.
    for (let i = 0; i < 8; i++) {
      const t = beatTime(brk.from + brk.beats - 1) + i * (spb / 8);
      trig(tek, 0.02, t, 0.3 + i * 0.08);
    }

    // Montage : plus serré, basse en croches, une frappe par plan.
    playImpact(montage.from);
    for (let b = montage.from; b < montage.from + montage.beats; b++) {
      grooveBeat(b, { full: true, darbuka: true, hats: true });
      bassBeat(b, { eighths: true });
      if ((b - montage.from) % 4 === 0) playPadBar(b, Math.min(4, montage.from + montage.beats - b));
    }
    for (let b = montage.from; b < montage.from + montage.beats; b += 8) {
      playMotif(b, Math.min(2, Math.ceil((montage.from + montage.beats - b) / 4)), { octave: 1, gain: 0.75 });
    }
    // Caisse claire qui s'accélère sur la dernière mesure.
    const rollFrom = montage.from + montage.beats - 2;
    for (let i = 0; i < 16; i++) {
      const t = beatTime(rollFrom) + i * (2 * spb / 16);
      trig(clap, 0.05, t, 0.25 + i * 0.04);
    }

    // Fin : l'accord final et le motif posé, puis la queue de réverbération.
    playImpact(end.from);
    playKick(beatTime(end.from));
    const finalChord = style.progression[0];
    trig(pad, finalChord.map((n) => midiToFreq(style.root - 12 + n)), end.beats * spb, beatTime(end.from), 1);
    trig(sub, midiToFreq(style.root - 24), end.beats * spb * 0.6, beatTime(end.from), 0.8);
    trig(chime, finalChord.map((n) => midiToFreq(style.root + 24 + n)), 2, beatTime(end.from), 0.8);
    playMotif(end.from, 1, { gain: 0.7 });
    for (let b = end.from; b < end.from + Math.min(4, end.beats); b++) {
      grooveBeat(b, { full: false, darbuka: true, hats: false, clapOn: false });
    }
    at(beatTime(end.from + 2), () => {
      musicFilter.frequency.setValueAtTime(16000, beatTime(end.from + 2));
      musicFilter.frequency.exponentialRampToValueAtTime(900, beatTime(end.from + end.beats) + timeline.tail);
    });

    // Bruitages de l'image.
    for (const cue of cues) {
      const t = beatTime(cue.beat);
      if (cue.sound === "whoosh") playWhoosh(cue.beat);
      else if (cue.sound === "tap") trig(tap, 1900, 0.03, t, 0.9);
      else if (cue.sound === "pop") trig(tap, 980, 0.05, t, 1);
      else if (cue.sound === "impact") playImpact(cue.beat);
      else if (cue.sound === "chime") trig(chime, [midiToFreq(style.root + 31), midiToFreq(style.root + 36)], 0.6, t, 0.8);
      else if (cue.sound === "swipe") {
        at(t, () => {
          whooshFilter.frequency.setValueAtTime(2400, t);
          whooshFilter.frequency.exponentialRampToValueAtTime(700, t + 0.25);
          whoosh.triggerAttackRelease(0.08, t, 0.5);
        });
      }
    }

    queue.sort((a, b) => a.t - b.t || a.i - b.i);
    for (const event of queue) event.fn();
  }, duration, 2, 44100);

  return encodeWav(buffer.get());
};

function encodeWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const data = [];
  let peak = 0;
  for (let c = 0; c < channels; c++) {
    const ch = audioBuffer.getChannelData(c);
    data.push(ch);
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  }
  // Normalisé à -1 dBFS.
  const gain = peak > 0 ? 0.891 / peak : 1;
  const bytes = new ArrayBuffer(44 + length * channels * 2);
  const view = new DataView(bytes);
  const writeStr = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + length * channels * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length * channels * 2, true);
  let o = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i] * gain));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
