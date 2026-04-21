import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type StatutContrat =
  | 'EN_ATTENTE_SIGNATURE'
  | 'ACCEPTE'
  | 'REFUSE'
  | 'REASSIGNE';

/** Signalement imbriqué tel que retourné par l'entité Java */
export interface SignalementEmbed {
  id:                number;
  type:              string;
  description:       string;
  latitude:          number;
  longitude:         number;
  adresse:           string | null;
  prioriteCitoyen:   string;
  prioriteIA:        string | null;
  statut:            string;
  equipeIA:          string | null;
  equipeIALabel:     string | null;
  delaiEstimeHeures: number | null;
  confidenceIA:      number | null;
  citoyenId:         string;
  estAnonyme:        boolean;
  votes:             number;
  dateSignalement:   string;
  mediaUrls:         string[];
}

/** Contrat de travail tel que retourné par l'entité Java */
export interface ContratTravailResponse {
  id:                number;
  numeroContrat:     string;
  statut:            StatutContrat;
  equipeCode:        string;
  equipeLabel:       string;
  chefEquipeId:      string | null;
  chefEquipeNom:     string | null;
  signalement:       SignalementEmbed;
  delaiEstimeHeures: number | null;
  motifRefus:        string | null;
  tentative:         number;
  contratParentId:   number | null;
  dateCreation:      string;
  dateReponse:       string | null;
}

export interface ContratReponseRequest {
  signatureBase64?: string;
  motifRefus?:      string;
}

export interface ContratStats {
  total:     number;
  enAttente: number;
  acceptes:  number;
  refuses:   number;
}

@Injectable({ providedIn: 'root' })
export class ContratTravailService {

  private readonly URL = `${environment.apiUrl}/api/v1/contrats`;

  constructor(private http: HttpClient) {}

  getById(id: number): Observable<ContratTravailResponse> {
    return this.http.get<ContratTravailResponse>(`${this.URL}/${id}`);
  }

  getByNumero(numero: string): Observable<ContratTravailResponse> {
    return this.http.get<ContratTravailResponse>(`${this.URL}/numero/${numero}`);
  }

  getContratActifParSignalement(sigId: number): Observable<ContratTravailResponse> {
    return this.http.get<ContratTravailResponse>(`${this.URL}/signalement/${sigId}`);
  }

  getHistoriqueParSignalement(sigId: number): Observable<ContratTravailResponse[]> {
    return this.http.get<ContratTravailResponse[]>(`${this.URL}/signalement/${sigId}/historique`);
  }

  getContratsEnAttente(): Observable<ContratTravailResponse[]> {
    return this.http.get<ContratTravailResponse[]>(`${this.URL}/en-attente`);
  }

  getTousLesContrats(): Observable<ContratTravailResponse[]> {
    return this.http.get<ContratTravailResponse[]>(this.URL);
  }

  getStats(): Observable<ContratStats> {
    return this.http.get<ContratStats>(`${this.URL}/stats`);
  }

  getContratsParChef(chefId: string): Observable<ContratTravailResponse[]> {
    return this.http.get<ContratTravailResponse[]>(`${this.URL}/chef/${chefId}`);
  }

  getContratsEquipeEnAttente(equipeCode: string): Observable<ContratTravailResponse[]> {
    return this.http.get<ContratTravailResponse[]>(`${this.URL}/equipe/${equipeCode}/en-attente`);
  }

  /** Tous les contrats d'une équipe tous statuts — fallback si chefId non lié */
  getContratsParEquipe(equipeCode: string): Observable<ContratTravailResponse[]> {
    return this.http.get<ContratTravailResponse[]>(`${this.URL}/equipe/${equipeCode}`);
  }

  accepter(id: number, req: ContratReponseRequest, chefId: string): Observable<ContratTravailResponse> {
    return this.http.post<ContratTravailResponse>(
      `${this.URL}/${id}/accepter`, req,
      { headers: { 'X-User-Id': chefId } }
    );
  }

  refuser(id: number, req: ContratReponseRequest, chefId: string): Observable<ContratTravailResponse> {
    return this.http.post<ContratTravailResponse>(
      `${this.URL}/${id}/refuser`, req,
      { headers: { 'X-User-Id': chefId } }
    );
  }
}
