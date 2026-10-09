# API — Élèves

Gestion des élèves de l'établissement : liste avec recherche et pagination, ajout, fiche, modification, et import depuis un fichier Excel. Ce document décrit ce que le frontend doit appeler, envoyer et afficher pour l'écran **Élèves**.

**Sommaire**

1. [Vue d'ensemble](#1-vue-densemble)
2. [Conventions](#2-conventions)
3. [L'objet élève](#3-lobjet-élève)
4. [Lister — `GET /eleves`](#4-lister--get-eleves)
5. [Créer — `POST /eleves`](#5-créer--post-eleves)
6. [Fiche — `GET /eleves/:id`](#6-fiche--get-elevesid)
7. [Modifier — `PATCH /eleves/:id`](#7-modifier--patch-elevesid)
8. [Import Excel](#8-import-excel)
9. [Codes d'erreur](#9-codes-derreur)
10. [Exemples de code](#10-exemples-de-code)
11. [Points d'attention par rapport à la maquette](#11-points-dattention-par-rapport-à-la-maquette)

---

## 1. Vue d'ensemble

| Route | Rôle |
|---|---|
| `GET /eleves` | Liste paginée, avec recherche |
| `POST /eleves` | Ajouter un élève |
| `GET /eleves/:id` | Fiche d'un élève, avec ses documents établis |
| `PATCH /eleves/:id` | Modifier un élève (mise à jour partielle) |
| `GET /eleves/import/modele` | Télécharger le modèle Excel d'import |
| `POST /eleves/import` | Importer des élèves depuis un fichier Excel |

Il n'y a **pas de suppression** d'élève : aucune route `DELETE`.

---

## 2. Conventions

- **Authentification** : toutes les routes exigent `Authorization: Bearer <accessToken>` (sinon `401`).
- **Droits** : le Directeur et les Membres ont exactement les mêmes droits sur ces routes.
- **Cloisonnement** : les élèves sont toujours ceux de l'établissement du compte connecté. Un élève d'un autre établissement répond `404`, comme s'il n'existait pas.
- **Formats** : identifiants au format UUID ; dates `AAAA-MM-JJ` (sans heure ni fuseau).
- **Format d'erreur** : `{ "statusCode", "message", "code"? }`.

### Erreurs de validation (`400`, `code: "VALIDATION_ERROR"`)

La réponse indique **quel champ** est en erreur :

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["Le nom est obligatoire.", "Numéro de téléphone invalide (10 chiffres, ou format international commençant par +)."],
  "erreurs": [
    { "champ": "nom", "message": "Le nom est obligatoire." },
    { "champ": "telephone", "message": "Numéro de téléphone invalide (10 chiffres, ou format international commençant par +)." }
  ]
}
```

- **`erreurs`** : affichez chaque `message` sous le champ désigné par `champ`. Un seul message par champ.
- **`champ`** : nom de la propriété du corps (`matricule`, `matriculeEducMaster`, `nom`, `prenoms`, `sexe`, `dateNaissance`, `lieuNaissance`, `parentTuteur`, `telephone`, `adresse`, `classe`, `dateInscription`, `confirmerDoublon`) ou du paramètre d'URL (`search`, `statut`, `page`, `limit`).
- **`message`** (tableau de phrases) : même contenu, conservé pour un éventuel bandeau global.
- Un champ que le contrat ne prévoit pas (ex. `statut`, `etablissementId`) est refusé : `champ: "statut"`, message « Le champ « statut » n'est pas autorisé. ».
- Ce format s'applique à toute l'API, pas seulement aux élèves.
- Les erreurs `409` n'ont pas de `champ` : utilisez leur `code` (voir [9](#9-codes-derreur)).
- Les erreurs de l'import Excel sont **par ligne** : voir [8](#8-import-excel).

---

## 3. L'objet élève

```json
{
  "id": "3f6c2c58-1b0e-4a8a-8b77-4d6c5b0f9a10",
  "matricule": "CEG-0007",
  "matriculeEducMaster": "EM-7300322",
  "nom": "ADJAHO",
  "prenoms": "Nadège",
  "sexe": "FEMININ",
  "dateNaissance": "2014-07-15",
  "lieuNaissance": "Cotonou",
  "parentTuteur": "M. Basile Hounkpatin",
  "telephone": "+2290197164676",
  "adresse": "Quartier Togoudo, Abomey-Calavi",
  "classe": "CE1",
  "dateInscription": "2023-06-22",
  "statut": "ACTIF",
  "createdAt": "2026-09-29T10:00:00.000Z",
  "updatedAt": "2026-09-29T10:00:00.000Z"
}
```

| Champ | Description |
|---|---|
| `matricule`, `matriculeEducMaster` | Texte libre saisi par l'utilisateur. `null` si non renseigné. Pas de préfixe ajouté par l'API (`CEG-`, `EM-` sont ceux qui ont été saisis). |
| `nom`, `prenoms` | Renvoyés tels que saisis. La mise en majuscules du nom de famille (« **ADJAHO** Nadège ») se fait à l'affichage, côté front. |
| `sexe` | `MASCULIN` ou `FEMININ`. Libellés d'affichage : « Masculin », « Féminin ». |
| `dateNaissance` | `AAAA-MM-JJ`. À formater pour l'affichage (« 15 juil. 2014 »). |
| `telephone` | Stocké au format international compact : `+229` suivi de 10 chiffres. À formater pour l'affichage (`+229 01 97 16 46 76`). |
| `adresse` | `null` si non renseignée. |
| `classe` | Texte libre (`CE1`, `3ème A`…). `null` tant qu'elle n'a pas été renseignée. |
| `dateInscription` | `AAAA-MM-JJ`. `null` tant qu'elle n'a pas été renseignée. |
| `statut` | Vaut toujours `ACTIF` (seul statut existant). Le badge « Inscrit » de la maquette correspond à `ACTIF`. |

**`classe` et `dateInscription` sont vides par défaut.** Elles se remplissent de trois façons : dans la fiche élève (formulaire d'ajout ou de modification), à l'import Excel, ou **automatiquement** à la première génération d'un document qui en a besoin (ex. certificat de scolarité) : la valeur saisie à ce moment est mémorisée sur l'élève. Voir `API_DOCUMENTS.md`.

---

## 4. Lister — `GET /eleves`

| Paramètre | Description |
|---|---|
| `search` | Facultatif. Recherche **insensible à la casse et aux accents** dans le nom, les prénoms, les deux matricules et la **classe**. |
| `statut` | Facultatif. `ACTIF` (seule valeur existante). |
| `page` | Facultatif. Défaut `1`. |
| `limit` | Facultatif. Défaut `10`, maximum `100`. |

**Comportement de la recherche**

- « nadege » trouve « Nadège » ; « ADJAHO » et « adjaho » sont équivalents.
- Plusieurs mots : **chacun** doit correspondre, dans n'importe quel ordre (« adjaho nad » trouve ADJAHO Nadège).
- Correspondance partielle : « nad » suffit.
- Les tirets, apostrophes et points valent un espace : « jean pierre » trouve « Jean-Pierre » ; « ceg 0007 » trouve « CEG-0007 ».
- Une saisie ne contenant que des séparateurs est ignorée (liste complète).
- La classe est cherchable : « ce1 » trouve les élèves de CE1.

**Tri** : par nom, puis prénoms (ordre alphabétique).

**Réponse 200**

```json
{
  "data": [ { "...objet élève..." } ],
  "meta": { "total": 30, "page": 1, "limit": 10, "totalPages": 3 }
}
```

Chaque élément de `data` est l'objet élève complet (le formulaire de modification n'a donc pas besoin d'un appel supplémentaire).

Pour afficher « 1–10 sur 30 » : début = `(page - 1) * limit + 1`, fin = `min(page * limit, total)`. Aucun élève : `data: []` et `total: 0` (état « aucun élève »). Bouton « Précédent » inactif si `page === 1`, « Suivant » inactif si `page >= totalPages`.

---

## 5. Créer — `POST /eleves`

**Corps (JSON)**

```json
{
  "matricule": "CEG-0031",
  "matriculeEducMaster": "EM-7300100",
  "nom": "Adjaho",
  "prenoms": "Nadège",
  "sexe": "FEMININ",
  "dateNaissance": "2014-07-15",
  "lieuNaissance": "Cotonou",
  "parentTuteur": "M. Basile Hounkpatin",
  "telephone": "01 97 16 46 76",
  "adresse": "Quartier Togoudo",
  "classe": "CE1",
  "dateInscription": "2023-06-22"
}
```

### Règles par champ

| Champ | Obligatoire | Règles |
|---|---|---|
| `nom` | Oui | 100 caractères max. |
| `prenoms` | Oui | 150 caractères max. |
| `sexe` | Oui | `MASCULIN` ou `FEMININ`. |
| `dateNaissance` | Oui | `AAAA-MM-JJ` (valeur d'un `<input type="date">`). Date réelle, pas dans le futur, âge entre 2 et 30 ans. |
| `lieuNaissance` | Oui | 100 caractères max. |
| `parentTuteur` | Oui | 150 caractères max. |
| `telephone` | Oui | Voir ci-dessous. |
| `matricule` | Non | Texte libre, 50 caractères max. **Unique dans l'établissement** (casse ignorée). |
| `matriculeEducMaster` | Non | Texte libre, 50 caractères max. **Unique dans l'établissement** (casse ignorée). |
| `adresse` | Non | 255 caractères max. |
| `classe` | Non | Texte libre, 30 caractères max. |
| `dateInscription` | Non | `AAAA-MM-JJ`. Date réelle, pas dans le futur, **postérieure à la date de naissance**. |
| `confirmerDoublon` | Non | Booléen. Voir « Doublons » ci-dessous. |

- Les espaces en début et fin de saisie sont retirés.
- Pour un champ facultatif, **absent, `null` ou chaîne vide** signifient tous « pas de valeur ». C'est important pour les matricules : deux élèves sans matricule ne sont pas considérés comme des doublons.
- Tout champ non listé est refusé en `400`.

### Téléphone

L'API accepte et **normalise** plusieurs saisies : `01 97 16 46 76`, `0197164676`, `+229 01 97 16 46 76`, `00229 0197164676`, ou un numéro international (`+33 6 12 34 56 78`). Le résultat est renvoyé au format `+2290197164676`.

Un numéro local de 8 chiffres, ou tout autre format, est refusé : « Numéro de téléphone invalide (10 chiffres, ou format international commençant par +). ». Le front peut laisser l'utilisateur saisir librement ; il n'a pas à normaliser.

### Messages de validation fréquents

| `champ` | `message` |
|---|---|
| `nom` | Le nom est obligatoire. |
| `prenoms` | Les prénoms sont obligatoires. |
| `sexe` | Le sexe est obligatoire (Masculin ou Féminin). |
| `dateNaissance` | La date de naissance est invalide (format attendu : AAAA-MM-JJ). |
| `dateNaissance` | La date de naissance ne peut pas être dans le futur. |
| `dateNaissance` | L'âge de l'élève doit être compris entre 2 et 30 ans. |
| `lieuNaissance` | Le lieu de naissance est obligatoire. |
| `parentTuteur` | Le parent ou tuteur est obligatoire. |
| `telephone` | Le téléphone est obligatoire. / Numéro de téléphone invalide (…). |
| `dateInscription` | La date d'inscription ne peut pas être dans le futur. |
| `dateInscription` | La date d'inscription doit être postérieure à la date de naissance. |
| (tout champ texte) | `<Libellé> ne doit pas dépasser N caractères.` |

**Réponse 201** : l'objet élève créé. Le `statut` est `ACTIF` (non modifiable à la création).

### Conflits (`409`)

| `code` | Cas | Conduite côté front |
|---|---|---|
| `MATRICULE_DEJA_UTILISE` | Ce matricule appartient déjà à un autre élève. | Message sous le champ **Matricule**. |
| `MATRICULE_EDUCMASTER_DEJA_UTILISE` | Idem pour le matricule EducMaster. | Message sous le champ **Matricule EducMaster**. |
| `ELEVE_DOUBLON_POSSIBLE` | Même nom + prénoms + date de naissance qu'un élève existant. | Demander confirmation (voir ci-dessous). |

### Doublons

Si l'API détecte un homonyme exact (même nom, mêmes prénoms, même date de naissance, casse ignorée), elle répond `409 ELEVE_DOUBLON_POSSIBLE` **sans rien créer**. Cela peut être un vrai doublon ou deux élèves distincts. Le front affiche une confirmation (« Un élève avec ce nom et cette date de naissance existe déjà. Créer quand même ? »). Si l'utilisateur confirme, **renvoyez la même requête avec `"confirmerDoublon": true`**. `confirmerDoublon` n'est jamais enregistré.

---

## 6. Fiche — `GET /eleves/:id`

**Réponse 200** : l'objet élève, plus ses documents établis (du plus récent au plus ancien ; `[]` si aucun).

```json
{
  "id": "3f6c2c58-1b0e-4a8a-8b77-4d6c5b0f9a10",
  "nom": "ADJAHO",
  "prenoms": "Nadège",
  "...": "...",
  "documents": [
    {
      "id": "b7f3a2e0-1c4d-4e8a-9a55-2f6d1f0c9e21",
      "numeroUnique": "N°12/2025-2026/CEG-GODOMEY",
      "statut": "ACTIF",
      "createdAt": "2026-09-29T10:00:00.000Z",
      "typeDocument": { "code": "CERTIFICAT_SCOLARITE", "nom": "Certificat de scolarité" }
    }
  ]
}
```

- `documents[].createdAt` : date d'établissement (« 29 sept. 2026 » dans la maquette). `typeDocument.nom` : libellé à afficher.
- Pour re-télécharger un document de cette liste : `GET /documents/:id/telechargement` (voir `API_DOCUMENTS.md`).
- `404` si l'élève n'existe pas, appartient à un autre établissement, ou si `:id` n'est pas un UUID.

---

## 7. Modifier — `PATCH /eleves/:id`

Mise à jour **partielle** : n'envoyez que les champs modifiés. Mêmes règles de validation que la création.

```json
{ "lieuNaissance": "Ouidah", "adresse": null, "classe": "CE2" }
```

- **Champs obligatoires** : ils ne peuvent pas être vidés (`null` ou `""` → `400`).
- **Champs facultatifs** (`matricule`, `matriculeEducMaster`, `adresse`, `classe`, `dateInscription`) : envoyer `null` ou `""` les **efface**. Un champ absent reste inchangé.
- **Matricules** : même contrôle d'unicité que la création, mais l'élève modifié est exclu du contrôle. Renvoyer son propre matricule est sans effet.
- **Doublon** : `ELEVE_DOUBLON_POSSIBLE` n'est contrôlé que si `nom`, `prenoms` ou `dateNaissance` sont envoyés ; `confirmerDoublon: true` fonctionne comme à la création.
- **Date d'inscription** : elle doit rester postérieure à la date de naissance **même si un seul des deux est modifié**. Sinon, `400` avec `champ: "dateInscription"`.
- Le `statut` n'est pas modifiable.

**Réponse 200** : l'objet élève à jour.

---

## 8. Import Excel

### 8.1 Modèle — `GET /eleves/import/modele`

Renvoie le fichier `modele-import-eleves.xlsx` (`Content-Disposition: attachment`) :

- une feuille **« Élèves »** : les en-têtes uniquement, avec les colonnes de téléphone et de matricule au format texte et une liste déroulante pour le sexe ;
- une feuille **« Instructions »** : la marche à suivre et un exemple de ligne.

**Colonnes** (les astérisques marquent les colonnes obligatoires) :

| Colonne | Obligatoire |
|---|---|
| Matricule | Non |
| Matricule EducMaster | Non |
| Nom * | Oui |
| Prénoms * | Oui |
| Sexe * | Oui |
| Date de naissance * | Oui |
| Lieu de naissance * | Oui |
| Parent ou tuteur * | Oui |
| Téléphone * | Oui |
| Adresse | Non |
| Classe | Non |
| Date d'inscription | Non |

> ⚠️ Le texte de la fenêtre d'import de la maquette doit être mis à jour : **Excel (.xlsx) uniquement** (plus de mention du CSV), et la liste des colonnes doit inclure **Adresse**, **Classe** et **Date d'inscription**.

Téléchargement depuis le front : appelez la route avec le header `Authorization` (un simple `<a href>` ne l'envoie pas), puis déclenchez le téléchargement à partir du `blob` (voir [10](#10-exemples-de-code)).

### 8.2 Importer — `POST /eleves/import`

**Requête** : `multipart/form-data`, champ **`fichier`**. Ne fixez pas vous-même l'en-tête `Content-Type` (le navigateur ajoute la bonne valeur, avec sa frontière).

Limites : fichier `.xlsx` uniquement, **2 Mo** maximum, **500 élèves** maximum par fichier.

L'import est **tout ou rien** : si une seule ligne est invalide, **aucun élève n'est créé** et toutes les erreurs sont renvoyées en une fois, pour que l'utilisateur corrige le fichier en une seule passe.

**Ce que l'API accepte dans le fichier**

- Les mêmes règles par ligne que la création (champs obligatoires, dates, téléphone, longueurs).
- La feuille « Élèves » est lue (à défaut, la première feuille). L'en-tête est la ligne 1.
- Les intitulés de colonnes sont reconnus sans tenir compte de la casse, des accents ni de l'astérisque (« Prénoms * », « prenoms » et « PRÉNOMS » sont équivalents).
- Les dates : cellule de type date, ou texte `JJ/MM/AAAA`.
- Le sexe : `Masculin` / `Féminin`, ou `M` / `F`.
- Les lignes entièrement vides sont ignorées.
- Un matricule déjà utilisé, une répétition dans le fichier, ou un homonyme (même nom, mêmes prénoms, même date de naissance, déjà en base ou ailleurs dans le fichier) est une erreur de la ligne concernée. **Il n'y a pas de confirmation de doublon à l'import** : l'utilisateur doit corriger ou retirer la ligne.

**Réponse 201**

```json
{ "importes": 28 }
```

Rafraîchissez ensuite la liste des élèves.

**Erreur `400` `IMPORT_INVALIDE`** : toutes les erreurs, avec le **numéro de ligne Excel** (l'en-tête est la ligne 1) :

```json
{
  "statusCode": 400,
  "code": "IMPORT_INVALIDE",
  "message": "Le fichier contient des erreurs sur 2 ligne(s). Aucun élève n'a été importé.",
  "erreurs": [
    { "ligne": 3, "messages": ["Numéro de téléphone invalide (10 chiffres, ou format international commençant par +)."] },
    { "ligne": 7, "messages": ["Ce matricule est déjà attribué à un autre élève."] }
  ]
}
```

> ⚠️ Ici `erreurs` a une **forme différente** de celle des erreurs de validation : `{ ligne, messages[] }` au lieu de `{ champ, message }`. Distinguez-les par le `code` (`IMPORT_INVALIDE` ou `VALIDATION_ERROR`). Affichez par exemple un tableau « Ligne 3 : … » dans la fenêtre d'import.

**Autres erreurs** (affichez `message`) :

| Statut | `code` | Cas |
|---|---|---|
| 400 | `FICHIER_INVALIDE` | Pas de fichier, extension différente de `.xlsx`, fichier corrompu. |
| 400 | `COLONNES_MANQUANTES` | Une colonne obligatoire est absente de l'en-tête (le message les nomme). |
| 400 | `FICHIER_VIDE` | Aucune ligne de données sous l'en-tête. |
| 400 | `TROP_DE_LIGNES` | Plus de 500 lignes. |
| 409 | `IMPORT_CONFLIT` | Un matricule a été pris par un autre utilisateur pendant l'import. Aucun élève n'a été importé ; réessayer. |
| 413 | — | Fichier de plus de 2 Mo. Vérifiez la taille côté client avant l'envoi. |

---

## 9. Codes d'erreur

| Statut | `code` | Route | Que faire côté front |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Créer, modifier, lister | Afficher chaque `erreurs[].message` sous `erreurs[].champ`. |
| 400 | `IMPORT_INVALIDE` | Import | Afficher la liste par ligne (`erreurs[].ligne`, `erreurs[].messages`). |
| 400 | `FICHIER_INVALIDE`, `COLONNES_MANQUANTES`, `FICHIER_VIDE`, `TROP_DE_LIGNES` | Import | Afficher `message`. |
| 401 | — | Toutes | Rafraîchir le jeton ou rediriger vers la connexion. |
| 404 | — | Fiche, modifier | « Élève introuvable. » Revenir à la liste et la rafraîchir. |
| 409 | `MATRICULE_DEJA_UTILISE` | Créer, modifier | Message sous le champ Matricule. |
| 409 | `MATRICULE_EDUCMASTER_DEJA_UTILISE` | Créer, modifier | Message sous le champ Matricule EducMaster. |
| 409 | `ELEVE_DOUBLON_POSSIBLE` | Créer, modifier | Demander confirmation, puis renvoyer avec `confirmerDoublon: true`. |
| 409 | `IMPORT_CONFLIT` | Import | Proposer de réessayer. |
| 413 | — | Import | Fichier trop volumineux. |

---

## 10. Exemples de code

### Lister avec recherche et pagination

```ts
async function listerEleves({ search, page = 1, limit = 10 }: Params) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search?.trim()) q.set('search', search.trim());

  const res = await fetch(`${API}/eleves?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await res.json();
  return res.json() as Promise<{ data: Eleve[]; meta: Meta }>;
}
// Recherche : attendre ~300 ms après la dernière frappe (debounce), puis repartir à la page 1.
```

### Créer, avec confirmation de doublon

```ts
async function creerEleve(body: CreerEleveBody, confirmerDoublon = false) {
  const res = await fetch(`${API}/eleves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(confirmerDoublon ? { ...body, confirmerDoublon: true } : body),
  });
  const data = await res.json();

  if (res.ok) return data;                                   // 201 → objet élève

  if (data.code === 'ELEVE_DOUBLON_POSSIBLE') {
    if (await demanderConfirmation(data.message)) return creerEleve(body, true);
    return null;                                             // l'utilisateur renonce
  }
  throw data;                                                // VALIDATION_ERROR, 409 matricule…
}
```

### Afficher les erreurs sous les champs

```ts
function afficherErreurs(e: ApiError) {
  if (e.code === 'VALIDATION_ERROR') {
    e.erreurs.forEach(({ champ, message }) => marquerChamp(champ, message));
  } else if (e.code === 'MATRICULE_DEJA_UTILISE') {
    marquerChamp('matricule', e.message);
  } else if (e.code === 'MATRICULE_EDUCMASTER_DEJA_UTILISE') {
    marquerChamp('matriculeEducMaster', e.message);
  } else {
    afficherBandeau(e.message ?? 'Une erreur est survenue. Réessayez.');
  }
}
```

### Modifier : n'envoyer que ce qui a changé

```ts
const modifications = Object.fromEntries(
  Object.entries(valeurs).filter(([cle, v]) => v !== eleveInitial[cle]),
);
// Un champ facultatif vidé par l'utilisateur doit partir en null (ou "") pour être effacé.
await fetch(`${API}/eleves/${id}`, { method: 'PATCH', headers, body: JSON.stringify(modifications) });
```

### Télécharger le modèle Excel

```ts
const res = await fetch(`${API}/eleves/import/modele`, { headers: { Authorization: `Bearer ${token}` } });
const url = URL.createObjectURL(await res.blob());
const a = Object.assign(document.createElement('a'), { href: url, download: 'modele-import-eleves.xlsx' });
a.click();
URL.revokeObjectURL(url);
```

### Importer un fichier

```ts
async function importer(fichier: File) {
  if (fichier.size > 2 * 1024 * 1024) throw new Error('Le fichier dépasse 2 Mo.');

  const form = new FormData();
  form.append('fichier', fichier);                 // nom du champ imposé : « fichier »

  const res = await fetch(`${API}/eleves/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // pas de Content-Type : le navigateur le gère
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw data;                         // IMPORT_INVALIDE → data.erreurs = [{ ligne, messages }]
  return data.importes;                            // nombre d'élèves créés
}
```

---

## 11. Points d'attention par rapport à la maquette

- **Formulaire d'ajout et de modification** : ajoutez les champs **Classe** (texte, facultatif) et **Date d'inscription** (date, facultatif) après l'adresse. Ils sont vides par défaut.
- **Matricules** : le texte grisé `0031` et `7300100` du formulaire d'ajout n'est qu'un exemple. L'API ne génère aucun matricule ; ce sont deux champs texte libres.
- **Liste** : `data[]` contient déjà tous les champs ; la colonne « Statut » affiche « Inscrit » pour `ACTIF`. Le nom de famille est mis en majuscules à l'affichage.
- **Fiche élève** : la section « Documents établis » se nourrit de `documents[]` (nom du type et date `createdAt`). Le bouton « Établir un document » ouvre le parcours de l'écran Documents avec cet élève.
- **Fenêtre d'import** : retirez la mention « ou CSV » et complétez la liste des colonnes (Adresse, Classe, Date d'inscription). Prévoyez l'affichage des erreurs par ligne.
- **Recherche** : elle ignore désormais les accents et porte aussi sur la classe, comme le champ « Rechercher un élève ou un matricule » de la maquette le laisse attendre.
- **Pas de suppression** : l'action « Supprimer » ne doit pas figurer dans le menu `···` d'une ligne.
