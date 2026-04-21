import { TypeEvenement } from './evenement.model';

export interface Suggestion {
  id?: number;
  titre: string;
  description?: string;
  typeSouhaite?: TypeEvenement;
  lieuSouhaite?: string;
  dateSouhaitee?: string;
  citoyenId: string;
  emailCitoyen?: string;
  statut?: string;
  commentaireAdmin?: string;
  soumisLe?: string;
}
export interface SuggestionAnalyse {
  scorePertinence: number;
  niveauImpact: string;
  estimationParticipation: string;
  recommandation: string;
  justificationFr: string;
  justificationEn: string;
  categorieImpact: string;
}