<script setup lang="ts">
/**
 * Le voile de la barre système, app native seulement.
 *
 * L'app s'affiche bord à bord : rien ne s'arrête sous l'heure et la batterie,
 * la page continue jusqu'en haut de l'écran, et c'est voulu. Mais dès qu'on
 * défile, un titre ou une ligne de texte passe derrière les icônes du système
 * et plus personne ne lit ni les unes ni l'autre.
 *
 * D'où ce voile : pas un bandeau (il rendrait le haut fini, et ce n'est pas ce
 * qu'on veut), mais un flou en dégradé, nul en bas et fort en haut, qui laisse
 * deviner ce qui passe dessous tout en rendant les icônes lisibles. Le flou de
 * fond ne se dégrade pas tout seul : quatre couches de force croissante, dont
 * chacune est masquée en bas, s'additionnent en un dégradé.
 *
 * Rien ne se touche à travers (`pointer-events: none`), et rien ne se lit :
 * c'est du décor, un lecteur d'écran n'a rien à y trouver.
 */
</script>

<template>
  <div class="status-scrim" aria-hidden="true">
    <span class="layer layer-1"></span>
    <span class="layer layer-2"></span>
    <span class="layer layer-3"></span>
    <span class="layer layer-4"></span>
    <span class="tint"></span>
  </div>
</template>

<style scoped>
.status-scrim {
  position: fixed;
  inset: 0 0 auto 0;
  /* La zone système, et un doigt de plus : le dégradé finit sous les icônes,
     pas net à leur bord. */
  height: calc(var(--safe-top) + 0.75rem);
  z-index: 55;
  pointer-events: none;
}

.layer {
  position: absolute;
  inset: 0;
  display: block;
}

/* Chaque couche floute ce qui est derrière elle, couches précédentes
   comprises : le flou s'additionne vers le haut. Le masque décide où elle
   commence à agir. */
.layer-1 {
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  -webkit-mask-image: linear-gradient(to top, transparent 0%, #000 30%);
  mask-image: linear-gradient(to top, transparent 0%, #000 30%);
}

.layer-2 {
  -webkit-backdrop-filter: blur(5px);
  backdrop-filter: blur(5px);
  -webkit-mask-image: linear-gradient(to top, transparent 25%, #000 55%);
  mask-image: linear-gradient(to top, transparent 25%, #000 55%);
}

.layer-3 {
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  -webkit-mask-image: linear-gradient(to top, transparent 50%, #000 80%);
  mask-image: linear-gradient(to top, transparent 50%, #000 80%);
}

.layer-4 {
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  -webkit-mask-image: linear-gradient(to top, transparent 70%, #000 100%);
  mask-image: linear-gradient(to top, transparent 70%, #000 100%);
}

/* Un soupçon de la couleur du fond par-dessus : le flou seul garde la
   luminosité de ce qui passe dessous, et une photo claire sous des icônes
   blanches resterait illisible. */
.tint {
  position: absolute;
  inset: 0;
  display: block;
  background: linear-gradient(
    to top,
    transparent,
    color-mix(in srgb, var(--color-bg-beige) 60%, transparent)
  );
}

:root.dark .tint {
  background: linear-gradient(to top, transparent, rgb(17 24 39 / 0.55));
}

/* Rendu dégradé (perf-lite : rendu logiciel, petite machine, cadence mesurée
   mauvaise) : le flou de fond se recalcule au CPU à chaque image, et il est
   ici en quatre couches. On le coupe, le voile de couleur tient seul. */
:root.perf-lite .layer {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

:root.perf-lite .tint {
  background: linear-gradient(
    to top,
    transparent,
    color-mix(in srgb, var(--color-bg-beige) 88%, transparent)
  );
}

:root.dark.perf-lite .tint {
  background: linear-gradient(to top, transparent, rgb(17 24 39 / 0.88));
}
</style>
