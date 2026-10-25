/**
 * The montage pool of the 4.0 ads: one label and one capture of
 * scripts/shots-v4.mjs per change, in French. Each ad passes eight of them,
 * never its own subject. Data only: read by src/videos.ts too.
 */
export type AdShot =
  | "parcours"
  | "sidour"
  | "calme"
  | "daf"
  | "traduction"
  | "commentaires"
  | "table"
  | "accueil"
  | "audio"
  | "nichmat40"
  | "halakha"
  | "chnei"
  | "signet"
  | "tehilim"
  | "boussole"
  | "recherche"
  | "rappels"
  | "epingles"
  | "contraste"
  | "contact";

export const AD_SHOTS: Record<AdShot, { label: string; src: string }> = {
  parcours: { label: "Mon parcours", src: "fr-parcours-00.jpg" },
  sidour: { label: "Le Sidour, en premier", src: "fr-sidour.jpg" },
  calme: { label: "Le silencieux à chaque tefila", src: "fr-calme-15.jpg" },
  daf: { label: "La page du daf", src: "fr-daf-06.jpg" },
  traduction: { label: "La traduction sous l'hébreu", src: "fr-traduction.jpg" },
  commentaires: { label: "Les commentaires d'un geste", src: "fr-commentaires-10.jpg" },
  table: { label: "Une table d'étude", src: "fr-table-13.jpg" },
  accueil: { label: "Un accueil à votre main", src: "fr-accueil.jpg" },
  audio: { label: "Les cours en arrière-plan", src: "fr-audio-08.jpg" },
  nichmat40: { label: "Nichmat 40, jour après jour", src: "fr-nichmat40.jpg" },
  halakha: { label: "Halakha et Moussar", src: "fr-halakha.jpg" },
  chnei: { label: "Le chnei mikra, montée après montée", src: "fr-chnei.jpg" },
  signet: { label: "Un signet par livre", src: "fr-signet.jpg" },
  tehilim: { label: "Vos Tehilim d'une traite", src: "fr-tehilim.jpg" },
  boussole: { label: "La boussole face au Kotel", src: "fr-boussole-17.jpg" },
  recherche: { label: "Le Sidour se cherche", src: "fr-recherche.jpg" },
  rappels: { label: "Des rappels à vos heures", src: "fr-rappels.jpg" },
  epingles: { label: "Vos livres épinglés", src: "fr-epingles.jpg" },
  contraste: { label: "Un mode contraste élevé", src: "fr-contraste.jpg" },
  contact: { label: "Nous écrire, depuis l'app", src: "fr-contact-01.jpg" },
};
