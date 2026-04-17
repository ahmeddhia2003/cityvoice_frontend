export enum TypeEvenement {
  BENEVOLE = 'BENEVOLE',
  PAYANT = 'PAYANT',
  EDUCATION = 'EDUCATION',
  RECYCLAGE = 'RECYCLAGE',
  SEMINAIRE = 'SEMINAIRE',
  AUTRE = 'AUTRE'
}

export enum StatutEvenement {
  BROUILLON = 'BROUILLON',
  PUBLIE = 'PUBLIE',
  ANNULE = 'ANNULE',
  TERMINE = 'TERMINE'
}

export interface Evenement {
  id?: number;
  titre: string;
  description?: string;
  type: TypeEvenement;
  statut?: StatutEvenement;
  dateDebut: string;
  dateFin?: string;
  lieu: string;
  capaciteMax?: number;
  nbInscrits?: number;
  estPayant: boolean;
  prix?: number;
  organisateurId: number;
  imageUrl?: string;
  latitude?: number;  
  longitude?: number;
  createdAt?: string;
  complet?: boolean;
  placesRestantes?: number;
  // Nouveaux champs ML
  typeLieu?: string;
  zone?: string;
  mediaPrevu?: boolean;
  streamingPrevu?: boolean;
  budgetEvenement?: number;
  budgetReel?: number;
}

export interface InscriptionRequest {
  citoyenId: string;
  email: string;
  nom: string;
}