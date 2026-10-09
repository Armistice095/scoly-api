# API — Vérification publique d'un document

Page **publique** (sans connexion) qui permet à n'importe qui — employeur, autre établissement, administration, parent — de vérifier qu'un document émis via Scoly est authentique, et s'il est toujours valable.

Deux façons d'arriver sur la page :

1. **Scan du QR code** imprimé sur le document → la page s'ouvre déjà identifiée.
2. **Saisie manuelle** de la référence imprimée en haut du document (ex. `N°0042/2025-2026/CEG-GODOMEY`).

> Contrat machine-lisible : [`openapi-verification.yaml`](./openapi-verification.yaml) (OpenAPI 3.0). Importable dans Swagger Editor, Postman, Insomnia, ou pour générer les types TypeScript. Les deux fichiers sont contrôlés contre le code par un test : ils ne peuvent pas diverger sans qu'il échoue.

**Sommaire**

0. [⚠️ À l'attention de l'équipe frontend — ce qui change](#0-️-à-lattention-de-léquipe-frontend--ce-qui-change)
1. [Vue d'ensemble](#1-vue-densemble)
2. [Conventions](#2-conventions)
3. [Requête — `POST /verification`](#3-requête--post-verification)
4. [Réponse](#4-réponse)
5. [Le résultat `AMBIGU`, pas à pas](#5-le-résultat-ambigu-pas-à-pas)
6. [Parcours QR code](#6-parcours-qr-code)
7. [Codes d'erreur](#7-codes-derreur)
8. [Limitation de débit](#8-limitation-de-débit)
9. [Saisie tolérée (normalisation)](#9-saisie-tolérée-normalisation)
10. [Confidentialité : ce qui sort, ce qui ne sort jamais](#10-confidentialité--ce-qui-sort-ce-qui-ne-sort-jamais)
11. [Garanties](#11-garanties)
12. [Correspondance avec la maquette](#12-correspondance-avec-la-maquette)
13. [Mise en production (pour l'équipe backend/ops)](#13-mise-en-production-pour-léquipe-backendops)

---

## 0. ⚠️ À l'attention de l'équipe frontend — ce qui change

Cinq points s'écartent de la maquette ou de `PLAN.md` ; ils demandent une action côté front.

| # | Changement | Action front |
|---|---|---|
| 1 | **Nouveau résultat `AMBIGU`** (absent de la maquette). | **Créer un 5ᵉ écran/état**, voir [§ 5](#5-le-résultat-ambigu-pas-à-pas). Sans lui, une référence existant dans deux écoles s'afficherait à tort « Introuvable ». |
| 2 | La référence n'est **unique que par établissement** : « N°42/2025-2026 » peut exister dans deux écoles. | C'est la cause du point 1. Le QR code, lui, n'est jamais ambigu. |
| 3 | Route **`POST /verification`** (corps JSON), et non `GET /verifier/:token` comme dans `PLAN.md`. | Le jeton ou la référence vont dans le **corps**, jamais dans l'URL (une référence contient des `/` et identifie un élève : elle ne doit pas finir dans les logs ni dans l'en-tête Referer). |
| 4 | L'écran **« Introuvable » ne peut pas afficher les coordonnées de « CEG Godomey »** comme dans la maquette : pour une référence inconnue, l'API ne sait pas de quelle école il s'agit. | Afficher un texte générique : « Contactez l'établissement émetteur en indiquant la référence du document. » (`etablissement` vaut `null`). Idem pour `AMBIGU`. |
| 5 | Le champ s'appelle **`resultat`** (`VALIDE` / `ANNULE` / `INTROUVABLE` / `AMBIGU`), pas `statut`. Le nom de l'élève arrive **déjà masqué** (« Adjovi A. »). | Afficher tel quel, ne rien reformater. |

Et deux obligations pour ne pas dégrader la sécurité :

- **Aucun cache** : ne jamais mettre le résultat en cache côté front (service worker, `localStorage`…). Un document actif aujourd'hui peut être annulé demain.
- **L'heure de vérification vient du serveur** (`verifieLe`), jamais de l'horloge du navigateur.

---

## 1. Vue d'ensemble

| Route | Rôle | Authentification | Effet |
|---|---|---|---|
| `POST /verification` | Vérifier un document par jeton QR **ou** par référence | **Aucune** | Aucun (lecture seule) |

Une seule route pour les deux modes : même forme de réponse, même gestion d'erreurs.
`POST` bien que sans effet de bord : voir point 3 ci-dessus.

Quatre résultats, tous en **HTTP 200** :

| `resultat` | Signification | Écran |
|---|---|---|
| `VALIDE` | Le document existe et son statut est Actif. | « Authenticité du document confirmée » |
| `ANNULE` | Le document existe mais a été annulé par l'établissement. | « Document annulé » |
| `INTROUVABLE` | Aucune correspondance. | « Document introuvable » |
| `AMBIGU` | **Saisie manuelle uniquement** : cette référence existe dans plusieurs établissements. Aucune donnée n'est divulguée. | **Nouveau** — voir [§ 5](#5-le-résultat-ambigu-pas-à-pas) |

> « Introuvable » n'est **pas une erreur** (pas de 404) : c'est un résultat normal de la vérification. Les vraies erreurs (champ vide, trop de requêtes, panne) ont leur propre code, voir [§ 7](#7-codes-derreur).

---

## 2. Conventions

- **URL** : `https://<api>/verification` (pas de préfixe global).
- **Authentification** : aucune. Ne **pas** envoyer de cookie ni de jeton d'accès (`credentials: 'omit'`). Un en-tête `Authorization` est ignoré.
- **CORS** : seule(s) l'origine(s) de la page de vérification est (sont) autorisée(s) (`VERIFICATION_CORS_ORIGIN`, à défaut `CORS_ORIGIN`), méthode `POST`, en-tête `Content-Type` uniquement, **sans credentials**. Un appel depuis une autre origine est bloqué par le navigateur.
- **Corps** : `Content-Type: application/json`. Tout champ non listé au [§ 3](#3-requête--post-verification) est refusé (`VALIDATION_ERROR`).
- **Dates** : `dateEmission` et `dateAnnulation` sont des **jours civils** `AAAA-MM-JJ` (déjà en heure du Bénin, Africa/Porto-Novo) ; `verifieLe` est un **instant** ISO 8601 en UTC, à afficher en `Africa/Porto-Novo` (ex. `2026-10-05T17:47:12.345Z` → « 5 octobre 2026 à 18:47 »).
- **Cache** : toutes les réponses portent `Cache-Control: no-store`.
- **Erreurs** : même enveloppe que le reste de l'API — `{ statusCode, code, message, erreurs? }` — avec, en plus, `code` toujours présent et stable sur cette route.

---

## 3. Requête — `POST /verification`

Corps JSON : **soit** `token`, **soit** `reference` (jamais les deux).

| Champ | Type | Quand | Description |
|---|---|---|---|
| `token` | texte | Parcours QR | Jeton lu dans l'URL du QR (dernier segment), tel quel. |
| `reference` | texte | Saisie manuelle | Référence recopiée du document. Tolérante, voir [§ 9](#9-saisie-tolérée-normalisation). 120 caractères max. |
| `etablissement` | texte, facultatif | Saisie manuelle, **après un `AMBIGU`** | Nom, même partiel, de l'établissement émetteur. Ignoré avec `token`. 150 caractères max. |

Un champ facultatif envoyé vide (`""`) ou `null` équivaut à « non fourni » : le front peut envoyer un formulaire tel quel.

```jsonc
// Parcours QR
{ "token": "AbCdEfGhIjKlMnOpQrStUvWxYz012345" }

// Saisie manuelle
{ "reference": "N°0042/2025-2026/CEG-GODOMEY" }

// Saisie manuelle, après AMBIGU
{ "reference": "N°0042/2025-2026/CEG-GODOMEY", "etablissement": "CEG Godomey" }
```

---

## 4. Réponse

**200** — toujours la **même enveloppe**, quel que soit le résultat (mêmes clés, `null` quand non applicable) :

| Champ | Type | Description |
|---|---|---|
| `resultat` | `"VALIDE"` \| `"ANNULE"` \| `"INTROUVABLE"` \| `"AMBIGU"` | Le verdict. **C'est lui qui pilote l'écran.** |
| `verifieLe` | texte ISO 8601 UTC | Heure du serveur au moment de la vérification (« Vérification effectuée le … »). |
| `document` | objet \| `null` | Présent pour `VALIDE` et `ANNULE`. |
| `document.typeDocument` | texte | « Certificat de scolarité » |
| `document.reference` | texte | « N°0042/2025-2026/CEG-GODOMEY » (telle qu'imprimée) |
| `document.eleve` | texte | **Masqué** : premier prénom + initiale du nom, « Adjovi A. » |
| `document.dateEmission` | `AAAA-MM-JJ` | « Établi le » |
| `document.dateAnnulation` | `AAAA-MM-JJ` \| `null` | Renseigné uniquement pour `ANNULE` (« annulé … le 30 septembre 2026 »). |
| `etablissement` | objet \| `null` | Présent pour `VALIDE` et `ANNULE`. |
| `etablissement.nom` | texte | Nom tel qu'imprimé sur le document. |
| `etablissement.localite` | texte | « Abomey-Calavi, Atlantique » (commune, département) |
| `etablissement.pays` | texte | « République du Bénin » |
| `etablissement.telephone` | texte \| `null` | Coordonnées **actuelles** de l'école. |
| `etablissement.email` | texte \| `null` | Idem. |

### Exemples

**`VALIDE`**
```json
{
  "resultat": "VALIDE",
  "verifieLe": "2026-10-05T17:47:12.345Z",
  "document": {
    "typeDocument": "Certificat de scolarité",
    "reference": "N°0042/2025-2026/CEG-GODOMEY",
    "eleve": "Adjovi A.",
    "dateEmission": "2026-09-28",
    "dateAnnulation": null
  },
  "etablissement": {
    "nom": "CEG Godomey",
    "localite": "Abomey-Calavi, Atlantique",
    "pays": "République du Bénin",
    "telephone": "+229 01 00 00 00 00",
    "email": "secretariat@ceg-godomey.bj"
  }
}
```

**`ANNULE`** — identique, avec `"resultat": "ANNULE"` et `"dateAnnulation": "2026-09-30"`.

**`INTROUVABLE`**
```json
{ "resultat": "INTROUVABLE", "verifieLe": "2026-10-05T17:48:03.120Z", "document": null, "etablissement": null }
```

**`AMBIGU`**
```json
{ "resultat": "AMBIGU", "verifieLe": "2026-10-05T17:48:41.007Z", "document": null, "etablissement": null }
```

> `INTROUVABLE` et `AMBIGU` ont volontairement la même forme vide : rien n'est révélé sur ce qui existe.

---

## 5. Le résultat `AMBIGU`, pas à pas

### Pourquoi il existe

Le numéro de référence est attribué **par établissement**. Le format est paramétrable : beaucoup d'écoles n'y mettent pas leur nom (par défaut `N°{N}/{ANNEE}`). « N°42/2025-2026 » peut donc exister dans le CEG A **et** dans le Lycée B. Répondre « introuvable » serait faux ; choisir au hasard une école serait pire (on confirmerait le document d'un autre élève). L'API ne divulgue donc **rien** et demande une précision.

### Ce que le front doit faire

1. L'utilisateur saisit la référence → `POST { reference }`.
2. Réponse `AMBIGU` → afficher l'état « plusieurs établissements », avec :
   - un message qui explique la situation ;
   - un champ **« Nom de l'établissement »** ;
   - un rappel qu'il suffit de **scanner le QR code** du document, qui évite cette étape.
3. L'utilisateur précise → `POST { reference, etablissement }` (même référence, tel que saisie).
4. Réponse :
   - `VALIDE` / `ANNULE` → écrans habituels ;
   - `INTROUVABLE` → l'établissement saisi ne correspond pas à cette référence : écran « Introuvable » habituel ;
   - `AMBIGU` encore → nom trop vague (« CEG » seul, par exemple). Redemander un nom plus précis **ou** orienter vers le QR code. Ne pas boucler indéfiniment : après deux essais, ne proposer que le QR / le contact de l'établissement.

### Texte proposé (à valider avec le produit)

> **Plusieurs documents portent cette référence**
> Cette référence existe dans plusieurs établissements. Indiquez le nom de l'établissement émetteur, ou scannez le code QR figurant sur le document.

### Points d'attention

- L'état `AMBIGU` n'arrive **que** en saisie manuelle. Jamais avec `token`.
- La précision `etablissement` est comparée **sans accent ni casse**, mots partiels acceptés : « godomey » suffit à retrouver « CEG Godomey ».
- Un `etablissement` qui ne correspond à **aucun** des candidats renvoie `INTROUVABLE` (et non `AMBIGU`), pour ne pas confirmer l'existence du document à quelqu'un qui se trompe d'école.
- Le front ne reçoit **pas** la liste des établissements en conflit (ce serait une fuite) : pas de liste déroulante possible, uniquement un champ libre.

---

## 6. Parcours QR code

Le QR imprimé encode `<VERIFICATION_BASE_URL>/<jeton>` (ex. `https://scoly.app/verifier/AbCdEf…`).

1. Le front sert la route `/verifier/:token`.
2. Il lit `:token` et appelle `POST /verification` avec `{ "token": "…" }`.
3. Il affiche l'écran correspondant. **Pas de saisie, jamais d'`AMBIGU`.**

Recommandations :
- Une page sans lien sortant, ou avec `Referrer-Policy: no-referrer`, pour que le jeton ne fuite pas via l'en-tête Referer (les liens `tel:` et `mailto:` n'en envoient pas).
- Un jeton mal formé (coupé, caractère manquant) renvoie `INTROUVABLE`, comme un jeton inconnu : c'est voulu. Le texte de la maquette (« la référence est erronée, ou le code QR est endommagé ») couvre les deux cas.

---

## 7. Codes d'erreur

Enveloppe : `{ "statusCode": 400, "code": "CHAMP_VIDE", "message": ["…"], "erreurs": [{ "champ": "reference", "message": "…" }] }`.
`message` est un tableau de phrases lisibles par l'utilisateur ; `erreurs[].champ` indique le champ à surligner.

| HTTP | `code` | Quand | Que faire côté front |
|---|---|---|---|
| 400 | `CHAMP_VIDE` | Aucune référence ni jeton (ou que des espaces). | Afficher `message` sous le champ `reference`. |
| 400 | `FORMAT_INVALIDE` | Référence sans chiffre, trop longue ou avec caractères de contrôle ; `token` **et** `reference` ensemble ; `etablissement` inexploitable. | Afficher `message` sous le champ désigné par `erreurs[0].champ`. |
| 400 | `VALIDATION_ERROR` | Champ inconnu, valeur non textuelle, texte démesuré (> 2 000 caractères). | **Bug du front**, pas de l'utilisateur. Message générique + remontée d'erreur. |
| 400 | *(absent)* | Corps JSON illisible. | Idem : bug du front. |
| 429 | `TROP_DE_REQUETES` | Limite de débit dépassée, [§ 8](#8-limitation-de-débit). | Afficher `message`, désactiver « Vérifier » pendant `retryAfterSecondes` (aussi dans l'en-tête `Retry-After`). |
| 500 | `ERREUR_SERVEUR` | Panne côté serveur. | Afficher `message` et proposer de réessayer. Ne pas afficher « Introuvable » : ce serait faux. |

Une **erreur réseau** (pas de réponse) est aussi à gérer côté front, avec le même traitement que le 500.

Exemple 429 :
```json
{
  "statusCode": 429,
  "code": "TROP_DE_REQUETES",
  "message": "Trop de vérifications en peu de temps. Veuillez patienter avant de réessayer.",
  "retryAfterSecondes": 42
}
```

---

## 8. Limitation de débit

Par adresse IP (les IPv6 d'un même /64 comptent ensemble). La saisie manuelle est le canal à risque (les numéros sont séquentiels, donc devinables) : elle est bien plus restreinte que le QR.

| Canal | Par minute | Par heure |
|---|---|---|
| Saisie manuelle (`reference`) | 10 | 40 |
| QR code (`token`) | 30 | 200 |

En plus : au-delà de **15 références introuvables ou ambiguës en 10 minutes**, l'IP reçoit `429` (`retryAfterSecondes` = 600) jusqu'à ce que la fenêtre se vide.

Les deux canaux ont des compteurs **séparés** : un visiteur bloqué en saisie peut encore ouvrir un QR. Les seuils ne sont pas exposés dans les en-têtes de réponse.

---

## 9. Saisie tolérée (normalisation)

L'utilisateur n'a pas à recopier la référence à l'identique. Sont tolérés : la casse, les accents, les espaces, la ponctuation, les variantes du « N° » (`N°`, `n°`, `No`, `Nº`, `N˚`, `N.`, `№`, `Numéro`, ou son absence) et les zéros initiaux.

Tous ces exemples désignent le même document :

```
N°0042/2025-2026/CEG-GODOMEY
n° 42 / 2025-2026 / ceg godomey
No 42/2025-2026/CEG-GODOMEY
42/2025-2026/CEG-GODOMEY
```

**Le front n'a rien à normaliser** : envoyer la saisie brute (le serveur recoupe). Un simple `trim` est inutile aussi. En revanche, une référence ne contenant **aucun chiffre** est rejetée (`FORMAT_INVALIDE`) : toute référence Scoly en contient un.

---

## 10. Confidentialité : ce qui sort, ce qui ne sort jamais

Le public peut être n'importe qui, et les élèves sont souvent mineurs : l'API ne renvoie que le strict nécessaire pour qu'un vérificateur **recoupe avec le document qu'il a en main**.

| ✅ Exposé | ❌ Jamais exposé |
|---|---|
| Type de document | Motif d'annulation, auteur de l'annulation |
| Référence (celle déjà imprimée) | Date et lieu de naissance, sexe |
| Élève **masqué** : 1ᵉʳ prénom + initiale du nom | Matricule national, matricule EducMaster |
| Date d'établissement | Nom complet, autres prénoms, classe, parents |
| Statut (valide / annulé) et date d'annulation | Champs saisis du document (motif de transfert…) |
| Établissement : nom, commune/département, pays | Adresse précise de l'école, nom du signataire |
| Téléphone et e-mail **de l'école** (pas des personnes) | Identifiants internes (document, élève, utilisateur), jeton QR, lien du PDF |

Ces règles sont verrouillées par des tests : une valeur sensible semée dans les données de test ne doit apparaître dans aucune réponse.

Journal des vérifications : heure serveur, canal, résultat, **IP hachée** (HMAC avec un sel qui change chaque jour : non réversible, non corrélable d'un jour à l'autre). Ni la référence saisie, ni le jeton, ni l'IP en clair, ni le nom. Conservé 90 jours.

---

## 11. Garanties

- **Cohérence avec les Archives** : le statut est lu en base à chaque appel, sans cache. Un document annulé dans les Archives s'affiche « Annulé » dès la vérification suivante.
- **Lecture seule** : aucune écriture sur les documents ; seule trace, le journal anonymisé.
- **Pas d'énumération** : réponses de même forme pour `INTROUVABLE` et `AMBIGU`, jeton QR de 192 bits non devinable, jeton mal formé indiscernable d'un jeton inconnu, limitation de débit, ralentissement progressif sur échecs.
- **Aucune donnée sensible dans les logs** applicatifs (les erreurs ne journalisent que leur nom).
- **En-têtes de sécurité** sur la route (`X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`…), pas de `X-Powered-By`.

---

## 12. Correspondance avec la maquette

| Élément de la maquette | Source |
|---|---|
| Écran « Saisie », bouton « Vérifier » | `POST { reference }` |
| « Authenticité du document confirmée » | `resultat = VALIDE` |
| « Document annulé … le 30 septembre 2026 » | `resultat = ANNULE`, `document.dateAnnulation` |
| « Document introuvable » | `resultat = INTROUVABLE` (sans bloc de contact, [point 4](#0-️-à-lattention-de-léquipe-frontend--ce-qui-change)) |
| *(absent de la maquette)* | `resultat = AMBIGU` → [§ 5](#5-le-résultat-ambigu-pas-à-pas) |
| Type de document / Référence / Élève / Établi le | `document.typeDocument` / `.reference` / `.eleve` / `.dateEmission` |
| Statut (pastille Valide / Annulé) | `resultat` |
| Établissement / Localité / Pays | `etablissement.nom` / `.localite` / `.pays` |
| « Un doute sur ce document ? » / « Que faire ? » : téléphone, e-mail | `etablissement.telephone` / `.email` (masquer la ligne si `null`) |
| « Vérification effectuée le 5 octobre 2026 à 18:47 » | `verifieLe` formaté en `Africa/Porto-Novo` |
| « Vérifier un autre document » | Lien vers l'écran de saisie |
| Sélecteur « Maquette : Saisie / Valide / Annulé / Introuvable » | Outil de maquette, à retirer en production |
| Erreur technique | 429 / 500 / erreur réseau, [§ 7](#7-codes-derreur) |

---

## 13. Mise en production (pour l'équipe backend/ops)

Dans cet ordre :

1. `pnpm prisma migrate deploy` : ajoute `documents.reference_normalisee` et la table `journal_verifications`.
2. **`pnpm run verification:backfill`** : renseigne la colonne pour les documents déjà émis. Idempotent, relançable. Tant qu'il n'a pas tourné, la **saisie manuelle** ne retrouve pas les anciens documents (le **QR code**, lui, fonctionne déjà).
3. Variables d'environnement :

| Variable | Rôle | Obligatoire |
|---|---|---|
| `VERIFICATION_LOG_SECRET` | Secret (≥ 16 caractères) du hachage des IP. Distinct des secrets JWT. | **Oui en production** (l'API refuse de démarrer sans) |
| `TRUST_PROXY` | Nombre de proxys devant l'API (`1` sur Render, Railway, Nginx…). | **Oui en production** derrière un proxy. Sans lui, tous les visiteurs partagent l'IP du proxy donc le même quota. Jamais `true`. |
| `VERIFICATION_CORS_ORIGIN` | Origine(s) de la page de vérification (séparées par des virgules). | Non (défaut : `CORS_ORIGIN`) |
| `VERIFICATION_BASE_URL` | Préfixe de l'URL imprimée dans le QR. | Déjà en place |

**Limites connues** :
- Les compteurs de débit par minute/heure sont **en mémoire** (par instance). Le ralentissement progressif sur échecs, lui, est partagé car lu en base. Avec plusieurs instances, brancher un stockage Redis sur `ThrottlerModule` pour partager aussi les premiers.
- Si l'appel à l'API est fait **côté serveur** par le front (SSR) plutôt que depuis le navigateur, toutes les requêtes arriveront avec l'IP du serveur front : il faut alors transmettre l'IP réelle du visiteur. À signaler au backend avant d'implémenter.
