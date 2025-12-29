import type { EnumTypeTextStudy } from "./typeTextStudy";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: Date; // Optional: Firebase auth users don't have createdAt
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface TextStudy {
  id: string;
  name: string;
  type: EnumTypeTextStudy;
  livre: string;
  link: string;
  totalSections: number;
  createdAt: Date;
}

export interface Session {
  id: string;
  name: string;
  type: EnumTypeTextStudy;
  description: string;
  dateLimit: Date;
  createdAt: Date;
  personId: string;
  creatorName: string;
  slug: string;
  isCompleted: boolean;
  reservations: TextStudyReservation[];
  isEnded?: boolean;
  endedAt?: Date;
  updatedAt?: Date;
  selectedBooks?: string[];
}

export interface TextStudyReservation {
  id: string;
  chosenById?: string;
  chosenByGuestId?: string;
  chosenByName?: string;
  textStudyId: string;
  available: boolean;
  section?: number;
  isCompleted: boolean;
  createdAt: Date;
}

// Types dédiés aux adaptateurs / stockage (DTO)
export interface ReservationRecord {
  id: string;
  textStudyId: string;
  section?: number;
  chosenById?: string;
  chosenByGuestId?: string;
  chosenByName?: string;
  available: boolean;
  isCompleted: boolean;
  createdAt: string;
}

export interface TextStudyJsonEntry {
  id: number | string;
  name: string;
  livre: string;
  link: string;
  totalSections: number;
  type: string;
}

export interface TextStudiesJson {
  textStudies: TextStudyJsonEntry[];
  types: string[];
}
