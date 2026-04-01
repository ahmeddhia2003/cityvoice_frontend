import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserDto {
  id:             string;
  nom:            string;
  email:          string;
  telephone:      string;
  role:           string;
  points:         number;
  gouvernorat:    string;
  ville:          string;
  codePostal:     string;
  dateInscription:string;
  photo:          string;
}

export interface PointTransactionDto {
  id:          string;
  points:      number;
  reason:      string;
  description: string;
  createdAt:   string;
}

@Injectable({ providedIn: 'root' })
export class UserService {

  private readonly URL = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.URL);
  }

  getByRole(role: string): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.URL}/by-role/${role}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }

  update(id: string, data: Partial<UserDto> & { photo?: string }): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.URL}/${id}`, data);
  }

  updateRole(id: string, role: string): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.URL}/${id}/role`, { role });
  }

  getById(id: string): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.URL}/${id}`);
  }

  getPoints(userId: string): Observable<PointTransactionDto[]> {
    return this.http.get<PointTransactionDto[]>(`${this.URL}/${userId}/points`);
  }
 addPoints(userId: string, points: number, reason: string): Observable<any> {
  return this.http.post(
    `${this.URL}/${userId}/points`,
    null,                                    // ← body vide
    { params: { points: points.toString(), reason } }  // ← params URL
  );
}
}
