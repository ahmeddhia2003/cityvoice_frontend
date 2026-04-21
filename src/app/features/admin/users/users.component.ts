import {Component, OnDestroy, OnInit} from '@angular/core';
import { UserService, UserDto } from '../../../core/services/user.service';
import { SoundService } from '../../../core/services/sound.service';
import { Chart, registerables } from 'chart.js';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../../environments/environment';
Chart.register(...registerables);

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit, OnDestroy {

  // ============================================
  // PROPRIÉTÉS
  // ============================================

  // Données principales
  users: UserDto[] = [];
  loading = true;
  search = '';
  selectedRole = 'ALL';
  roleCounts: Record<string, number> = {};

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Suppression
  deleteConfirm: string | null = null;
  deleteLoading = false;

  // Détail
  selectedUser: UserDto | null = null;
  showDetail = false;
  detailTab: 'profil' | 'scores' | 'actions' = 'profil';

  // Analytics
  analytics: any = null;
  analyticsLoading = true;
  analyticsExpanded = false;
  private charts: Chart[] = [];

  // Ban
  banConfirm: string | null = null;
  banReason = '';
  banLoading = false;
  unbanConfirm: string | null = null;
  customBanReason = '';

  // Analytics avancés
  riskScore: any = null;
  riskLoading = false;
  behaviorAnalysis: any = null;
  behaviorLoading = false;
  churnPrediction: any = null;
  churnLoading = false;
  segmentation: any = null;
  segmentationLoading = false;
  anomaly: any = null;
  anomalyLoading = false;
  insights: any = null;
  insightsLoading = false;
  insightsGenerated = false;
  insightsExpanded = false;

  // Constantes
  readonly banReasons = [
    'Comportement abusif envers d\'autres citoyens',
    'Signalements frauduleux répétés',
    'Contenu inapproprié ou offensant',
    'Usurpation d\'identité',
    'Spam ou activité automatisée',
    'Violation grave des CGU',
    'Motif personnalisé…',
  ];

  readonly roles = [
    'ALL',
    'CITOYEN',
    'CHEF_EQUIPE',
    'MEMBRE_EQUIPE',
    'MODERATEUR'
  ];

  readonly agentStatusOptions = [
    { key: 'DISPONIBLE', label: 'Disponible', color: '#0D9B76', dot: '🟢' },
    { key: 'OCCUPE', label: 'Occupé', color: '#C9973E', dot: '🟡' },
    { key: 'EN_INTERVENTION', label: 'En intervention', color: '#E8532A', dot: '🔴' },
    { key: 'HORS_LIGNE', label: 'Hors ligne', color: '#9CA3AF', dot: '⚫' },
  ];

  // ============================================
  // CONSTRUCTEUR & LIFECYCLE
  // ============================================

  constructor(
    public sound: SoundService,
    private userService: UserService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadRoleCounts();
    this.load();
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
  }

  // ============================================
  // MÉTHODES PRINCIPALES
  // ============================================

  load(): void {
    this.loading = true;
    this.userService.getPaginated(
      this.currentPage,
      this.pageSize,
      this.search || undefined,
      this.selectedRole !== 'ALL' ? this.selectedRole : undefined
    ).subscribe({
      next: (res) => {
        this.users = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.load();
  }

  setRole(role: string): void {
    this.sound.nav();
    this.selectedRole = role;
    this.currentPage = 0;
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.load();
  }

  get pages(): number[] {
    const total = this.totalPages;
    const cur = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);

    const pages: number[] = [];
    for (let i = Math.max(0, cur - 3); i <= Math.min(total - 1, cur + 3); i++) {
      pages.push(i);
    }
    return pages;
  }

  // ============================================
  // GESTION DES UTILISATEURS (DÉTAIL)
  // ============================================

  viewUser(user: UserDto): void {
    this.sound.nav();
    this.selectedUser = user;
    this.showDetail   = true;
    this.detailTab    = 'profil';
    this.deleteConfirm = null;
    this.banConfirm    = null;
    this.unbanConfirm  = null;
    this.banReason     = '';
    this.customBanReason = '';
    this.riskScore     = null;

    this.behaviorLoading = true;
    this.userService.getBehaviorAnalysis(user.id).subscribe({
      next: (res) => {
        try {
          this.behaviorAnalysis = JSON.parse(res.analysis);
        } catch {
          this.behaviorAnalysis = null;
        }
        this.behaviorLoading = false;
      },
      error: () => { this.behaviorLoading = false; }
    });

    if (user.role === 'CITOYEN') {
      this.churnLoading = true;
      this.userService.getChurnPrediction(user.id).subscribe({
        next: (p) => { this.churnPrediction = p; this.churnLoading = false; },
        error: () => { this.churnLoading = false; }
      });

      this.segmentationLoading = true;
      this.segmentation = null;
      this.userService.getUserSegment(user.id).subscribe({
        next: (s) => { this.segmentation = s; this.segmentationLoading = false; },
        error: ()  => { this.segmentationLoading = false; }
      });

      this.anomalyLoading = true;
      this.anomaly = null;
      this.userService.getUserAnomaly(user.id).subscribe({
        next: (a) => { this.anomaly = a; this.anomalyLoading = false; },
        error: ()  => { this.anomalyLoading = false; }
      });
    }
  }

  closeDetail(): void {
    this.showDetail    = false;
    this.selectedUser  = null;
    this.detailTab     = 'profil';
    this.deleteConfirm = null;
    this.banConfirm    = null;
    this.unbanConfirm  = null;
    this.riskScore     = null;
    this.segmentation = null;
    this.anomaly      = null;
  }

  // ============================================
  // SUPPRESSION D'UTILISATEUR
  // ============================================

  confirmDelete(id: string): void {
    this.sound.nav();
    this.deleteConfirm = id;
    this.banConfirm = null;
  }

  cancelDelete(): void {
    this.deleteConfirm = null;
  }

  doDelete(): void {
    if (!this.deleteConfirm) return;
    this.deleteLoading = true;
    const id = this.deleteConfirm;

    this.userService.delete(id).subscribe({
      next: () => {
        this.deleteConfirm = null;
        this.deleteLoading = false;
        if (this.selectedUser?.id === id) this.closeDetail();
        this.load();
      },
      error: () => { this.deleteLoading = false; }
    });
  }

  // ============================================
  // BAN / UNBAN
  // ============================================

  confirmBan(id: string): void {
    this.sound.nav();
    this.banConfirm = id;
    this.banReason = '';
    this.deleteConfirm = null;
  }

  cancelBan(): void {
    this.banConfirm = null;
    this.banReason = '';
  }

  doBan(): void {
    if (!this.banConfirm) return;
    this.banLoading = true;

    const finalReason = this.banReason === 'Motif personnalisé…'
      ? this.customBanReason
      : this.banReason;

    const id = this.banConfirm;
    this.userService.ban(id, finalReason || 'Violation des CGU').subscribe({
      next: () => {
        this.banLoading = false;
        this.banConfirm = null;
        this.banReason  = '';
        this.customBanReason = '';
        const user = this.users.find(u => u.id === id);
        if (user) user.banned = true;
        if (this.selectedUser?.id === id) this.selectedUser.banned = true;
        this.load();
      },
      error: () => { this.banLoading = false; }
    });
  }

  confirmUnban(id: string): void {
    this.sound.nav();
    this.unbanConfirm = id;
  }

  doUnban(): void {
    if (!this.unbanConfirm) return;
    const id = this.unbanConfirm;

    this.userService.unban(id).subscribe({
      next: () => {
        this.unbanConfirm = null;
        const user = this.users.find(u => u.id === id);
        if (user) user.banned = false;
        if (this.selectedUser?.id === id) this.selectedUser.banned = false;
        this.load();
      }
    });
  }

  selectBanReason(reason: string): void {
    this.banReason = reason === 'Motif personnalisé…' ? 'Motif personnalisé…' : reason;
  }

  // ============================================
  // ANALYTICS & INSIGHTS
  // ============================================

  loadAnalytics(): void {
    this.analyticsLoading = true;
    this.http.get<any>(`${environment.apiUrl}/api/admin/analytics`)
      .subscribe({
        next: (data) => {
          this.analytics = data;
          this.analyticsLoading = false;
          setTimeout(() => this.buildCharts(), 50);
        },
        error: () => { this.analyticsLoading = false; }
      });
  }

  toggleAnalytics(): void {
    this.analyticsExpanded = !this.analyticsExpanded;
    if (this.analyticsExpanded && this.analytics) {
      this.charts.forEach(c => c.destroy());
      this.charts = [];
      setTimeout(() => this.buildCharts(), 50);
    }
  }

  generateInsights(): void {
    if (this.insightsLoading) return;
    this.insightsLoading = true;

    this.http.get<any>(`${environment.apiUrl}/api/admin/insights`)
      .subscribe({
        next: (res) => {
          try {
            this.insights = JSON.parse(res.insights);
            this.insightsGenerated = true;
          } catch {
            this.insights = null;
          }
          this.insightsLoading = false;
          this.insightsExpanded = true;
        },
        error: () => {
          this.insightsLoading = false;
        }
      });
  }

  // ============================================
  // MÉTHODES STATISTIQUES
  // ============================================

  countByRole(role: string): number {
    return this.roleCounts[role] ?? 0;
  }

  loadRoleCounts(): void {
    this.userService.getPaginated(0, 1, undefined, undefined).subscribe({
      next: (res) => { this.roleCounts['ALL'] = res.totalElements; }
    });

    const roleList = ['CITOYEN', 'CHEF_EQUIPE', 'MEMBRE_EQUIPE', 'MODERATEUR'];
    roleList.forEach(role => {
      this.userService.getPaginated(0, 1, undefined, role).subscribe({
        next: (res) => { this.roleCounts[role] = res.totalElements; }
      });
    });
  }

  // ============================================
  // MÉTHODES UTILITAIRES (FORMATAGE, COULEURS, ETC.)
  // ============================================

  trackById(_: number, u: UserDto): string {
    return u.id;
  }

  initials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  daysSinceRegistration(user: any): number {
    if (!user?.dateInscription) return 0;
    const diff = Date.now() - new Date(user.dateInscription).getTime();
    return Math.floor(diff / 86_400_000);
  }

  computeGlobalScore(user: UserDto): number {
    if (user.role !== 'CITOYEN') return 0;
    const civic  = Math.max(0, user.civicIndex ?? 0);
    const pts    = Math.min(25, Math.round((user.points ?? 0) / 40));
    const trust  = { NOUVEAU: 0, MEMBRE: 5, HABITUE: 10, VETERAN: 15, AMBASSADEUR: 20 };
    const tScore = trust[user.trustLevel as keyof typeof trust] ?? 0;
    return Math.min(100, Math.round((civic * 0.6) + pts + tScore));
  }

  getOnlineStatusTitle(user: UserDto): string {
    if (user.banned) {
      return 'Compte suspendu';
    }

    if (user.isOnline) {
      return 'En ligne';
    }

    if (user.lastSeenAt) {
      const lastSeen = new Date(user.lastSeenAt);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);

      if (diffMinutes < 60) {
        return `Vu il y a ${diffMinutes} min`;
      } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        return `Vu il y a ${hours}h`;
      } else {
        const days = Math.floor(diffMinutes / 1440);
        return `Vu il y a ${days}j`;
      }
    }

    return 'Hors ligne';
  }

  // ============================================
  // COULEURS ET STYLES (RÔLES)
  // ============================================

  roleColor(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: '#0D9B76',
      CHEF_EQUIPE: '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E',
      MODERATEUR: '#E8532A'
    };
    return map[role] ?? '#8888A8';
  }

  roleBg(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'rgba(13,155,118,.1)',
      CHEF_EQUIPE: 'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)',
      MODERATEUR: 'rgba(232,83,42,.1)',
    };
    return map[role] ?? 'rgba(136,136,168,.1)';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'Citoyen',
      CHEF_EQUIPE: 'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain',
      MODERATEUR: 'Modérateur'
    };
    return map[role] ?? role;
  }

  // ============================================
  // COULEURS ET STYLES (STATUT)
  // ============================================

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      ACTIF: 'Actif',
      NOUVEAU: 'Nouveau membre',
      INCOMPLET: 'Profil incomplet',
      EN_ATTENTE_VERIFICATION: 'Email non vérifié',
      SUSPENDU: 'Suspendu',
    };
    return map[statut] ?? statut;
  }

  getStatutColor(statut: string): string {
    const map: Record<string, string> = {
      ACTIF: '#0D9B76',
      NOUVEAU: '#3B82F6',
      INCOMPLET: '#C9973E',
      EN_ATTENTE_VERIFICATION: '#F97316',
      SUSPENDU: '#E8532A',
    };
    return map[statut] ?? '#9CA3AF';
  }

  getStatutBg(statut: string): string {
    const map: Record<string, string> = {
      ACTIF: 'rgba(13,155,118,.1)',
      NOUVEAU: 'rgba(59,130,246,.1)',
      INCOMPLET: 'rgba(201,151,62,.1)',
      EN_ATTENTE_VERIFICATION: 'rgba(249,115,22,.1)',
      SUSPENDU: 'rgba(232,83,42,.1)',
    };
    return map[statut] ?? 'rgba(156,163,175,.1)';
  }

  // ============================================
  // COULEURS ET STYLES (CIVIC INDEX)
  // ============================================

  getCivicIndexColor(index: number): string {
    if (index >= 80) return '#0D9B76';
    if (index >= 60) return '#3B82F6';
    if (index >= 40) return '#C9973E';
    return '#E8532A';
  }

  getCivicIndexLabel(index: number): string {
    if (index >= 80) return 'Excellent';
    if (index >= 60) return 'Bon';
    if (index >= 40) return 'Moyen';
    return 'À améliorer';
  }

  // ============================================
  // AGENT STATUS
  // ============================================

  getAgentStatusInfo(key: string) {
    return this.agentStatusOptions.find(o => o.key === key)
      ?? { key, label: key, color: '#9CA3AF', dot: '⚫' };
  }

  // ============================================
  // TRUST LEVEL
  // ============================================

  trustLabel(t: string): string {
    const m: Record<string, string> = {
      NOUVEAU: 'Nouveau', MEMBRE: 'Membre', HABITUE: 'Habitué',
      VETERAN: 'Vétéran', AMBASSADEUR: 'Ambassadeur',
    };
    return m[t] ?? t;
  }

  getTrustInfo(points: number, trustLevel: string): any {
    const levels = [
      { key: 'NOUVEAU',     label: 'Nouveau',     icon: '🌱', color: '#9CA3AF', minPts: 0,    maxPts: 49   },
      { key: 'MEMBRE',      label: 'Membre',      icon: '🏛️', color: '#3B82F6', minPts: 50,   maxPts: 199  },
      { key: 'HABITUE',     label: 'Habitué',     icon: '⭐', color: '#C9973E', minPts: 200,  maxPts: 499  },
      { key: 'VETERAN',     label: 'Vétéran',     icon: '🎖️', color: '#0D9B76', minPts: 500,  maxPts: 999  },
      { key: 'AMBASSADEUR', label: 'Ambassadeur', icon: '👑', color: '#7C3AED', minPts: 1000, maxPts: 9999 },
    ];

    const current = levels.find(l => l.key === trustLevel)
      ?? levels.find(l => points >= l.minPts && points <= l.maxPts)
      ?? levels[0];

    const idx = levels.indexOf(current);
    const next = idx < levels.length - 1 ? levels[idx + 1] : null;

    const range = current.maxPts - current.minPts;
    const progress = range > 0
      ? Math.min(100, Math.round(((points - current.minPts) / range) * 100))
      : 100;

    return {
      ...current,
      nextLabel: next?.label ?? null,
      nextMinPts: next?.minPts ?? null,
      progress,
    };
  }

  // ============================================
  // ENGAGEMENT & RISQUE
  // ============================================

  engagementColor(e: string): string {
    const map: Record<string, string> = {
      FAIBLE:     '#9CA3AF',
      MODERE:     '#3B82F6',
      ELEVE:      '#0D9B76',
      TRES_ELEVE: '#C9973E',
    };
    return map[e] ?? '#9CA3AF';
  }

  risqueColor(r: string): string {
    const map: Record<string, string> = {
      FAIBLE: '#0D9B76',
      MOYEN:  '#C9973E',
      ELEVE:  '#E8532A',
    };
    return map[r] ?? '#9CA3AF';
  }

  // ============================================
  // RISK (CHURN) HELPERS
  // ============================================

  getRiskColor(level: string): string {
    const map: Record<string, string> = {
      LOW:      '#0D9B76',
      MEDIUM:   '#C9973E',
      HIGH:     '#E8532A',
      CRITICAL: '#DC2626',
    };
    return map[level] ?? '#9CA3AF';
  }

  getRiskBg(level: string): string {
    const map: Record<string, string> = {
      LOW:      'rgba(13,155,118,.18)',
      MEDIUM:   'rgba(201,151,62,.18)',
      HIGH:     'rgba(232,83,42,.22)',
      CRITICAL: 'rgba(220,38,38,.22)',
    };
    return map[level] ?? 'rgba(156,163,175,.15)';
  }

  getRiskPillColor(level: string): string {
    const map: Record<string, string> = {
      LOW:      '#86EFAC',
      MEDIUM:   '#FCD34D',
      HIGH:     '#FCA5A5',
      CRITICAL: '#FCA5A5',
    };
    return map[level] ?? '#F7F4EF';
  }

  getRiskLabel(level: string): string {
    const map: Record<string, string> = {
      LOW:      'Risque faible',
      MEDIUM:   'Risque modéré',
      HIGH:     'Risque élevé',
      CRITICAL: 'Risque critique',
    };
    return map[level] ?? level;
  }

  churnProbColor(prob: number): string {
    if (prob >= 0.8) return '#FCA5A5';
    if (prob >= 0.6) return '#FCD34D';
    if (prob >= 0.4) return '#FDE68A';
    return '#86EFAC';
  }

  gaugeGradient(level: string): string {
    const map: Record<string, string> = {
      LOW:      'linear-gradient(90deg, #0D9B76, #4ADE80)',
      MEDIUM:   'linear-gradient(90deg, #C9973E, #F59E0B)',
      HIGH:     'linear-gradient(90deg, #C9973E, #E8532A)',
      CRITICAL: 'linear-gradient(90deg, #E8532A, #DC2626)',
    };
    return map[level] ?? '#9CA3AF';
  }

  factorSeverityColor(index: number, total: number): string {
    const ratio = index / Math.max(total - 1, 1);
    if (ratio < 0.33) return '#E8532A';
    if (ratio < 0.66) return '#C9973E';
    return '#3B82F6';
  }

  factorImpact(index: number, totalProb: number): number {
    const base = Math.round((totalProb * 100) / (index + 2));
    return Math.max(5, Math.min(40, base));
  }

  actionPrioColor(priority: string): string {
    const p = (priority || '').toUpperCase();
    if (p.includes('CRITIQUE') || p.includes('CRITICAL')) return '#E8532A';
    if (p.includes('HAUTE') || p.includes('HIGH'))         return '#C9973E';
    return '#3B82F6';
  }

  // ============================================
  // SEGMENTATION
  // ============================================

  segmentColor(segment: string): string {
    const map: Record<string, string> = {
      'Champion':    '#3B82F6',
      'Rising Star': '#0D9B76',
      'At Risk':     '#E8532A',
      'Dormant':     '#9CA3AF',
      'Casual':      '#C9973E',
      'Newcomer':    '#8B5CF6',
    };
    return map[segment] ?? '#9CA3AF';
  }

  segmentBg(segment: string): string {
    const map: Record<string, string> = {
      'Champion':    'rgba(59,130,246,.15)',
      'Rising Star': 'rgba(13,155,118,.15)',
      'At Risk':     'rgba(232,83,42,.15)',
      'Dormant':     'rgba(156,163,175,.15)',
      'Casual':      'rgba(201,151,62,.15)',
      'Newcomer':    'rgba(139,92,246,.15)',
    };
    return map[segment] ?? 'rgba(156,163,175,.15)';
  }

  segmentRingOffset(percentile: number): number {
    const circumference = 125.6;
    return circumference - (circumference * percentile / 100);
  }

  // ============================================
  // ANOMALY
  // ============================================

  anomalyLevelColor(level: string): string {
    const map: Record<string, string> = {
      LOW:    '#0D9B76',
      MEDIUM: '#C9973E',
      HIGH:   '#E8532A',
    };
    return map[level] ?? '#9CA3AF';
  }

  anomalyLevelBg(level: string): string {
    const map: Record<string, string> = {
      LOW:    'rgba(13,155,118,.07)',
      MEDIUM: 'rgba(201,151,62,.07)',
      HIGH:   'rgba(232,83,42,.07)',
    };
    return map[level] ?? 'rgba(156,163,175,.07)';
  }

  anomalyLevelBorder(level: string): string {
    const map: Record<string, string> = {
      LOW:    'rgba(13,155,118,.18)',
      MEDIUM: 'rgba(201,151,62,.2)',
      HIGH:   'rgba(232,83,42,.22)',
    };
    return map[level] ?? 'rgba(156,163,175,.15)';
  }

  anomalySevColor(sev: string): string {
    const map: Record<string, string> = {
      HIGH:   '#E8532A',
      MEDIUM: '#C9973E',
      LOW:    '#3B82F6',
    };
    return map[sev] ?? '#9CA3AF';
  }

  anomalyRingOffset(score: number): number {
    const circumference = 131.9;
    return circumference - (circumference * score);
  }

  formatAnomalyType(type: string): string {
    return (type || '').toLowerCase().replace(/_/g, ' ');
  }

  // ============================================
  // INSIGHTS ALERTS
  // ============================================

  alertColor(type: string): string {
    const map: Record<string, string> = {
      CRITIQUE:    '#E8532A',
      ATTENTION:   '#C9973E',
      POSITIF:     '#3B82F6',
      OPPORTUNITE: '#0D9B76',
    };
    return map[type] ?? '#9CA3AF';
  }

  alertBg(type: string): string {
    const map: Record<string, string> = {
      CRITIQUE:    'rgba(232,83,42,.05)',
      ATTENTION:   'rgba(201,151,62,.05)',
      POSITIF:     'rgba(59,130,246,.05)',
      OPPORTUNITE: 'rgba(13,155,118,.05)',
    };
    return map[type] ?? 'rgba(156,163,175,.05)';
  }

  impactColor(impact: string): string {
    const map: Record<string, string> = {
      'Fort':  '#E8532A',
      'Moyen': '#C9973E',
      'Faible':'#3B82F6',
    };
    return map[impact] ?? '#9CA3AF';
  }

  urgencyColor(urgency: string): string {
    const map: Record<string, string> = {
      'Urgence':      '#E8532A',
      'Cette semaine':'#C9973E',
      'Ce mois':      '#3B82F6',
      'Planifier':    '#0D9B76',
    };
    return map[urgency] ?? '#9CA3AF';
  }

  prioColor(p: string): string {
    const map: Record<string, string> = {
      P1: '#E8532A', P2: '#C9973E', P3: '#3B82F6', P4: '#0D9B76',
    };
    return map[p] ?? '#9CA3AF';
  }

  // ============================================
  // MÉTHODES PRIVÉES (GRAPHES)
  // ============================================

  private buildCharts(): void {
    if (!this.analytics) return;

    this.buildLine(
      'chartInscriptions',
      Object.keys(this.analytics.inscriptionsParJour).map(d =>
        new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      ),
      Object.values(this.analytics.inscriptionsParJour),
      'Nouvelles inscriptions', '#E8532A'
    );

    this.buildDoughnut(
      'chartRoles',
      Object.keys(this.analytics.parRole).map(r => this.roleLabel(r)),
      Object.values(this.analytics.parRole),
      ['#0D9B76', '#3B82F6', '#C9973E', '#E8532A', '#7C3AED']
    );

    this.buildBar(
      'chartGouvernorats',
      Object.keys(this.analytics.parGouvernorat),
      Object.values(this.analytics.parGouvernorat),
      'Utilisateurs par gouvernorat', '#3B82F6'
    );

    this.buildBar(
      'chartTrustLevels',
      Object.keys(this.analytics.parTrustLevel).map(t => this.trustLabel(t)),
      Object.values(this.analytics.parTrustLevel),
      'Citoyens par niveau', '#C9973E'
    );
  }

  private buildLine(id: string, labels: string[], data: number[],
                    label: string, color: string): void {
    const ctx = document.getElementById(id) as HTMLCanvasElement;
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label, data,
          borderColor: color,
          backgroundColor: color + '18',
          borderWidth: 2.5,
          pointBackgroundColor: color,
          pointRadius: 4,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9CA3AF' } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 }, color: '#9CA3AF' },
            grid: { color: 'rgba(12,31,63,.06)' } }
        }
      }
    }));
  }

  private buildDoughnut(id: string, labels: string[], data: number[],
                        colors: string[]): void {
    const ctx = document.getElementById(id) as HTMLCanvasElement;
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c + 'CC'),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom',
            labels: { font: { size: 11 }, color: '#374151', padding: 14 } }
        },
        cutout: '65%',
      }
    }));
  }

  private buildBar(id: string, labels: string[], data: number[],
                   label: string, color: string): void {
    const ctx = document.getElementById(id) as HTMLCanvasElement;
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label, data,
          backgroundColor: color + 'CC',
          borderColor: color,
          borderWidth: 1.5,
          borderRadius: 6,
        }]
      },
      options: {
        indexAxis: id === 'chartGouvernorats' ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(12,31,63,.06)' },
            ticks: { font: { size: 11 }, color: '#9CA3AF' } },
          y: { grid: { display: false },
            ticks: { font: { size: 11 }, color: '#9CA3AF' } }
        }
      }
    }));
  }
}
