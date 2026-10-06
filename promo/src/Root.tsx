/**
 * Les compositions Remotion : une par vidéo (npm run studio pour les voir,
 * npm run render pour les rendre).
 */
import type { ComponentType } from "react";
import { Composition } from "remotion";
import { Promo, type FeatureProps, type HookLine } from "./Promo.tsx";
import { ChiffresFeature } from "./scenes2/Chiffres.tsx";
import { FetesFeature } from "./scenes2/Fetes.tsx";
import { JourneeFeature } from "./scenes2/Journee.tsx";
import { LanguesFeature } from "./scenes2/Langues.tsx";
import { RefouaFeature } from "./scenes2/Refoua.tsx";
import { SecretsFeature } from "./scenes2/Secrets.tsx";
import { Story } from "./Story.tsx";
import { BibliothequeFeature } from "./scenes/Bibliotheque.tsx";
import { CalendrierFeature } from "./scenes/Calendrier.tsx";
import { HorairesFeature } from "./scenes/Horaires.tsx";
import { LectureDuJourFeature } from "./scenes/LectureDuJour.tsx";
import { PartageFeature } from "./scenes/Partage.tsx";
import { SidourFeature } from "./scenes/Sidour.tsx";
import { FPS, HEIGHT, WIDTH, totalFrames } from "./timeline.ts";
import { VIDEOS, videoTimeline } from "./videos.ts";

const NNBSP = "\u202f";

/** L'accroche et la scène de chaque vidéo. */
const SCENES: Record<string, { hook: HookLine[]; Feature: ComponentType<FeatureProps> }> = {
  horaires: {
    hook: [
      { text: "Chabbat", beat: 0 },
      { text: "entre", beat: 1 },
      { text: "à quelle", beat: 2 },
      { text: `heure${NNBSP}?`, beat: 3, accent: true },
    ],
    Feature: HorairesFeature,
  },
  partage: {
    hook: [
      { text: "150", beat: 0 },
      { text: "Tehilim", beat: 1 },
      { text: "à se partager", beat: 2, accent: true },
    ],
    Feature: PartageFeature,
  },
  bibliotheque: {
    hook: [
      { text: "Toute", beat: 0 },
      { text: "la Torah", beat: 1 },
      { text: "dans la poche", beat: 2, accent: true },
    ],
    Feature: BibliothequeFeature,
  },
  sidour: {
    hook: [
      { text: "Votre sidour", beat: 0 },
      { text: "sait quel jour", beat: 1 },
      { text: "on est", beat: 2, accent: true },
    ],
    Feature: SidourFeature,
  },
  calendrier: {
    hook: [
      { text: "Hanoukah,", beat: 0 },
      { text: "c'est quand", beat: 1 },
      { text: `déjà${NNBSP}?`, beat: 2, accent: true },
    ],
    Feature: CalendrierFeature,
  },
  "lecture-du-jour": {
    hook: [
      { text: "Une lecture", beat: 0 },
      { text: "par jour,", beat: 1 },
      { text: "sans y penser", beat: 2, accent: true },
    ],
    Feature: LectureDuJourFeature,
  },
  // Série 2.
  refoua: {
    hook: [
      { text: "Un proche", beat: 0 },
      { text: "est malade.", beat: 1 },
      { text: `Que faire${NNBSP}?`, beat: 2, accent: true },
    ],
    Feature: RefouaFeature,
  },
  journee: {
    hook: [
      { text: "Votre journée,", beat: 0 },
      { text: "réglée", beat: 1 },
      { text: "sur le ciel", beat: 2, accent: true },
    ],
    Feature: JourneeFeature,
  },
  secrets: {
    hook: [
      { text: "3 gestes", beat: 0 },
      { text: "que personne", beat: 1 },
      { text: "ne connaît", beat: 2, accent: true },
    ],
    Feature: SecretsFeature,
  },
  chiffres: {
    hook: [
      { text: "0\u00a0€", beat: 0 },
      { text: "0 publicité", beat: 1 },
      { text: "0 compte obligatoire", beat: 2, accent: true },
    ],
    Feature: ChiffresFeature,
  },
  fetes: {
    hook: [
      { text: "Votre app", beat: 0 },
      { text: "se met", beat: 1 },
      { text: "en fête", beat: 2, accent: true },
    ],
    Feature: FetesFeature,
  },
  langues: {
    hook: [
      { text: "Français,", beat: 0 },
      { text: "English,", beat: 1 },
      { text: "עברית", beat: 2, accent: true },
    ],
    Feature: LanguesFeature,
  },
};

export const Root = () => (
  <>
    {VIDEOS.filter((v) => SCENES[v.id]).map((spec) => (
      <Composition
        key={spec.id}
        id={spec.id}
        component={() => (spec.series === 2 ? <Story spec={spec} {...SCENES[spec.id]} /> : <Promo spec={spec} {...SCENES[spec.id]} />)}
        durationInFrames={totalFrames(videoTimeline(spec))}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);
