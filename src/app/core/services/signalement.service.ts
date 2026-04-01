import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SignalementRequest {
  type:             string;
  description:      string;
  latitude:         number;
  longitude:        number;
  adresse?:         string;
  prioriteCitoyen?: string;
  estAnonyme?:      boolean;
  imageBase64?:     string;
}

export interface SignalementResponse {
  id:                number;
  type:              string;
  description:       string;
  latitude:          number;
  longitude:         number;
  adresse:           string;
  prioriteCitoyen:   string;
  prioriteIA:        string;
  statut:            string;
  equipeIA:          string;
  equipeIALabel:     string;
  delaiEstimeHeures: number;
  confidenceIA:      number;
  citoyenId:         number;
  estAnonyme:        boolean;
  votes:             number;
  dateSignalement:   string;
  mediaUrls:         string[];
  commentaireIA?:    string;
}

@Injectable({ providedIn: 'root' })
export class SignalementService {

  private readonly BASE = `${environment.apiUrl}/api/v1/signalements`;

  constructor(private http: HttpClient) {}

  create(req: SignalementRequest, userId: string): Observable<SignalementResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-User-Id':    userId,
    });
    return this.http.post<SignalementResponse>(this.BASE, req, { headers });
  }

  getAll(statut?: string): Observable<SignalementResponse[]> {
    const url = statut ? `${this.BASE}?statut=${statut}` : this.BASE;
    return this.http.get<SignalementResponse[]>(url);
  }

  getMes(userId: string): Observable<SignalementResponse[]> {
    const headers = new HttpHeaders({ 'X-User-Id': userId });
    return this.http.get<SignalementResponse[]>(`${this.BASE}/mes-signalements`, { headers });
  }

  getById(id: number): Observable<SignalementResponse> {
    return this.http.get<SignalementResponse>(`${this.BASE}/${id}`);
  }

  getProximite(lat: number, lng: number, km = 5): Observable<SignalementResponse[]> {
    return this.http.get<SignalementResponse[]>(
      `${this.BASE}/proximite?lat=${lat}&lng=${lng}&km=${km}`
    );
  }

  voter(id: number): Observable<SignalementResponse> {
    return this.http.post<SignalementResponse>(`${this.BASE}/${id}/vote`, {});
  }

  getStats(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.BASE}/stats`);
  }

  changerStatut(id: number, nouveauStatut: string, commentaire: string, userId: string): Observable<SignalementResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-User-Id':    userId,
    });
    return this.http.patch<SignalementResponse>(
      `${this.BASE}/${id}/statut`,
      { nouveauStatut, commentaire },
      { headers }
    );
  }

  delete(id: number, userId: string): Observable<void> {
    const headers = new HttpHeaders({
      'X-User-Id':   userId,
      'X-User-Role': 'ADMIN',
    });
    return this.http.delete<void>(`${this.BASE}/${id}`, { headers });
  }

  checkDoublon(lat: number, lng: number, type: string): Observable<{
  hasDoublon: boolean;
  signalement?: SignalementResponse;
}> {
  return this.http.get<any>(
    `${this.BASE}/check-doublon?lat=${lat}&lng=${lng}&type=${type}`
  );
}
}
