export interface Participant {
  id?: number;
  citoyenId?: string;
  emailCitoyen?: string;
  nomCitoyen?: string;
  qrToken?: string;
  statutPresence?: string;
  inscritLe?: string;
  evenementId?: number;    
  statutPaiement?: string; 
}