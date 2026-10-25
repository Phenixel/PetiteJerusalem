/**
 * The six 4.0 ads (series 3): each one's hook and feature section. Their
 * grid, music and montage are in src/videos.ts (`series: 3`).
 */
import type { ComponentType } from "react";
import type { AdFeatureProps, AdHookLine } from "./Ad.tsx";
import { AccueilAd, CoursAd, DafAd, ParcoursAd, SidourAd, TableAd } from "./scenes.tsx";

const NNBSP = " ";

export const ADS: Record<string, { hook: AdHookLine[]; Feature: ComponentType<AdFeatureProps> }> = {
  "pub-parcours": {
    hook: [
      { text: "Vos objectifs", beat: 0 },
      { text: "d'étude", beat: 0.75 },
      { text: "et de prière", beat: 1.5, accent: true },
    ],
    Feature: ParcoursAd,
  },
  "pub-sidour": {
    hook: [
      { text: "La prière", beat: 0 },
      { text: "du moment,", beat: 0.75 },
      { text: "en premier", beat: 1.5, accent: true },
    ],
    Feature: SidourAd,
  },
  "pub-daf": {
    hook: [
      { text: "Le Talmud", beat: 0 },
      { text: "comme", beat: 0.75 },
      { text: "sur la page", beat: 1.5, accent: true },
    ],
    Feature: DafAd,
  },
  "pub-table": {
    hook: [
      { text: "Plusieurs textes", beat: 0 },
      { text: "ouverts", beat: 0.75 },
      { text: `à la fois${NNBSP}?`, beat: 1.5, accent: true },
    ],
    Feature: TableAd,
  },
  "pub-accueil": {
    hook: [
      { text: "Un accueil", beat: 0 },
      { text: "à votre", beat: 0.75 },
      { text: "main", beat: 1.5, accent: true },
    ],
    Feature: AccueilAd,
  },
  "pub-cours": {
    hook: [
      { text: "Un cours", beat: 0 },
      { text: "qui vous suit", beat: 0.75 },
      { text: "partout", beat: 1.5, accent: true },
    ],
    Feature: CoursAd,
  },
};
