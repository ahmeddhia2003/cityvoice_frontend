export type TypeNotification =
  | 'INSCRIPTION'
  | 'PAIEMENT'
  | 'SUGGESTION_ACCEPTEE'
  | 'SUGGESTION_REJETEE'
  | 'EVENEMENT_ANNULE'
  | 'NOUVEAU_PARTICIPANT'
  | 'NOUVELLE_SUGGESTION';

export interface EvenementNotification {
  id: number;
  destinataireId: string;
  titre: string;
  message: string;
  type: TypeNotification;
  lu: boolean;
  dateCreation: string;
  evenementId?: number;
  evenementTitre?: string;
}