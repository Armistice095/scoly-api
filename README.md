# scoly-api

Backend NestJS de Scoly — API REST consommée par le frontend `scoly-web`.
Voir `docs/SPEC.md`, `docs/ARCHITECTURE.md` et `docs/PLAN.md` (dans le dépôt
de documentation du projet) pour le contexte complet.

## Prérequis

- Node.js 20+
- pnpm (`corepack enable` puis `corepack prepare pnpm@latest --activate`, ou
  `npm i -g pnpm`)
- Un projet [Supabase](https://supabase.com) (base PostgreSQL + Storage)

> **Pourquoi pnpm plutôt que npm ?** Le template NestJS généré (avec Vitest,
> oxlint) déclenche un bug connu de résolution de dépendances avec npm.
> pnpm installe sans problème.

## Installation

```bash
pnpm install
cp .env.example .env
```

Remplir `.env` avec les vraies valeurs de votre projet Supabase :
- `DATABASE_URL` : Project Settings → Database → Connection string (URI)
- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` : Project Settings → API

## Base de données

Le schéma complet (`prisma/schema.prisma`) reflète le modèle de données
décrit dans `ARCHITECTURE.md` : `Etablissement`, `Utilisateur`, `Eleve`,
`TypeDocument`, `Document`, `Annulation`.

```bash
pnpm run prisma:generate   # génère le client Prisma typé
pnpm run prisma:migrate    # crée/applique les migrations sur Supabase
pnpm run prisma:seed       # insère un établissement + élèves de test
pnpm run prisma:studio     # interface d'administration visuelle (optionnel)
```

> ⚠️ **Note d'environnement** : dans le bac à sable où ce projet a été
> initialisé, `prisma generate` échoue car le téléchargement des binaires
> moteur Prisma (`binaries.prisma.sh`) est bloqué par les restrictions
> réseau de cet environnement. Le schéma a été vérifié manuellement et le
> reste du projet compile sans erreur (`pnpm run build` passe avec le module
> Prisma temporairement désactivé, comme test). **Dans votre environnement
> de développement normal (accès internet complet), `pnpm run
> prisma:generate` devrait fonctionner sans problème.**

## Développement

```bash
pnpm run start:dev   # démarre l'API en mode watch sur http://localhost:3000
```

Vérifier que tout fonctionne :

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

## Qualité de code

```bash
pnpm run lint    # oxlint
pnpm run format  # prettier
pnpm run test    # tests unitaires (vitest)
pnpm run test:e2e
```

## Structure

```
src/
├── app.module.ts, app.controller.ts, app.service.ts   # module racine + /health
├── prisma/            # PrismaService/PrismaModule (accès base de données)
├── auth/              # Phase 1 — authentification JWT
├── eleves/            # Phase 2 — CRUD élèves
├── documents/         # Phase 3 — génération PDF + QR code
├── verification/       # Phase 4 — endpoint public de vérification
├── tableau-de-bord/    # Phase 7 — statistiques
└── etablissement/      # Phase 6 — paramètres établissement
prisma/
├── schema.prisma       # schéma complet de la base de données
└── seed.ts             # données de test
```

Chaque dossier de module vide contient un `.gitkeep` en attendant sa phase
d'implémentation (voir `docs/PLAN.md`).

## Prochaine étape

Phase 1 du plan d'implémentation : module Auth (inscription/connexion,
JWT access + refresh token, guard d'authentification multi-tenant).
