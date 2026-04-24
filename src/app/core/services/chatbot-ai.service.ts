import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ChatHistoryMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface ChatAiRequest {
  message:       string;
  history?:      ChatHistoryMessage[];
  user_context?: {
    name?:  string;
    role?:  string;
    stats?: {
      total:     number;
      resolus:   number;
      enCours:   number;
      enAttente: number;
    };
  };
  lang?: string;
}

export interface ChatAiResponse {
  reply:         string;
  processing_ms: number;
}

@Injectable({ providedIn: 'root' })
export class ChatbotAiService {

  /** Madina AI service — port 8091 */
  private readonly BASE = 'http://localhost:8091/api/v1';

  constructor(private http: HttpClient) {}

  /**
   * Envoie un message au LLM et retourne la réponse.
   * En cas d'erreur réseau (service AI éteint), retourne null
   * pour que le chatbot utilise le fallback rule-based.
   */
  chat(req: ChatAiRequest): Observable<string | null> {
    return this.http
      .post<ChatAiResponse>(`${this.BASE}/chat`, req)
      .pipe(
        map(res => res.reply),
        catchError(err => {
          console.warn('[ChatbotAI] Service unavailable, using rule-based fallback:', err.message);
          return of(null);  // null → le composant affichera le fallback classique
        }),
      );
  }
}
