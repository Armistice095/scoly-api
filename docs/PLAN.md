# PLAN.md — Plan d'implémentation de Scoly

Version 2.0. Découpage en phases livrables, chacune se terminant par un
résultat testable de bout en bout. L'ordre est pensé pour dérisquer le plus
tôt possible la partie la plus critique (génération PDF + QR code), plutôt
que de tout construire en surface d'abord.

**Structure de chaque phase** : les tâches sont regroupées en **Backend**
(`scoly-api`), **Frontend** (`scoly-web`) et, quand c'est pertinent, un
**Contrat d'API** qui liste explicitement les endpoints attendus par le
frontend pour cette phase — c'est le point de synchronisation entre les deux
projets, à valider ensemble avant de coder chacun de son côté.

## Phase 0 — Mise en place du projet

**Objectif : environnement de dev fonctionnel, vide mais propre.**

### Backend (`scoly-api`)
- [ ] Créer le dépôt, initialiser NestJS
- [ ] Créer un projet Supabase (dev) : récupérer la chaîne de connexion
      Postgres et les identifiants Storage
- [ ] Initialiser Prisma, connexion à la base Supabase (dev)
- [ ] Endpoint de santé `GET /health`
- [ ] Linter/formatter (ESLint + Prettier) + CI minimale (lint + build)

### Frontend (`scoly-web`)
- [ ] Créer le dépôt, initialiser SvelteKit + TypeScript + TailwindCSS
- [ ] Page d'accueil temporaire qui appelle `GET /health` sur l'API et
      affiche le résultat
- [ ] Linter/formatter (ESLint + Prettier) + CI minimale (lint + build)

### Contrat d'API
- `GET /health` → `{ status: "ok" }`

**Livrable** : les deux projets démarrent chacun de leur côté, le frontend
appelle l'API et affiche "OK".

## Phase 1 — Modèle de données & authentification

**Objectif : un établissement peut créer un compte et se connecter.**

### Backend (`scoly-api`)
- [ ] Écrire le schéma Prisma complet (`Etablissement`, `Utilisateur`,
      `Eleve`, `TypeDocument`, `Document`, `Annulation`)
- [ ] Migration initiale + script de seed (1 établissement de test, 1
      utilisateur, quelques élèves fictifs)
- [ ] Module Auth : inscription établissement, connexion, JWT
      access/refresh, endpoint de rafraîchissement de token
- [ ] Guard d'authentification + garantie d'isolation par
      `etablissement_id` sur toutes les routes protégées

### Frontend (`scoly-web`)
- [ ] Écran **Connexion**
- [ ] Écran **Inscription établissement** (si self-service au MVP — sinon
      création manuelle en base pour les premiers clients pilotes)
- [ ] Gestion du stockage du token (cookie httpOnly ou store SvelteKit) et
      redirection selon l'état de connexion
- [ ] Tableau de bord vide (coquille protégée par authentification)

### Contrat d'API
- `POST /auth/register` → crée un établissement + son premier utilisateur
- `POST /auth/login` → `{ accessToken, refreshToken }`
- `POST /auth/refresh` → nouveau `accessToken`
- `GET /auth/me` → infos de l'utilisateur/établissement connecté

**Livrable** : un utilisateur peut se connecter et arriver sur un tableau de
bord vide, protégé par authentification.

## Phase 2 — Module Élèves

**Objectif : gérer les élèves d'un établissement (CRUD manuel).**

### Backend (`scoly-api`)
- [ ] Endpoints CRUD `Eleve` (créer, lister avec recherche/filtre, détail,
      modifier) — tous scopés à l'établissement connecté
- [ ] Validation des champs (dates, formats, champs obligatoires)

### Frontend (`scoly-web`)
- [ ] Écran **Liste des élèves** (recherche, filtre par classe/statut)
- [ ] Écran **Ajouter un élève** (formulaire + validation)
- [ ] Écran **Fiche détail élève**
- [ ] Écran **Modifier un élève**
- [ ] États vides (aucun élève encore ajouté)

### Contrat d'API
- `GET /eleves?search=&classe=&statut=` → liste paginée
- `POST /eleves` → créer
- `GET /eleves/:id` → détail
- `PATCH /eleves/:id` → modifier

**Livrable** : un établissement peut gérer sa liste d'élèves de bout en bout.

## Phase 3 — Génération du Certificat de scolarité (cœur du produit)

