export interface Sponsor {
  id?: number;
  nomEntreprise: string;
  logoUrl?: string;
  siteWeb?: string;
  niveauSponsorat?: string;
  montantSponsorat?: number;
  evenementIds?: number[];
  secteurActivite?: string;
  tailleEntreprise?: string;
  zoneGeographique?: string;
  actifSponsoring?: boolean;
}