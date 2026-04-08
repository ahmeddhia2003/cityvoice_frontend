import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MembreEquipe } from './membre.service';
export type Etat= 'N_ATTENTE' | 'EN_EXECUTION' | 'LIBRE'


export interface Equipe{
id?: string;       
  name: string;      
  specialite: string;
  etat?: Etat;       
  membresEquipe?: MembreEquipe[];


}
@Injectable({ providedIn: 'root' })
export class EquipeService {

  private base = `${environment.apiUrl}/personnel/equipe`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Equipe[]> {
    return this.http.get<Equipe[]>(`${this.base}/get`);
  }

  getById(id: string): Observable<Equipe> {
    return this.http.get<Equipe>(`${this.base}/${id}`);
  }

  getByNom(nom: string): Observable<Equipe> {
    return this.http.get<Equipe>(`${this.base}/nom/${nom}`);
  }

  getBySpecialite(specialite: string): Observable<Equipe[]> {
    return this.http.get<Equipe[]>(`${this.base}/specialite/${specialite}`);
  }

  add(equipe: Equipe): Observable<string> {
    return this.http.post(`${this.base}/add`, equipe, { responseType: 'text' });
  }

  update(id: string, equipe: Equipe): Observable<string> {
    return this.http.put(`${this.base}/${id}`, equipe, { responseType: 'text' });
  }

  delete(id: string): Observable<string> {
    return this.http.delete(`${this.base}/${id}`, { responseType: 'text' });
  }

  updateStatut(id: string, etat: Etat): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/${etat}`, {});
  }

  addMembre(id: string, membre: MembreEquipe): Observable<string> {
    return this.http.post(`${this.base}/${id}/membre`, membre, { responseType: 'text' });
  }
}
