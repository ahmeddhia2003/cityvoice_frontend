import { TypeEvenement } from './evenement.model';

export interface Suggestion {
  id?: number;
  titre: string;
  description?: string;
  typeSouhaite?: TypeEvenement;
  lieuSouhaite?: string;
  dateSouhaitee?: string;
  citoyenId: number;
  emailCitoyen?: string;
  statut?: string;
  commentaireAdmin?: string;
  soumisLe?: string;
}