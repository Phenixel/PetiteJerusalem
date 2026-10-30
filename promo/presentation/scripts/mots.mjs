#!/usr/bin/env node
/**
 * Times every word of the narration (voix.json), without a transcription
 * model: Kokoro gives no word timestamps, and the speech models cannot be
 * downloaded here. Each sentence is cut into clauses at its punctuation, and
 * each clause boundary is placed on the pause the voice really makes there
 * (ffmpeg silencedetect, the closest pause to where the syllables expect
 * it); inside a clause, words share its time by their syllables.
 *
 * Output: mots.json, the words of each sentence with their start and end in
 * the film's time. Usage: node scripts/mots.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const voix = JSON.parse(readFileSync(join(root, "voix.json"), "utf8"));

/** Syllables of a written French word, close enough to share time. */
function syllabes(mot) {
  if (/^\d+$/.test(mot)) return { 150: 3 }[mot] ?? mot.length;
  const w = mot.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüœæç']/g, "");
  const groupes = w.match(/[aeiouyàâäéèêëîïôöùûüœæ]+/g)?.length ?? 1;
  const muet = groupes > 1 && /[^aeiouyàâäéèêëîïôöùûü](e|es|ent)$/.test(w) ? 1 : 0;
  return Math.max(1, groupes - muet);
}

function detect(file) {
  // ffmpeg writes its filter log on stderr.
  const res = execFileSync("bash", ["-c", `ffmpeg -hide_banner -i "${file}" -af silencedetect=noise=-38dB:d=0.08 -f null - 2>&1`], {
    encoding: "utf8",
  });
  const out = [];
  let start = null;
  for (const line of res.split("\n")) {
    const s = line.match(/silence_start: ([\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Number(s[1]);
    if (e && start !== null) {
      out.push({ start, end: Number(e[1]) });
      start = null;
    }
  }
  return out;
}

const resultat = [];
for (const ligne of voix.lignes) {
  const file = join(root, "assets/voix", `${ligne.id}.wav`);
  const silencesTrouvees = detect(file).filter((s) => s.start > 0.05 && s.end < ligne.duree - 0.05);
  // Clauses: words up to and including a punctuation mark.
  // Split on plain spaces only: a non-breaking space keeps « : » or « ? » with its word.
  const mots = ligne.ecrit.split(/ +/).filter(Boolean);
  const clauses = [[]];
  for (const mot of mots) {
    clauses.at(-1).push(mot);
    if (/[,:;.?!]$/.test(mot) || /^[:;?!]$/.test(mot)) clauses.push([]);
  }
  if (!clauses.at(-1).length) clauses.pop();
  const poids = clauses.map((c) => c.reduce((n, m) => n + syllabes(m) + 0.25, 0));
  const totalPoids = poids.reduce((a, b) => a + b, 0);
  // Expected boundaries, then snapped to the nearest real pause.
  const bornes = [{ debut: 0 }];
  let cumul = 0;
  const libres = [...silencesTrouvees];
  for (let i = 0; i < clauses.length - 1; i++) {
    cumul += poids[i];
    const attendu = (cumul / totalPoids) * ligne.duree;
    let best = -1;
    let ecart = 0.7;
    const apres = bornes.at(-1).debut + 0.15;
    libres.forEach((s, j) => {
      const d = Math.abs((s.start + s.end) / 2 - attendu);
      if (s.start > apres && d < ecart) {
        ecart = d;
        best = j;
      }
    });
    if (best >= 0) {
      const s = libres.splice(best, 1)[0];
      bornes.at(-1).fin = s.start;
      bornes.push({ debut: s.end });
    } else {
      const t = Math.max(attendu, apres);
      bornes.at(-1).fin = t - 0.06;
      bornes.push({ debut: t + 0.06 });
    }
  }
  bornes.at(-1).fin = ligne.duree;
  const sortie = [];
  clauses.forEach((clause, i) => {
    const { debut, fin } = bornes[i];
    const w = clause.map((m) => syllabes(m) + 0.25);
    const somme = w.reduce((a, b) => a + b, 0);
    let t = debut;
    clause.forEach((mot, j) => {
      const d = ((fin - debut) * w[j]) / somme;
      sortie.push({ mot, debut: +(ligne.debut + t).toFixed(3), fin: +(ligne.debut + t + d).toFixed(3) });
      t += d;
    });
  });
  resultat.push({ id: ligne.id, chapitre: ligne.chapitre, debut: ligne.debut, fin: ligne.fin, mots: sortie, pauses: silencesTrouvees.length, clauses: clauses.length });
}

writeFileSync(join(root, "mots.json"), JSON.stringify(resultat, null, 1) + "\n");
for (const l of resultat) {
  console.log(`${l.id} clauses ${l.clauses} pauses ${l.pauses}`);
  console.log("   " + l.mots.map((m) => `${m.mot}@${m.debut.toFixed(1)}`).join(" "));
}
