# Ocelot - Museum Back End

Backend Fastify pour le musée avec authentification Discord OAuth2.

## 🚀 Installation

```bash
yarn install
```

## 📝 Scripts disponibles

- `yarn dev` - Démarre le serveur en mode développement avec rechargement automatique
- `yarn start` - Démarre le serveur en mode production (utilise Node.js 24 avec support TypeScript natif)
- `yarn test` - Lance les tests unitaires
- `yarn test:watch` - Lance les tests en mode watch (re-exécution automatique)
- `yarn docs` - Génère la documentation OpenAPI/Swagger (JSON, YAML et HTML) à partir des fichiers `.feature` et des schémas Fastify
- `yarn migrate` - Applique toutes les migrations en attente
- `yarn migrate:up` - Applique les migrations en attente
- `yarn migrate:down` - Annule la dernière migration
- `yarn migrate:create <nom>` - Crée une nouvelle migration

## 🌐 Endpoints

### Authentification

- `GET /auth/signin` - Redirige vers Discord OAuth2 pour l'authentification
- `GET /auth/login` - Alias de `/auth/signin`
- `GET /auth/callback` - Callback OAuth2 de Discord (échange le code contre un token)
- `GET /auth/session` - Vérifie l'état de la session (authentifié, refresh token disponible)
- `GET /auth/me` - Récupère les informations de l'utilisateur authentifié (gère automatiquement le refresh du token)

### Paiement (Stripe)

- `POST /pay/checkout` - Crée un nouveau checkout Stripe
  - Body: `{ amount: number, currency?: string, description?: string, success_url: string, cancel_url: string, metadata?: Record<string, string> }`
  - Retourne: `{ id, url, amount_total, currency, status, payment_status, payment_intent? }`
- `GET /pay/checkout/:sessionId` - Vérifie le statut d'un checkout Stripe
  - Retourne: `{ id, amount_total, currency, status, payment_status, payment_intent?, metadata? }`
- `POST /pay/webhook` - Endpoint webhook pour recevoir les notifications de paiement Stripe
  - Met à jour automatiquement les tickets associés selon le statut du paiement

#### Tests des webhooks Stripe

Pour tester les webhooks Stripe en local, utilisez la Stripe CLI :

```bash
stripe listen --forward-to localhost:3500/pay/webhook
```

Cette commande :
- Écoute les événements Stripe depuis votre compte de test
- Les transfère automatiquement vers votre endpoint webhook local
- Affiche la signature du webhook dans la console (à copier dans `STRIPE_WEBHOOK_SECRET` pour les tests)

## ⚙️ Configuration

Le serveur utilise les variables d'environnement suivantes (définies dans `.env.local`) :

### Serveur

- `PORT` - Port d'écoute (défaut: 3000)
- `HOST` - Host d'écoute (défaut: 0.0.0.0)
- `NODE_ENV` - Environnement (`development` ou `production`)

### CORS

- `CORS_ORIGINS` - Origines autorisées (séparées par des virgules, défaut: `http://localhost:3000,http://localhost:4000`)

### Cookies

- `COOKIE_SECRET` - Secret pour signer les cookies (défaut: `your-secret-key-change-in-production`)
- `COOKIE_DOMAIN` - Domaine des cookies (optionnel, utilisé en production)

### Zitadel OpenID Connect

- `ZITADEL_ISSUER` - URL de l'instance Zitadel, sans chemin (requis), par exemple `https://id.example.org`
- `ZITADEL_CLIENT_ID` - ID du client OIDC confidentiel (requis)
- `ZITADEL_CLIENT_SECRET` - Secret du client OIDC (requis, à ne jamais versionner)
- `ZITADEL_REDIRECT_URI` - URI de redirection autorisée dans Zitadel (défaut: `http://localhost:{PORT}/auth/callback`)
- `ZITADEL_SCOPES` - Scopes OIDC demandés. Par défaut : `openid profile email offline_access urn:zitadel:iam:org:project:roles`
- `ZITADEL_ROLES_CLAIM` - Claim des rôles Zitadel (défaut : `urn:zitadel:iam:org:project:roles`)

Dans Zitadel, activer l'émission des rôles pour l'application et attribuer les rôles du projet. La découverte OIDC est chargée depuis `${ZITADEL_ISSUER}/.well-known/openid-configuration`.
- `REFRESH_TOKEN_MAX_AGE_DAYS` - Durée de vie du refresh token en jours (défaut: 90)

### Base de données PostgreSQL

- `DATABASE_URL` - URL de connexion PostgreSQL (format: `postgresql://user:password@host:port/database`)
  - Si configuré, les erreurs seront sauvegardées en base de données
  - Permet la détection de doublons pour éviter le spam sur Discord
- `ERROR_DUPLICATE_WINDOW_HOURS` - Fenêtre de temps (en heures) pour détecter les erreurs dupliquées (défaut: 1)

### Monitoring & Erreurs

