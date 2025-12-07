import type { EnumTypeTextStudy } from './typeTextStudy'

export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

export interface Guest {
  id: string
  name: string
  email: string
  createdAt: Date
}

export interface TextStudy {
  id: string
  name: string
  type: EnumTypeTextStudy // référence vers TypeTextStudy
  livre: string
  link: string
  totalSections: number
  createdAt: Date
}

export interface Session {
  id: string
  name: string
  type: EnumTypeTextStudy // référence vers TypeTextStudy
  description: string
  dateLimit: Date
  createdAt: Date
  personId: string // référence vers User (obligatoire)
  creatorName: string // nom du créateur pour l'affichage
  slug: string
  isCompleted: boolean // calculé côté application
  reservations: TextStudyReservation[] // réservations intégrées directement
  isEnded?: boolean // session terminée
  endedAt?: Date // date de fin de session
  updatedAt?: Date // date de dernière modification
}

export interface TextStudyReservation {
  id: string
  chosenById?: string // référence vers User
  chosenByGuestId?: string // référence vers Guest
  chosenByName?: string // nom de l'utilisateur ou de l'invité pour l'affichage
  textStudyId: string // référence vers TextStudy
  available: boolean
  section?: number
  isCompleted: boolean
  createdAt: Date
}

// Types dédiés aux adaptateurs / stockage (DTO)
export interface ReservationRecord {
  id: string
  textStudyId: string
  section?: number
  chosenById?: string
  chosenByGuestId?: string
  chosenByName?: string
  available: boolean
  isCompleted: boolean
  createdAt: string // ISO string pour Firestore
}

export interface TextStudyJsonEntry {
  id: number | string
  name: string
  livre: string
  link: string
  totalSections: number
  type: string
}

export interface TextStudiesJson {
  textStudies: TextStudyJsonEntry[]
  types: string[]
}
