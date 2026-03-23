import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AssistRequest {
  latitude:         number;
  longitude:        number;
  image_base64?:    string;
  description_user?: string;
}

export interface AssistResponse {
  type_suggere:          string;
  type_label:            string;
  priorite_suggere:      string;
  description_amelioree: string;
  confidence:            number;
  processing_ms:         number;
}

export interface AnalyzeRequest {
  description:  string;
  latitude:     number;
  longitude:    number;
  image_base64?: string;
}

export interface AnalyzeResponse {
  categorie:      string;
  priorite:       string;
  priorite_score: number;
  equipe:         string;
  equipe_label:   string;
  delai_heures:   number;
  confidences:    Record<string, number>;
  processing_ms:  number;
}

@Injectable({ providedIn: 'root' })
export class AiService {

  /** URL du service FastAPI — changer en prod */
  private readonly BASE = 'http://localhost:8091/api/v1';

  constructor(private http: HttpClient) {}

  /**
   * BOUTON AIDE IA — Optionnel.
   * Envoie image + GPS → reçoit type, priorité, description améliorée.
   */
  assist(req: AssistRequest): Observable<AssistResponse> {
    return this.http.post<AssistResponse>(`${this.BASE}/assist`, req);
  }

  /**
   * ANALYSE COMPLÈTE — Après soumission du formulaire.
   * Toujours exécutée → assigne équipe + calcule délai.
   */
  analyze(req: AnalyzeRequest): Observable<AnalyzeResponse> {
    return this.http.post<AnalyzeResponse>(`${this.BASE}/analyze`, req);
  }

  /** Santé du service IA */
  health(): Observable<any> {
    return this.http.get(`${this.BASE}/health`);
  }
}
