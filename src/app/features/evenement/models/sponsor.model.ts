export interface Sponsor {
  id?: number;
  nomEntreprise: string;
  logoUrl?: string;
  siteWeb?: string;
  montantSponsorat?: number;
  niveauSponsorat?: string; // BRONZE, ARGENT, OR, PLATINE
}