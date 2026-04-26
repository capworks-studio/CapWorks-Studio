# CapWorks Studio - Cloudflare Worker Setup

## 📋 Prérequis

- Compte Cloudflare actif
- Node.js 18+ installé
- npm ou yarn

## 🚀 Installation

### 1. Installer Wrangler
```bash
npm install -g wrangler
```

### 2. Authentifier avec Cloudflare
```bash
wrangler login
```

### 3. Installer les dépendances
```bash
npm install
```

### 4. Configuration (wrangler.toml)
Mets à jour les valeurs suivantes :
- `name` : nom de ton worker
- `route` : URL de déploiement

### 5. Variables d'environnement
Crée un fichier `.env` ou configure via Cloudflare Dashboard :
```
ADMIN_PASSWORD=tonMotDePasse123
DISCORD_WEBHOOK=https://discordapp.com/api/webhooks/...
```

## 📡 API Endpoints

### Public Routes

#### GET /api/services
```bash
curl https://capworks-worker.capkychannel.workers.dev/api/services
```
Retourne la liste des services.

#### GET /api/projects
```bash
curl https://capworks-worker.capkychannel.workers.dev/api/projects
```
Retourne la liste des projets.

#### GET /api/team
```bash
curl https://capworks-worker.capkychannel.workers.dev/api/team
```
Retourne la liste de l'équipe.

#### GET /api/config
```bash
curl https://capworks-worker.capkychannel.workers.dev/api/config
```
Retourne la configuration du site.

#### POST /api/support/tickets
```bash
curl -X POST https://capworks-worker.capkychannel.workers.dev/api/support/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "subject": "Sujet du ticket",
    "message": "Description du problème"
  }'
```
Crée un ticket de support.

### Auth Routes

#### POST /api/auth/register
```bash
curl -X POST https://capworks-worker.capkychannel.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "Jean Dupont"
  }'
```

#### POST /api/auth/login
```bash
curl -X POST https://capworks-worker.capkychannel.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Admin Routes (Nécessite authentification)

#### POST /api/admin/login
```bash
curl -X POST https://capworks-worker.capkychannel.workers.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "tonMotDePasse123"}'
```

#### POST /api/admin/services
Ajouter un service (Admin):
```bash
curl -X POST https://capworks-worker.capkychannel.workers.dev/api/admin/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Nouveau Service",
    "icon": "🚀",
    "desc": "Description",
    "tiers": [...]
  }'
```

#### PUT /api/admin/services
Mettre à jour un service:
```bash
curl -X PUT https://capworks-worker.capkychannel.workers.dev/api/admin/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"id": "s1", "name": "Service Modifié", ...}'
```

#### DELETE /api/admin/services/:id
Supprimer un service:
```bash
curl -X DELETE https://capworks-worker.capkychannel.workers.dev/api/admin/services/s1 \
  -H "Authorization: Bearer TOKEN"
```

## 🧪 Tests Locaux

### Démarrer le serveur de développement
```bash
wrangler dev
```
Le worker sera disponible sur `http://localhost:8787`

### Tester une route
```bash
curl http://localhost:8787/api/services
```

## 🔒 Sécurité

⚠️ **IMPORTANT** :
- Change `ADMIN_PASSWORD` dans `src/index.js`
- Configure ton Discord webhook correctement
- Ajoute la validation des emails
- Implémente un rate limiting
- Utilise des tokens JWT au lieu de simples strings

## 📦 Déploiement

### Deploy sur Cloudflare
```bash
wrangler deploy
```

### Vérifier le déploiement
```bash
curl https://capworks-worker.capkychannel.workers.dev/api/services
```

## 🗄️ Persistence (Optional)

Par défaut, les données sont stockées en mémoire (perdues au redéploiement).

Pour une persistence, ajoute Cloudflare R2 (storage):
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "capworks-data"
```

Puis adapte le code pour sauvegarder/charger depuis R2.

## 🐛 Troubleshooting

**Le worker ne répond pas ?**
- Vérifie les logs: `wrangler tail`
- Contrôle l'authentification Cloudflare

**Erreur CORS ?**
- Les headers CORS sont automatiquement ajoutés
- Teste avec `curl -i` pour voir les headers

**Token invalide ?**
- Utilise le token retourné par `/api/auth/login`
- Ajoute-le dans le header: `Authorization: Bearer TOKEN`

## 📚 Documentation Cloudflare

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Worker API](https://developers.cloudflare.com/workers/runtime-apis/web-fetch/)
- [R2 Storage](https://developers.cloudflare.com/r2/)

---

**Besoin d'aide ?** Ouvre une issue ou contacte support@capworks.studio 🚀
