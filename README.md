# CityVoice — Frontend

> Interface citoyenne de la plateforme **CityVoice** — connecter les citoyens avec leur municipalité.

---

## 🧱 Stack technique

| Technologie | Version |
|---|---|
| Angular | 17+ |
| TypeScript | 5.x |
| RxJS | 7.x |
| Angular Router | lazy loading |
| HttpClient | avec interceptor JWT |

---

## ⚙️ Prérequis

```bash
node --version   # >= 18
npm --version    # >= 9
ng version       # Angular CLI installé globalement
```

Si Angular CLI n'est pas installé :

```bash
npm install -g @angular/cli
```

---

## 🚀 Installation & lancement

```bash
# 1. Cloner le repo
git clone https://github.com/votre-org/cityvoice.git
cd cityvoice/cityvoice-frontend

# 2. Installer les dépendances
npm install

# 3. Lancer en développement
ng serve --open
# → http://localhost:4200
```

> ⚠️ Le backend Spring Boot doit tourner sur `http://localhost:8080` avant de lancer le frontend.

---

## 🔗 Connexion au backend

Le frontend communique exclusivement avec l'**API Gateway** sur le port `8080`.

```
src/environments/environment.ts
```

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};
```

Ne jamais appeler les microservices directement — tout passe par le gateway.

---

## 📦 Structure du projet

```
src/app/
├── core/                        # Singletons — injectés une seule fois
│   ├── services/
│   │   └── auth.service.ts      # login(), logout(), getToken()
│   ├── guards/
│   │   └── auth.guard.ts        # Protège les routes privées
│   ├── interceptors/
│   │   └── jwt.interceptor.ts   # Injecte Bearer token sur chaque requête
│   └── core.module.ts
│
├── features/                    # Modules lazy-loaded (un par domaine)
│   ├── auth/                    # Login, register
│   ├── dashboard/               # Tableau de bord citoyen
│   ├── signalement/             # Signalements (list, create, detail)
│   ├── evenement/               # Événements
│   ├── projet/                  # Projets & votes
│   ├── actualite/               # Actualités municipales
│   ├── personnel/               # Gestion personnel
│   └── admin/                   # Administration (ROLE_ADMIN)
│
├── shared/                      # Composants réutilisables
│   └── shared.module.ts
│
├── models/                      # Interfaces TypeScript (entités)
│
├── app-routing.module.ts        # Routes principales + lazy loading
└── app.module.ts
```

---

## 🔐 Authentification

Le système d'auth est basé sur **JWT** :

1. `POST /api/auth/login` → reçoit `{ token }`
2. Token stocké dans `localStorage`
3. `JwtInterceptor` injecte `Authorization: Bearer <token>` sur chaque requête HTTP
4. `AuthGuard` protège toutes les routes sauf `/auth/login`

**Credentials de test (backend hardcodé) :**
```
username: admin
password: admin
```

---

## 🗺️ Routes principales

| Route | Module | Accès |
|---|---|---|
| `/auth/login` | AuthModule | Public |
| `/dashboard` | DashboardModule | Connecté |
| `/signalements` | SignalementModule | Connecté |
| `/evenements` | EvenementModule | Connecté |
| `/projets` | ProjetModule | Connecté |
| `/actualites` | ActualiteModule | Connecté |
| `/admin` | AdminModule | ROLE_ADMIN |

---

## 👥 Organisation de l'équipe

Chaque membre prend un module feature. Les modules sont **indépendants** — pas de conflits Git.

| Module | Responsable |
|---|---|
| `auth` | — |
| `dashboard` | — |
| `signalement` | — |
| `evenement` | — |
| `projet` | — |
| `actualite` | — |
| `admin` | — |

> Remplissez le tableau avec les noms de l'équipe.

---

## 🧪 Tester l'auth manuellement

```bash
# 1. Backend sur :8080
# 2. Frontend sur :4200
ng serve

# 3. Ouvrir http://localhost:4200
# → Redirigé vers /auth/login
# → Login avec admin / admin
# → Redirigé vers /dashboard
# → Vérifier dans DevTools > Application > localStorage → clé "token"
```

---

## 🔧 Commandes utiles

```bash
ng serve                          # Dev server
ng build                          # Build production
ng generate component path/name   # Nouveau composant
ng generate service path/name     # Nouveau service
```

---

## 🔗 Repos liés

- **Backend** : `cityvoice/cityvoice-backend` — Spring Boot microservices
- **Gateway** : port `8080` — Spring Cloud Gateway + JWT filter
- **Eureka** : port `8761` — Service discovery

---

## 📄 Licence

Projet académique — ESPRIT 2025
