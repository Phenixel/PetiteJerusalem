export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }
  
  export interface Guest {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }
  
  export interface TypeTextStudy {
    id: string;
    name: string;
    createdAt: Date;
  }
  
  export interface TextStudy {
    id: string;
    name: string;
    typeId: string; // référence vers TypeTextStudy
    livre: string;
    link: string;
    totalSections: number;
    createdAt: Date;
  }
  
  export interface Session {
    id: string;
    name: string;
    typeId: string; // référence vers TypeTextStudy
    description: string;
    dateLimit: Date;
    createdAt: Date;
    personId?: string; // référence vers User
    slug: string;
    isCompleted: boolean; // calculé côté application
  }
  
  export interface TextStudyReservation {
    id: string;
    sessionId: string; // référence vers Session
    chosenById?: string; // référence vers User
    chosenByGuestId?: string; // référence vers Guest
    textStudyId: string; // référence vers TextStudy
    available: boolean;
    section?: number;
    isCompleted: boolean;
    createdAt: Date;
  }