- `DISCORD_LOG_WEBHOOK_URL` - URL du webhook Discord pour recevoir les notifications d'erreurs (optionnel)
  - Si configuré, toutes les erreurs seront envoyées à Discord avec les détails (URL, méthode, IP, stack trace)
  - Les erreurs dupliquées (dans la fenêtre configurée) ne seront pas envoyées pour éviter le spam
  - Les réponses HTTP aux clients restent génériques (sans détails de l'erreur)

### Stripe (Paiement)

- `STRIPE_SECRET_KEY` - Clé secrète Stripe (requis pour les paiements)
- `STRIPE_WEBHOOK_SECRET` - Secret du webhook Stripe (requis pour valider les signatures des webhooks en production)
  - En développement, les webhooks sont acceptés même sans signature valide
  - Pour les tests locaux, utilisez la signature affichée par `stripe listen`

### Frontend

- `FRONTEND_URL` - URL du frontend pour les redirections (défaut: `http://localhost:3000`)

## 📁 Structure du projet

```
src/
├── features/
│   ├── auth/
│   │   ├── auth.ctrl.ts      # Contrôleur d'authentification
│   │   ├── auth.ctrl.test.ts # Tests unitaires
│   │   ├── auth.schemas.ts   # Schémas de validation Fastify
│   │   └── auth.types.ts     # Types TypeScript pour Discord
│   ├── docs/
│   │   └── docs.ctrl.ts      # Routes de documentation
│   ├── pay/
│   │   ├── pay.ctrl.ts       # Contrôleur de paiement SumUp
│   │   ├── pay.utils.ts      # Utilitaires pour l'API SumUp
│   │   ├── pay.schemas.ts    # Schémas de validation Fastify
│   │   └── pay.types.ts      # Types TypeScript pour SumUp
│   └── terror/
│       ├── error.handler.ts  # Gestionnaires d'erreurs Fastify
│       ├── error.service.ts  # Services de gestion d'erreurs (DB, Discord)
│       └── error.types.ts    # Types pour les erreurs
├── scripts/
│   └── generate-doc.ts       # Script de génération de documentation
└── server.ts                 # Point d'entrée du serveur
migrations/                   # Migrations de base de données
└── 001_create_errors_table.ts
```

## 🧪 Tests

Les tests utilisent l'API de test native de Node.js (`node:test`) avec les assertions natives (`node:assert`).

```bash
# Lancer tous les tests
yarn test

# Lancer les tests en mode watch
yarn test:watch
```

## 🔒 Sécurité

- Validation automatique des entrées avec JSON Schema
- Sérialisation optimisée des réponses
- Cookies HTTP-only et sécurisés en production
- Headers de sécurité (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS configuré avec support des credentials

## 🛠️ Technologies

- **Fastify 5.6.1** - Framework web rapide
- **TypeScript 5.3.3** - Typage statique
- **Node.js 24** - Support TypeScript natif
- **PostgreSQL** - Base de données relationnelle
- **@fastify/postgres** - Plugin PostgreSQL pour Fastify
- **@fastify/cookie** - Gestion des cookies
- **@fastify/cors** - Gestion CORS
- **node-pg-migrate** - Système de migrations pour PostgreSQL
- **pino-pretty** - Formatage des logs

## 📚 Documentation

La documentation API est générée automatiquement à partir des scénarios Gherkin/Cucumber (`.feature.ts`) et des schémas Fastify.

### Générer la documentation

```bash
yarn docs
```

Cela génère :

- `docs/openapi.json` - Spécification OpenAPI en JSON
- `docs/openapi.yaml` - Spécification OpenAPI en YAML
- `docs/index.html` - Interface Swagger UI interactive (ouvrir dans un navigateur)

### Visualiser la documentation

Ouvrez simplement `docs/index.html` dans votre navigateur pour accéder à l'interface Swagger UI interactive avec :

- Tous les endpoints documentés
- Les scénarios Gherkin intégrés comme descriptions
- La possibilité de tester les endpoints directement
- Les schémas de validation et exemples

## 🗄️ Base de données

### Migrations

Les migrations sont gérées avec `node-pg-migrate`. Les fichiers de migration se trouvent dans le dossier `migrations/`.

#### Développement (utilise `.env.local`)

```bash
# Appliquer toutes les migrations en attente
yarn migrate

# Créer une nouvelle migration
yarn migrate:create nom_de_la_migration

# Annuler la dernière migration
yarn migrate:down
```

#### Production (utilise `.env.prod`)

```bash
# Appliquer toutes les migrations en attente sur la production
yarn migrate:prod

# Annuler la dernière migration en production
yarn migrate:prod:down
```

**⚠️ Attention** : Assurez-vous que le fichier `.env.prod` contient bien la `DATABASE_URL` de votre base de données de production avant d'exécuter les migrations.

### Structure de la table `errors`

La table `errors` stocke toutes les erreurs avec :

- Informations sur l'erreur (nom, message, stack trace)
- Contexte (URL, méthode HTTP, IP)
- Hash unique pour détecter les doublons
- Statut d'envoi à Discord
- Timestamps de création et mise à jour

### Ressources

- [Fastify Documentation](https://fastify.dev/)
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [Fastify Validation & Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [node-pg-migrate Documentation](https://github.com/salsita/node-pg-migrate)
