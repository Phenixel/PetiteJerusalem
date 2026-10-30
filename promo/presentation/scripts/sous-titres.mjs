#!/usr/bin/env node
/**
 * Writes compositions/sous-titres.html from mots.json: the narration as
 * captions, at the top of the frame (the networks draw over the bottom).
 * A caption holds one clause, eight words at most, on two balanced lines;
 * each word rises at the moment it is said, and one key word per caption
 * takes the italic and the orange ink, as in the 4.0 video. The last
 * sentence is left out: the end card says it.
 *
 * Usage: node scripts/sous-titres.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const phrases = JSON.parse(readFileSync(join(root, "mots.json"), "utf8")).filter((l) => l.chapitre !== "fin");

const EMPHASE = new Set(
  "partager poche jérusalem gratuite plusieurs session lien siyoum étude bibliothèque connexion chiourim prière sidour bougies objectifs habitude portion fait pierre mur année lumière étoiles chabbat".split(
    " ",
  ),
);
const cle = (mot) => mot.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüœæç']/g, "").replace(/^(l|d|c|s|qu|jusqu)'/, "");
const finDeClause = (mot) => /[,:;.?!]$/.test(mot);
const html = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const s3 = (n) => Number(n.toFixed(3));

// Captions: one clause each, eight words at most; a longer clause is cut in
// balanced halves, never right after a small word (« la », « pour »...).
const PETITS = new Set("la le les l' de du des un une et ou pour au aux à sur avec vous votre vos sa son ses ne en".split(" "));
function couper(mots) {
  if (mots.length <= 8) return [mots];
  const n = Math.ceil(mots.length / 8);
  const cible = mots.length / n;
  let best = -1;
  let score = Infinity;
  for (let i = 2; i <= mots.length - 2; i++) {
    const avant = mots[i - 1].mot.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüœæç']/g, "");
    const penalite = PETITS.has(avant) || /'$/.test(avant) ? 100 : 0;
    const s = Math.abs(i - cible) + penalite;
    if (s < score) {
      score = s;
      best = i;
    }
  }
  return [mots.slice(0, best), ...couper(mots.slice(best))];
}
const groupes = [];
for (const phrase of phrases) {
  const clauses = [[]];
  phrase.mots.forEach((m, i) => {
    clauses.at(-1).push(m);
    if (finDeClause(m.mot) && i < phrase.mots.length - 1) clauses.push([]);
  });
  // Short clauses in a row make one list (« Cha'harit, Min'ha, Arvit, »).
  const listes = [];
  for (const c of clauses) {
    const prev = listes.at(-1);
    if (prev && prev.court && c.length < 3 && prev.mots.length + c.length <= 8) prev.mots.push(...c);
    else listes.push({ mots: [...c], court: c.length < 3 });
  }
  // A short one left alone joins the next clause, or else the previous.
  const morceaux = listes.flatMap((l) => couper(l.mots));
  for (let i = 0; i < morceaux.length; i++) {
    const m = morceaux[i];
    if (m.length >= 3 || morceaux.length === 1) continue;
    if (morceaux[i + 1] && morceaux[i + 1].length + m.length <= 8) {
      morceaux[i + 1].unshift(...m);
      morceaux.splice(i--, 1);
    } else if (morceaux[i - 1] && morceaux[i - 1].length + m.length <= 8) {
      morceaux[i - 1].push(...m);
      morceaux.splice(i--, 1);
    }
  }
  for (const mots of morceaux) groupes.push({ phrase: phrase.id, mots });
}

// Two lines balanced by their length, when the caption is long.
function lignes(mots) {
  const texte = mots.map((m) => m.mot).join(" ");
  if (texte.length <= 24 || mots.length < 3) return [mots];
  let best = 1;
  let ecart = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).map((m) => m.mot).join(" ").length;
    const b = mots.slice(i).map((m) => m.mot).join(" ").length;
    if (Math.abs(a - b) < ecart) {
      ecart = Math.abs(a - b);
      best = i;
    }
  }
  return [mots.slice(0, best), mots.slice(best)];
}

const blocs = groupes.map((g, i) => {
  const suivant = groupes[i + 1];
  const debut = i === 0 ? 0 : Math.max(g.mots[0].debut - 0.12, groupes[i - 1].fin ?? 0);
  const derniere = g.mots.at(-1).fin;
  const enchaine = suivant && suivant.mots[0].debut - derniere < 1.1;
  const fin = enchaine ? suivant.mots[0].debut - 0.12 : derniere + 0.55;
  g.fin = fin;
  let accent = false;
  const contenu = lignes(g.mots)
    .map((ligne) => {
      const mots = ligne
        .map((m) => {
          const fort = !accent && EMPHASE.has(cle(m.mot));
          if (fort) accent = true;
          // The first caption is on screen from frame 0, still: it is the thumbnail.
          const t = i === 0 ? -1 : Math.max(debut, m.debut - 0.04);
          return `<span class="st-mot${fort ? " st-fort" : ""}" data-t="${s3(t)}">${html(m.mot)}</span>`;
        })
        .join(" ");
      return `        <p class="st-ligne">${mots}</p>`;
    })
    .join("\n");
  return { id: `st-${String(i + 1).padStart(2, "0")}`, debut: s3(debut), duree: s3(fin - debut), sortie: !enchaine, contenu };
});

const corps = blocs
  .map(
    (b) => `    <div id="${b.id}" class="clip st-groupe" data-start="${b.debut}" data-duration="${b.duree}" data-track-index="0"${b.sortie ? ' data-sortie="1"' : ""}>
      <div class="st-interieur">
${b.contenu}
      </div>
    </div>`,
  )
  .join("\n");

const fichier = `<template>
  <!-- Generated by scripts/sous-titres.mjs from mots.json: edit the script, not this file. -->
  <style>
    #root {
      position: absolute;
      inset: 0;
    }
    #st-cadre {
      position: absolute;
      inset: 0;
      color: var(--encre);
    }
    .st-groupe {
      position: absolute;
      left: 0;
      top: 222px;
      width: 1080px;
      height: 260px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .st-interieur {
      width: 940px;
      text-align: center;
    }
    .st-ligne {
      font-family: var(--police-titre);
      font-weight: 600;
      font-size: 62px;
      line-height: 1.18;
      letter-spacing: -0.01em;
    }
    .st-mot {
      display: inline-block;
    }
    .st-fort {
      font-style: italic;
      color: var(--orange-encre);
    }
  </style>
  <div id="root" data-composition-id="sous-titres" data-width="1080" data-height="1920">
    <div id="st-cadre">
${corps}
    </div>
  </div>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
      document.querySelectorAll("#st-cadre .st-mot").forEach((el) => {
        const t = Number(el.dataset.t);
        if (t < 0) return;
        tl.fromTo(el, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.26, ease: "power3.out" }, t);
      });
      document.querySelectorAll("#st-cadre .st-groupe[data-sortie]").forEach((el) => {
        const fin = Number(el.dataset.start) + Number(el.dataset.duration);
        tl.fromTo(el.firstElementChild, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "power1.in" }, fin - 0.22);
      });
      // Evening, in the prayer chapter: the ink turns light on the night.
      tl.fromTo("#st-cadre", { color: "#35312a" }, { color: "#f3f4f6", duration: 0.45, ease: "none" }, 47.35);
      tl.to("#st-cadre", { color: "#35312a", duration: 0.7, ease: "none" }, 49.25);
      window.__timelines = window.__timelines || {};
      window.__timelines["sous-titres"] = tl;
    })();
  </script>
</template>
`;
writeFileSync(join(root, "compositions/sous-titres.html"), fichier);
console.log(`${blocs.length} captions`);
for (const b of blocs) console.log(b.id, b.debut, (b.debut + b.duree).toFixed(2), b.contenu.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
