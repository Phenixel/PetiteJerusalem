<template>
  <div class="stone-wall" aria-hidden="true">
    <div class="stone-wall__glow"></div>
  </div>
</template>

<style scoped>
/* Jerusalem-stone wall, drawn behind the whole app on the beige background.
   Two layers share the same 480×320 ashlar tile (running bond, wrap-around
   stones on rows 2 and 4 so the tiling never shows a vertical seam):
   - a static texture layer: each stone face a slightly different beige;
   - a glow layer masked to the stone outlines, lit by two huge soft light
     blobs that drift very slowly, so the joints appear to shimmer as the
     light passes over them.
   Both layers are alpha masks over a plain color, so dark mode only has to
   swap the two custom properties below. */
.stone-wall {
  --wall-ink: #57492c;
  --wall-glow-rgb: 164 132 72;
  --wall-glow-a: 0.18;
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

:root.dark .stone-wall {
  --wall-ink: #d6d3c8;
  --wall-glow-rgb: 222 205 160;
  --wall-glow-a: 0.09;
}

/* Stone faces: constant tint, the per-stone alpha lives in the mask. */
.stone-wall::before {
  content: "";
  position: absolute;
  inset: 0;
  background-color: var(--wall-ink);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='480'%20height='320'%3E%3Cg%20fill='%23fff'%20stroke='%23fff'%20stroke-opacity='.06'%20stroke-width='1.5'%3E%3Crect%20x='0'%20y='0'%20width='150'%20height='72'%20rx='3'%20fill-opacity='0.028'/%3E%3Crect%20x='158'%20y='0'%20width='172'%20height='72'%20rx='3'%20fill-opacity='0.018'/%3E%3Crect%20x='338'%20y='0'%20width='134'%20height='72'%20rx='3'%20fill-opacity='0.038'/%3E%3Crect%20x='-104'%20y='80'%20width='192'%20height='72'%20rx='3'%20fill-opacity='0.024'/%3E%3Crect%20x='376'%20y='80'%20width='192'%20height='72'%20rx='3'%20fill-opacity='0.024'/%3E%3Crect%20x='96'%20y='80'%20width='144'%20height='72'%20rx='3'%20fill-opacity='0.04'/%3E%3Crect%20x='248'%20y='80'%20width='120'%20height='72'%20rx='3'%20fill-opacity='0.016'/%3E%3Crect%20x='0'%20y='160'%20width='198'%20height='72'%20rx='3'%20fill-opacity='0.02'/%3E%3Crect%20x='206'%20y='160'%20width='114'%20height='72'%20rx='3'%20fill-opacity='0.042'/%3E%3Crect%20x='328'%20y='160'%20width='144'%20height='72'%20rx='3'%20fill-opacity='0.026'/%3E%3Crect%20x='64'%20y='240'%20width='160'%20height='72'%20rx='3'%20fill-opacity='0.036'/%3E%3Crect%20x='232'%20y='240'%20width='150'%20height='72'%20rx='3'%20fill-opacity='0.02'/%3E%3Crect%20x='390'%20y='240'%20width='146'%20height='72'%20rx='3'%20fill-opacity='0.03'/%3E%3Crect%20x='-90'%20y='240'%20width='146'%20height='72'%20rx='3'%20fill-opacity='0.03'/%3E%3C/g%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='480'%20height='320'%3E%3Cg%20fill='%23fff'%20stroke='%23fff'%20stroke-opacity='.06'%20stroke-width='1.5'%3E%3Crect%20x='0'%20y='0'%20width='150'%20height='72'%20rx='3'%20fill-opacity='0.028'/%3E%3Crect%20x='158'%20y='0'%20width='172'%20height='72'%20rx='3'%20fill-opacity='0.018'/%3E%3Crect%20x='338'%20y='0'%20width='134'%20height='72'%20rx='3'%20fill-opacity='0.038'/%3E%3Crect%20x='-104'%20y='80'%20width='192'%20height='72'%20rx='3'%20fill-opacity='0.024'/%3E%3Crect%20x='376'%20y='80'%20width='192'%20height='72'%20rx='3'%20fill-opacity='0.024'/%3E%3Crect%20x='96'%20y='80'%20width='144'%20height='72'%20rx='3'%20fill-opacity='0.04'/%3E%3Crect%20x='248'%20y='80'%20width='120'%20height='72'%20rx='3'%20fill-opacity='0.016'/%3E%3Crect%20x='0'%20y='160'%20width='198'%20height='72'%20rx='3'%20fill-opacity='0.02'/%3E%3Crect%20x='206'%20y='160'%20width='114'%20height='72'%20rx='3'%20fill-opacity='0.042'/%3E%3Crect%20x='328'%20y='160'%20width='144'%20height='72'%20rx='3'%20fill-opacity='0.026'/%3E%3Crect%20x='64'%20y='240'%20width='160'%20height='72'%20rx='3'%20fill-opacity='0.036'/%3E%3Crect%20x='232'%20y='240'%20width='150'%20height='72'%20rx='3'%20fill-opacity='0.02'/%3E%3Crect%20x='390'%20y='240'%20width='146'%20height='72'%20rx='3'%20fill-opacity='0.03'/%3E%3Crect%20x='-90'%20y='240'%20width='146'%20height='72'%20rx='3'%20fill-opacity='0.03'/%3E%3C/g%3E%3C/svg%3E");
  -webkit-mask-size: 480px 320px;
  mask-size: 480px 320px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
}

/* Joint lines, revealed only where a light blob passes. */
.stone-wall__glow {
  position: absolute;
  inset: 0;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='480'%20height='320'%3E%3Cg%20fill='%23fff'%20fill-opacity='.10'%20stroke='%23fff'%20stroke-width='2'%3E%3Crect%20x='0'%20y='0'%20width='150'%20height='72'%20rx='3'%20/%3E%3Crect%20x='158'%20y='0'%20width='172'%20height='72'%20rx='3'%20/%3E%3Crect%20x='338'%20y='0'%20width='134'%20height='72'%20rx='3'%20/%3E%3Crect%20x='-104'%20y='80'%20width='192'%20height='72'%20rx='3'%20/%3E%3Crect%20x='376'%20y='80'%20width='192'%20height='72'%20rx='3'%20/%3E%3Crect%20x='96'%20y='80'%20width='144'%20height='72'%20rx='3'%20/%3E%3Crect%20x='248'%20y='80'%20width='120'%20height='72'%20rx='3'%20/%3E%3Crect%20x='0'%20y='160'%20width='198'%20height='72'%20rx='3'%20/%3E%3Crect%20x='206'%20y='160'%20width='114'%20height='72'%20rx='3'%20/%3E%3Crect%20x='328'%20y='160'%20width='144'%20height='72'%20rx='3'%20/%3E%3Crect%20x='64'%20y='240'%20width='160'%20height='72'%20rx='3'%20/%3E%3Crect%20x='232'%20y='240'%20width='150'%20height='72'%20rx='3'%20/%3E%3Crect%20x='390'%20y='240'%20width='146'%20height='72'%20rx='3'%20/%3E%3Crect%20x='-90'%20y='240'%20width='146'%20height='72'%20rx='3'%20/%3E%3C/g%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='480'%20height='320'%3E%3Cg%20fill='%23fff'%20fill-opacity='.10'%20stroke='%23fff'%20stroke-width='2'%3E%3Crect%20x='0'%20y='0'%20width='150'%20height='72'%20rx='3'%20/%3E%3Crect%20x='158'%20y='0'%20width='172'%20height='72'%20rx='3'%20/%3E%3Crect%20x='338'%20y='0'%20width='134'%20height='72'%20rx='3'%20/%3E%3Crect%20x='-104'%20y='80'%20width='192'%20height='72'%20rx='3'%20/%3E%3Crect%20x='376'%20y='80'%20width='192'%20height='72'%20rx='3'%20/%3E%3Crect%20x='96'%20y='80'%20width='144'%20height='72'%20rx='3'%20/%3E%3Crect%20x='248'%20y='80'%20width='120'%20height='72'%20rx='3'%20/%3E%3Crect%20x='0'%20y='160'%20width='198'%20height='72'%20rx='3'%20/%3E%3Crect%20x='206'%20y='160'%20width='114'%20height='72'%20rx='3'%20/%3E%3Crect%20x='328'%20y='160'%20width='144'%20height='72'%20rx='3'%20/%3E%3Crect%20x='64'%20y='240'%20width='160'%20height='72'%20rx='3'%20/%3E%3Crect%20x='232'%20y='240'%20width='150'%20height='72'%20rx='3'%20/%3E%3Crect%20x='390'%20y='240'%20width='146'%20height='72'%20rx='3'%20/%3E%3Crect%20x='-90'%20y='240'%20width='146'%20height='72'%20rx='3'%20/%3E%3C/g%3E%3C/svg%3E");
  -webkit-mask-size: 480px 320px;
  mask-size: 480px 320px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
}

.stone-wall__glow::before,
.stone-wall__glow::after {
  content: "";
  position: absolute;
  top: -36vmax;
  left: -36vmax;
  width: 72vmax;
  height: 72vmax;
  border-radius: 50%;
  background: radial-gradient(
    circle closest-side,
    rgb(var(--wall-glow-rgb) / var(--wall-glow-a)),
    transparent 68%
  );
  will-change: transform;
}

.stone-wall__glow::before {
  animation: stone-wall-drift-a 55s ease-in-out infinite alternate;
}

.stone-wall__glow::after {
  width: 56vmax;
  height: 56vmax;
  top: -28vmax;
  left: -28vmax;
  opacity: 0.7;
  animation: stone-wall-drift-b 75s ease-in-out infinite alternate;
  animation-delay: -30s;
}

@keyframes stone-wall-drift-a {
  0% {
    transform: translate3d(-10vw, -5vh, 0) scale(1);
  }
  50% {
    transform: translate3d(45vw, 55vh, 0) scale(1.15);
  }
  100% {
    transform: translate3d(95vw, 15vh, 0) scale(0.95);
  }
}

@keyframes stone-wall-drift-b {
  0% {
    transform: translate3d(105vw, 90vh, 0) scale(1.1);
  }
  50% {
    transform: translate3d(50vw, 20vh, 0) scale(0.9);
  }
  100% {
    transform: translate3d(0vw, 80vh, 0) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stone-wall__glow::before,
  .stone-wall__glow::after {
    animation: none;
  }
  .stone-wall__glow::before {
    transform: translate3d(50vw, 30vh, 0);
  }
  .stone-wall__glow::after {
    transform: translate3d(20vw, 80vh, 0);
  }
}
</style>
