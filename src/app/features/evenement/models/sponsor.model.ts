export interface Sponsor {
  id?: number;
  nomEntreprise: string;
  logoUrl?: string;
  siteWeb?: string;
  niveauSponsorat?: string;
  montantSponsorat?: number;
  evenementIds?: number[];
}