**Objectif : générer un vrai PDF, avec QR code, à partir d'un élève.**

C'est la phase la plus critique techniquement — à isoler et tester à fond
avant de passer à la suite.

### Backend (`scoly-api`)
- [ ] Créer le template HTML/CSS du certificat de scolarité (reproduire
      fidèlement le modèle de référence fourni : en-tête officiel, corps,
      appréciations, observations, QR code, signature)
- [ ] Service de génération PDF (Puppeteer) : injection des données dans le
      template → PDF A4
- [ ] Génération du QR code (token unique) et injection dans le template
      avant export
- [ ] Génération du `numero_unique` du document
- [ ] Upload du PDF vers **Supabase Storage** (bucket privé)
- [ ] Endpoint de création de document avec validation des champs saisis
      selon le type
- [ ] Endpoint de génération d'URL signée pour télécharger un PDF existant

### Frontend (`scoly-web`)
- [ ] Écran **Choix du type de document** (avec Certificat de scolarité
      actif, autres grisés "Bientôt disponible")
- [ ] Écran **Génération étape 1** — sélection de l'élève
- [ ] Écran **Génération étape 2** — formulaire des champs variables
- [ ] Écran **Aperçu avant génération**
- [ ] Écran **Confirmation** — téléchargement/impression du PDF généré

### Contrat d'API
- `GET /types-documents` → liste des types disponibles (avec statut actif)
- `POST /documents` → `{ eleveId, typeDocumentId, champsSaisis }` → crée le
  document, génère le PDF, retourne `{ id, numeroUnique, urlTelechargement }`
- `GET /documents/:id/telechargement` → URL signée du PDF

### Tests
- [ ] Vérifier le rendu PDF sur plusieurs cas (textes longs, caractères
      spéciaux, accents, impression réelle en A4)

**Livrable** : de bout en bout, un établissement génère un certificat de
scolarité téléchargeable et imprimable, avec QR code fonctionnel.

## Phase 4 — Vérification publique

**Objectif : scanner le QR code affiche la bonne information.**

### Backend (`scoly-api`)
- [x] Endpoint public `POST /verification` (lecture seule, champs restreints,
      rate limité, sans authentification) — QR **et** saisie manuelle
- [x] Colonne `documents.reference_normalisee` + script de rattrapage
      (`pnpm run verification:backfill`) pour les documents déjà émis
- [x] Journal anonymisé des vérifications (IP hachée, 90 jours)
- [x] Contrat OpenAPI : `docs/openapi-verification.yaml`, guide : `docs/API_VERIFICATION.md`

