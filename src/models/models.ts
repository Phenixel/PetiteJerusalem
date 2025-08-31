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
}

export interface TextStudyReservation {
  id: string
  sessionId: string // référence vers Session
  chosenById?: string // référence vers User
  chosenByGuestId?: string // référence vers Guest
  chosenByName?: string // nom de l'utilisateur ou de l'invité pour l'affichage
  textStudyId: string // référence vers TextStudy
  available: boolean
  section?: number
  isCompleted: boolean
  createdAt: Date
}
