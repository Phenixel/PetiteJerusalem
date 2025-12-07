<template>
  <footer
    class="mt-auto px-6 py-8 text-text-secondary/90 bg-white/30 border-t border-white/20"
    role="contentinfo"
  >
    <div
      class="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center text-center md:text-left"
    >
      <div class="justify-self-center md:justify-self-start">
        <a
          class="hover:text-primary transition-colors hover:drop-shadow-lg font-medium"
          href="https://phenixel.fr"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fait par Phenixel (ouvre un nouvel onglet)"
        >
          Fait par <strong>Phenixel</strong> 🐦‍🔥
        </a>
      </div>

      <nav class="flex gap-4 items-center justify-center" aria-label="Liens du pied de page">
        <a
          class="hover:text-primary transition-colors hover:drop-shadow-lg"
          href="https://phenixel.notion.site/petite-jerusalem-a-propos"
          target="_blank"
          rel="noopener noreferrer"
        >
          À propos
        </a>
        <span class="opacity-60" aria-hidden="true">•</span>
        <a
          class="hover:text-primary transition-colors hover:drop-shadow-lg"
          href="https://phenixel.notion.site/petite-jerusalem-mentions-legales"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mentions légales
        </a>
        <span class="opacity-60" aria-hidden="true">•</span>
        <a
          class="hover:text-primary transition-colors hover:drop-shadow-lg"
          href="https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4?pvs=105"
          target="_blank"
          rel="noopener noreferrer"
        >
          Signaler un problème
        </a>
      </nav>

      <div
        class="justify-self-center md:justify-self-end flex gap-4 items-center"
        aria-label="Réseaux sociaux"
      >
        <a
          class="flex items-center justify-center w-6 h-6 opacity-85 hover:opacity-100 hover:-translate-y-0.5 transition-all text-text-secondary hover:text-[#333]"
          href="https://github.com/Phenixel/PetiteJerusalem"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <i class="fab fa-github text-xl"></i>
        </a>
        <a
          class="flex items-center justify-center w-6 h-6 opacity-85 hover:opacity-100 hover:-translate-y-0.5 transition-all text-text-secondary hover:text-[#1DA1F2]"
          href="https://x.com/Real_Phenixel"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Twitter"
          title="Twitter"
        >
          <i class="fab fa-twitter text-xl"></i>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts"></script>

<!-- Styles globaux dans src/assets/style.css -->
