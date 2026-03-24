export interface Participant {
  id?: number;
  evenementId?: number;
  citoyenId?: number;
  nomCitoyen: string;
  emailCitoyen: string;
  confirme?: boolean;
  rappelEnvoye?: boolean;
  inscritLe?: string;
}