### Frontend (`scoly-web`)
- [ ] Écran public **Vérification — saisie de la référence**
- [ ] Écran public **Vérification — document valide**
- [ ] Écran public **Vérification — document annulé**
- [ ] Écran public **Vérification — document introuvable** (sans coordonnées
      d'école : l'API ne sait pas de quelle école il s'agit)
- [ ] Écran public **Vérification — plusieurs établissements (`AMBIGU`)** :
      champ « Nom de l'établissement » + rappel du QR code (nouveau, absent de la maquette)
- [ ] Gestion des erreurs : 400 (`CHAMP_VIDE`, `FORMAT_INVALIDE`), 429
      (`TROP_DE_REQUETES`, `retryAfterSecondes`), 500, erreur réseau

### Contrat d'API
Voir `docs/API_VERIFICATION.md` (section 0 : changements par rapport à la
maquette). `POST /verification` avec `{ token }` ou `{ reference,
etablissement? }` → `{ resultat: "VALIDE" | "ANNULE" | "INTROUVABLE" |
"AMBIGU", verifieLe, document | null, etablissement | null }`.
(Remplace l'ancien `GET /verifier/:token` : la référence contient des `/` et
ne doit pas transiter par l'URL.)

### Tests
- [ ] Test réel : imprimer un certificat, scanner le QR code avec un
      téléphone, valider le rendu mobile de la page

**Livrable** : le cycle complet génération → impression → scan → vérification
fonctionne de bout en bout.

## Phase 5 — Archives & annulation

**Objectif : historique complet et gestion des erreurs.**

### Backend (`scoly-api`)
- [ ] Endpoints liste des documents (filtres élève/type/date/statut), détail
- [ ] Endpoint d'annulation (motif obligatoire) : bascule le statut, garde la
      trace, se répercute immédiatement sur la page de vérification publique

### Frontend (`scoly-web`)
- [ ] Écran **Liste des archives**
- [ ] Écran **Détail d'un document archivé**
- [ ] Écran/modale **Annulation d'un document**
- [ ] Depuis un document annulé, proposer directement de générer le document
      de remplacement (pré-rempli avec les mêmes infos élève)

### Contrat d'API
- `GET /documents?eleveId=&type=&date=&statut=` → liste paginée
- `GET /documents/:id` → détail
- `POST /documents/:id/annuler` → `{ motif }`

**Livrable** : une école peut corriger une erreur de bout en bout sans jamais
modifier un document existant.

## Phase 6 — Paramètres établissement

**Objectif : informations affichées sur les documents générés.**

### Backend (`scoly-api`)
- [ ] Endpoint de mise à jour des informations de l'établissement
- [ ] Ces informations sont injectées dans le template du certificat (au
      lieu d'être codées en dur)

### Frontend (`scoly-web`)
- [ ] Écran **Paramètres** (nom, adresse, direction départementale,
      signataire)

### Contrat d'API
- `GET /etablissement` → infos actuelles
- `PATCH /etablissement` → mise à jour

**Livrable** : chaque établissement peut personnaliser les informations
institutionnelles qui apparaissent sur ses documents.

## Phase 7 — Tableau de bord

**Objectif : écran d'accueil utile.**

### Backend (`scoly-api`)
- [ ] Endpoint de statistiques (nb élèves, nb documents du mois, 5 derniers
      documents)

### Frontend (`scoly-web`)
- [ ] Écran **Tableau de bord** (avec données)
- [ ] Écran **Tableau de bord** (état vide, guidage vers premières actions)

### Contrat d'API
- `GET /tableau-de-bord` → `{ nbEleves, nbDocumentsCeMois, derniersDocuments[] }`

**Livrable** : à la connexion, l'établissement a une vue utile de son
activité.

## Phase 8 — Durcissement avant lancement pilote

**Objectif : rendre le MVP présentable et fiable pour de vrais utilisateurs.**

### Backend (`scoly-api`)
- [ ] Rate limiting et durcissement sécurité (auth, endpoint public)
- [ ] Vérifier/configurer les sauvegardes automatiques de la base de données
      sur Supabase (fréquence et rétention selon le plan choisi)
- [ ] Test de charge basique sur la génération PDF (temps de réponse
      acceptable)
- [ ] Gestion d'erreurs cohérente (codes HTTP, messages exploitables par le
      frontend)

### Frontend (`scoly-web`)
- [ ] Gestion d'erreurs et messages utilisateur clairs partout (formulaires,
      échecs réseau, etc.)
- [ ] Écrans 404 / erreur générique
- [ ] Responsive (au moins lisible sur tablette)
- [ ] Documentation minimale pour l'utilisateur final (guide rapide)

### Les deux
- [ ] Déploiement staging → recette avec 1-2 écoles pilotes → prod

**Livrable : MVP déployé, testé avec au moins une école pilote réelle.**

## Après le MVP — V1 et V2 (pour mémoire, non détaillé ici)

**V1**
- Import d'élèves en masse (Excel/CSV) + écran de validation
- Nouveaux types de documents (attestation d'inscription, fiche individuelle,
  certificat de transfert, exeat, convocation...)
- Personnalisation du modèle par établissement (logo, en-tête)

**V2**
- Multi-utilisateurs par établissement avec rôles (Directeur, Secrétariat,
  Censeur...)
- Personnalisation avancée des Paramètres (numérotation, activation/
  désactivation des types de documents par établissement)

## Séquencement recommandé

L'ordre ci-dessus (0 → 8) est volontairement construit pour valider la
**Phase 3 (génération PDF + QR code)** le plus tôt possible, car c'est la
partie technique la plus risquée et la plus différenciante du produit. Le
reste (élèves, archives, paramètres, dashboard) est un CRUD classique, moins
risqué, qu'on peut solidifier une fois le cœur validé.

Pour chaque phase, je recommande de valider le **Contrat d'API** ensemble
avant que le développement backend et frontend n'avancent en parallèle — ça
évite les allers-retours et les blocages entre les deux projets séparés.

## Prochaine étape immédiate

Dès validation de ces trois documents (`SPEC.md`, `ARCHITECTURE.md`,
`PLAN.md`), on peut démarrer la **Phase 0** : initialisation des deux dépôts
et de l'environnement de développement.
