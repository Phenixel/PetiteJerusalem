/**
 * The narration, one line per beat of the film. `ecrit` is the line as
 * written (French typography: U+202F before ? ! ;, U+00A0 before :), `dit`
 * what the voice reads, respelled where the French phonemizer misreads a
 * word (Téhilim, Mishna, Talmoude, sioum, aïfone). `chapitre` groups the
 * lines into the film's chapters; `apres` leaves room, in seconds, for what
 * the picture does after the line (the siyoum, the slam, the galaxy).
 */
export const LIGNES = [
  {
    id: "v01",
    chapitre: "accroche",
    ecrit: "Et si votre téléphone devenait… une petite Jérusalem ?",
    dit: "Et si votre téléphone devenait… une petite Jérusalem ?",
    apres: 1.6,
  },
  {
    id: "v02",
    chapitre: "marque",
    ecrit: "Petite Jérusalem. L'appli gratuite, et sans publicité.",
    dit: "Petite Jérusalem. L'appli gratuite, et sans publicité.",
  },
  { id: "v03", chapitre: "partage", ecrit: "Lancez une chaîne de lecture.", dit: "Lancez une chaîne de lecture." },
  {
    id: "v04",
    chapitre: "partage",
    ecrit: "150 Tehilim, partagés en un seul lien.",
    dit: "Cent cinquante Téhilim, partagés en un seul lien.",
  },
  {
    id: "v05",
    chapitre: "partage",
    ecrit: "Chacun réserve sa part, la lit, la coche… jusqu'au siyoum !",
    dit: "Chacun réserve sa part, la lit, la coche… jusqu'au sioum !",
    apres: 1.4,
  },
  {
    id: "v06",
    chapitre: "etude",
    ecrit: "Votre téléphone devient un centre d'étude.",
    dit: "Votre téléphone devient un centre d'étude.",
  },
  {
    id: "v07",
    chapitre: "etude",
    ecrit: "Tehilim, Michna, Talmud… et des chiourim à écouter.",
    dit: "Téhilim, Mishna, Talmoude… et des chiourim à écouter.",
  },
  { id: "v08", chapitre: "etude", ecrit: "Même en avion, sans connexion.", dit: "Même en avion, sans connexion.", apres: 0.6 },
  { id: "v09", chapitre: "priere", ecrit: "Toute la prière, au même endroit.", dit: "Toute la prière, au même endroit." },
  {
    id: "v10",
    chapitre: "priere",
    ecrit: "Le Sidour s'ouvre sur l'office du moment, aux horaires de votre ville.",
    dit: "Le Sidour s'ouvre sur l'office du moment, aux horaires de votre ville.",
    apres: 1.2,
  },
  { id: "v11", chapitre: "objectifs", ecrit: "Fixez-vous un objectif.", dit: "Fixez-vous un objectif." },
  {
    id: "v12",
    chapitre: "objectifs",
    ecrit: "L'appli calcule la portion du jour, et vous la rappelle.",
    dit: "L'appli calcule la portion du jour, et vous la rappelle.",
  },
  { id: "v13", chapitre: "objectifs", ecrit: "Un geste… et c'est fait !", dit: "Un geste… et c'est fait !", apres: 1.0 },
  {
    id: "v14",
    chapitre: "suivi",
    ecrit: "Jour après jour, votre mur se construit.",
    dit: "Jour après jour, votre mur se construit.",
  },
  { id: "v15", chapitre: "suivi", ecrit: "Votre mois. Votre année.", dit: "Votre mois. Votre année.", apres: 0.6 },
  {
    id: "v16",
    chapitre: "suivi",
    ecrit: "Et votre série allume une lumière… jusqu'aux étoiles.",
    dit: "Et votre série allume une lumière… jusqu'aux étoiles.",
    apres: 1.6,
  },
  {
    id: "v17",
    chapitre: "fin",
    ecrit: "Petite Jérusalem. Gratuite, sans publicité. Sur Android et iPhone.",
    dit: "Petite Jérusalem. Gratuite, sans publicité. Sur Android et aïfone.",
  },
];
