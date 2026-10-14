<script lang="ts">
import type { CardArtSpec } from "../../CardArt.vue";

/** L'objet d'une carte du paquet. */
export type DeckArtSpec =
  | { kind: "siddur" }
  | { kind: "moon" }
  /** L'objet d'une occasion, celui de la carte du Sidour (la lune du soir, la 'hanoukkia, la gerbe). */
  | { kind: "object"; art: CardArtSpec }
  | {
      kind: "volume";
      /** La reliure du corpus. */
      color: string;
      /** Le titre de la couverture : « Moed », « Tehilim ». */
      label: string;
      /** L'avancement, de 0 à 1 : le liseré doré en fait le tour. */
      progress: number;
    };
</script>

<script setup lang="ts">
/**
 * L'objet d'une carte du paquet de l'accueil, aux mesures de la maquette
 * (P2-Accueil) : le sidour d'un office, le volume d'un programme (celui de
 * l'étagère, penché, son liseré doré à l'avancement), la lune du coucher.
 *
 * Sur la carte du dessus, il est à sa taille et ne sort que par le haut,
 * comme l'objet de la carte du Sidour ; dans le portefeuille, il se fait
 * petit et reste dans la carte. Il se pose côté fin de ligne : à droite en
 * français, à gauche en hébreu.
 *
 * Une carte d'occasion porte l'objet de la carte du Sidour (CardArt), à ses
 * mesures à elle.
 */
import ArtSiddur from "../../art/ArtSiddur.vue";
import CardArt from "../../CardArt.vue";
import ProgramVolume from "../ProgramVolume.vue";

defineProps<{ art: DeckArtSpec; small?: boolean }>();
</script>

<template>
  <CardArt v-if="art.kind === 'object'" :art="art.art" :scale="small ? 0.35 : 1" />
  <span
    v-else
    class="deck-art"
    :class="small ? 'deck-art-small' : 'deck-art-big'"
    aria-hidden="true"
  >
    <ArtSiddur v-if="art.kind === 'siddur'" class="deck-art-object deck-art-siddur" />
    <ProgramVolume
      v-else-if="art.kind === 'volume'"
      class="deck-art-object deck-art-volume"
      :color="art.color"
      :lines="[art.label]"
      :progress="art.progress"
      ribbon
    />
    <svg v-else class="deck-art-object deck-art-moon" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="30" fill="#2b3446" />
      <path d="M40 10A30 30 0 0 1 40 70A22 30 0 0 0 40 10Z" fill="#f1ead8" />
    </svg>
  </span>
</template>

<style scoped>
/* La boîte couvre la carte ; grande, elle la déborde par le haut. Elle coupe
   ce qui sortirait par les côtés ou par le bas, aux coins de la carte. */
.deck-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}
.deck-art-big {
  top: -40px;
}
.deck-art-object {
  position: absolute;
}
.deck-art-big .deck-art-object {
  filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.2));
}
:root.perf-lite .deck-art-big .deck-art-object {
  filter: none;
}
.deck-art-big .deck-art-siddur {
  inset-inline-end: 4px;
  top: 25px;
  width: 115px;
  height: 150px;
}
.deck-art-big .deck-art-volume {
  inset-inline-end: 14px;
  top: 24px;
  width: 92px;
  height: 146px;
  transform: rotate(6deg);
}
.deck-art-big .deck-art-moon {
  inset-inline-end: -21px;
  top: 15px;
  width: 150px;
  height: 150px;
  filter: none;
}
.deck-art-small .deck-art-siddur {
  inset-inline-end: 14px;
  top: 10px;
  width: 40px;
  height: 52px;
}
.deck-art-small .deck-art-volume {
  inset-inline-end: 16px;
  top: 9px;
  width: 34px;
  height: 54px;
  transform: rotate(6deg);
}
.deck-art-small .deck-art-moon {
  inset-inline-end: 14px;
  top: 10px;
  width: 46px;
  height: 46px;
}
</style>
