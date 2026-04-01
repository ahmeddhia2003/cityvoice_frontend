import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ============================================================
// INTERFACES
// ============================================================

export interface UserDto {
  id:               string;
  nom:              string;
  email:            string;
  telephone:        string;
  role:             string;
  points:           number;
  monthlyPoints:     number;
  gouvernorat:      string;
  ville:            string;
  codePostal:       string;
  dateInscription:  string;
  photo:            string;
  banned:           boolean;
  banReason:        string;
  loginStreak:      number;
  trustLevel:       string;
  emailVerified:    boolean;

  // ── Champs calculés ──────────────────────────────────
  statut: string;       // ACTIF | NOUVEAU | INCOMPLET | EN_ATTENTE_VERIFICATION | SUSPENDU
  civicIndex:       number;   // 0-100, -1 si non citoyen
  agentStatus:      string;   // DISPONIBLE | OCCUPE | EN_INTERVENTION | HORS_LIGNE
}

export interface PageResponse<T> {
  content:       T[];
  totalElements: number;
  totalPages:    number;
  currentPage:   number;
}

export interface PointTransactionDto {
  id:          string;
  points:      number;
  reason:      string;
  description: string;
  createdAt:   string;
}

export interface BadgeDto {
  id:           string;
  code:         string;
  name:         string;
  description:  string;
  emoji:        string;
  category:     string;
  pointsReward: number;
  color:        string;
}

export interface UserBadgeDto {
  id:         string;
  badge:      BadgeDto;
  obtainedAt: string;
}

export interface TrustInfo {
  level:       string;
  label:       string;
  color:       string;
  icon:        string;
  minPts:      number;
  maxPts:      number;
  nextLabel:   string;
  progress:    number;
}


// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class UserService {

  // ============================================================
  // CONSTANTS
  // ============================================================

  private readonly URL = `${environment.apiUrl}/api/users`;


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(private http: HttpClient) {}


  // ============================================================
  // BASIC CRUD
  // ============================================================

  getAll(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.URL);
  }

  getById(id: string): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.URL}/${id}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }

  update(id: string, data: Partial<UserDto> & { photo?: string }): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.URL}/${id}`, data);
  }


  // ============================================================
  // ROLE MANAGEMENT
  // ============================================================

  getByRole(role: string): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.URL}/by-role/${role}`);
  }

  updateRole(id: string, role: string): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.URL}/${id}/role`, { role });
  }


  // ============================================================
  // BAN / UNBAN
  // ============================================================

  ban(id: string, reason: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/ban`, { reason });
  }

  unban(id: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/unban`, {});
  }


  // ============================================================
  // PAGINATION & SEARCH
  // ============================================================

  getPaginated(page: number, size: number, search?: string, role?: string)
    : Observable<PageResponse<UserDto>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);
    if (search) params = params.set('search', search);
    if (role && role !== 'ALL') params = params.set('role', role);
    return this.http.get<PageResponse<UserDto>>(`${this.URL}/paginated`, { params });
  }


  // ============================================================
  // PUBLIC PROFILE
  // ============================================================

  getPublicProfile(userId: string): Observable<any> {
    return this.http.get(`${this.URL}/${userId}/public`);
  }

  generateBio(data: {
    nom: string; ville: string; gouvernorat: string;
    role: string; points: number; badges: number;
    streak: number; since: string;
  }): Observable<{ bio: string }> {
    return this.http.post<{ bio: string }>(
      `${environment.apiUrl}/api/ai/generate-bio`, data
    );
  }


  // ============================================================
  // POINTS & LEADERBOARD
  // ============================================================

  getPoints(userId: string): Observable<PointTransactionDto[]> {
    return this.http.get<PointTransactionDto[]>(`${this.URL}/${userId}/points`);
  }

  getLeaderboard(limit = 10): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.URL}/leaderboard?limit=${limit}`);
  }


  // ============================================================
  // BADGES
  // ============================================================

  getAllBadges(): Observable<BadgeDto[]> {
    return this.http.get<BadgeDto[]>(`${this.URL}/badges`);
  }

  getUserBadges(userId: string): Observable<UserBadgeDto[]> {
    return this.http.get<UserBadgeDto[]>(`${this.URL}/${userId}/badges`);
  }

  // ============================================================
  // STATUT AGENT
  // ============================================================

  updateAgentStatus(userId: string, status: string): Observable<any> {
    return this.http.patch(`${this.URL}/${userId}/agent-status`, { status });
  }
}
