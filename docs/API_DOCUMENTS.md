# API — Documents

Génération des documents administratifs de l'établissement (certificat de scolarité aujourd'hui). Ce document décrit ce que le frontend doit appeler, envoyer et afficher pour l'écran **Documents** : choix du type, choix de l'élève, formulaire, aperçu, génération et téléchargement.

**Sommaire**

1. [Vue d'ensemble](#1-vue-densemble)
2. [Conventions](#2-conventions)
3. [Parcours de l'écran, étape par étape](#3-parcours-de-lécran-étape-par-étape)
4. [Lister les types — `GET /types-documents`](#4-lister-les-types--get-types-documents)
5. [Aperçu — `POST /documents/apercu`](#5-aperçu--post-documentsapercu)
6. [Générer — `POST /documents`](#6-générer--post-documents)
7. [Re-télécharger — `GET /documents/:id/telechargement`](#7-re-télécharger--get-documentsidtelechargement)
8. [Le certificat de scolarité](#8-le-certificat-de-scolarité)
9. [Prérequis dans les Paramètres](#9-prérequis-dans-les-paramètres)
10. [Codes d'erreur](#10-codes-derreur)
11. [Exemples de code](#11-exemples-de-code)
12. [Ce qui n'est pas encore disponible](#12-ce-qui-nest-pas-encore-disponible)
13. [Points d'attention par rapport à la maquette](#13-points-dattention-par-rapport-à-la-maquette)

---

## 1. Vue d'ensemble

| Route | Rôle | Effet en base |
|---|---|---|
| `GET /types-documents` | Cartes de l'écran + description des champs de chaque type | Aucun |
| `POST /documents/apercu` | Renvoie le **vrai PDF** filigrané « APERÇU » | **Aucun** (pas de numéro consommé) |
| `POST /documents` | Génère le document : numéro, PDF, enregistrement | Crée le document, met à jour la fiche élève |
| `GET /documents/:id/telechargement` | Nouvelle URL signée pour re-télécharger le PDF | Journalise le téléchargement ; **refusé (409) si le document est annulé** |

Principe à retenir : **l'aperçu et le document final sont produits par le même moteur**. Ce que l'utilisateur voit dans la modale est exactement ce qu'il téléchargera, aux différences près listées en [5](#5-aperçu--post-documentsapercu).

---

## 2. Conventions

- **Authentification** : toutes les routes exigent `Authorization: Bearer <accessToken>` (sinon `401`).
- **Droits** : Directeur et Membre ont les mêmes droits sur ces routes.
- **Cloisonnement** : tout est limité à l'établissement du compte connecté. Un élève ou un document d'un autre établissement répond `404`, comme s'il n'existait pas.
- **Formats** : dates `AAAA-MM-JJ` (sans heure ni fuseau) ; identifiants au format UUID.
- **Format d'erreur** : `{ "statusCode", "message", "code"? }`. Pour les erreurs de validation, la réponse contient en plus un tableau `erreurs` :

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["Classe est obligatoire."],
  "erreurs": [
    { "champ": "champsSaisis.classe", "message": "Classe est obligatoire." }
  ]
}
```

  - Affichez chaque `message` sous le champ désigné par `champ`. Un seul message par champ.
  - Pour cette API, les champs saisis sont nommés **`champsSaisis.<cle>`** (ex. `champsSaisis.classe`) ; `<cle>` est la clé du champ dans `GET /types-documents`.
  - `message` (tableau de phrases) est conservé pour un éventuel bandeau global.
  - Les erreurs `409` n'ont pas de `champ` : utilisez leur `code` (voir [10](#10-codes-derreur)).

---

## 3. Parcours de l'écran, étape par étape

| # | Action de l'utilisateur | Appel |
|---|---|---|
| 1 | Arrive sur **Documents** | `GET /types-documents` → affiche les cartes, filtrées par `categorie` |
| 2 | Clique sur « Établir » d'une carte | — (le type est déjà chargé) |
| 3 | **Étape 1** — cherche un élève | `GET /eleves?search=…&limit=8` |
| 4 | Choisit l'élève, clique « Continuer » | `GET /eleves/:id` pour pré-remplir `classe` et `dateInscription` |
| 5 | **Étape 2** — remplit le formulaire | Formulaire construit à partir de `champs` |
| 6 | Clique « Voir l'aperçu » | `POST /documents/apercu` → PDF affiché dans la modale |
| 7 | Clique « Télécharger le PDF » | `POST /documents` (avec `Idempotency-Key`) → ouvre `urlTelechargement` (le PDF est enregistré directement) |
| 8 | Plus tard, veut re-télécharger | `GET /documents/:id/telechargement` |

**À l'ouverture de l'étape 2, générez un UUID** (`crypto.randomUUID()`) et gardez-le pour toute la durée du formulaire : c'est l'`Idempotency-Key` de l'étape 7 (voir [6](#6-générer--post-documents)). Si l'utilisateur change d'élève ou de type, ou après une génération réussie, générez-en un nouveau.

La recherche d'élève (`GET /eleves?search=`) ignore la casse et les accents, et porte sur le nom, les prénoms, les deux matricules et la **classe**. Voir `API_ELEVES.md`.

---

## 4. Lister les types — `GET /types-documents`

**Réponse 200** (triée dans l'ordre d'affichage)

```json
[
  {
    "id": "5b0e6b0e-8f1e-4d57-9d5e-0b8d8a7f1c11",
    "code": "CERTIFICAT_SCOLARITE",
    "nom": "Certificat de scolarité",
    "description": "Atteste qu'un élève est régulièrement inscrit dans l'établissement.",
    "categorie": "SCOLARITE",
    "disponible": true,
    "champs": [
      { "cle": "classe", "libelle": "Classe", "type": "text", "obligatoire": true,
        "maxLength": 30, "placeholder": "Ex. CE1, 3ème A", "eleveChamp": "classe" },
      { "cle": "dateInscription", "libelle": "Date d'inscription", "type": "date", "obligatoire": true,
        "eleveChamp": "dateInscription" },
      { "cle": "assiduite", "libelle": "Assiduité", "type": "select", "obligatoire": true,
        "options": ["Excellente", "Bonne", "Moyenne", "Insuffisante"] },
      { "cle": "conduite", "libelle": "Conduite", "type": "select", "obligatoire": true,
        "options": ["Excellente", "Bonne", "Moyenne", "Insuffisante"] },
      { "cle": "travail", "libelle": "Travail", "type": "select", "obligatoire": true,
        "options": ["Excellent", "Satisfaisant", "Moyen", "Insuffisant"] },
      { "cle": "observations", "libelle": "Observations particulières / Décision", "type": "textarea",
        "obligatoire": false, "maxLength": 300, "placeholder": "Ex. Passe en classe supérieure" }
    ]
  },
  {
    "id": "…",
    "code": "FICHE_ELEVE",
    "nom": "Fiche élève",
    "description": "Regroupe l'identité et le parcours scolaire de l'élève.",
    "categorie": "SCOLARITE",
    "disponible": false,
    "champs": []
  }
]
```

### Champs de la réponse

| Champ | Description |
|---|---|
| `id` | À envoyer comme `typeDocumentId` à l'aperçu et à la génération. |
| `code` | Identifiant stable (`CERTIFICAT_SCOLARITE`, `ATTESTATION_INSCRIPTION`, `FICHE_ELEVE`, `ATTESTATION_TRANSFERT`, `DEMANDE_TRANSFERT`). À utiliser pour choisir l'icône de la carte. |
| `categorie` | `SCOLARITE` ou `TRANSFERTS_DEPARTS` : pastilles de filtre « Scolarité » et « Transferts et départs ». |
| `disponible` | `false` → carte « Bientôt disponible », bouton « Établir » désactivé. L'API refuse la génération (`409 TYPE_DOCUMENT_INDISPONIBLE`). |
| `champs` | Description du formulaire de l'étape 2. Vide si le type n'est pas disponible. |

### Description d'un champ (`champs[]`)

| Propriété | Description |
|---|---|
| `cle` | Clé à utiliser dans `champsSaisis`. |
| `libelle` | Libellé à afficher. |
| `type` | `text` (champ simple), `textarea` (multi-lignes), `select` (liste déroulante), `date` (`<input type="date">`, valeur `AAAA-MM-JJ`). |
| `obligatoire` | Affichez l'astérisque / « (facultatif) » en conséquence. |
| `options` | Pour `select` : liste **exacte** des valeurs acceptées. Envoyez la valeur telle quelle, avec la même casse. |
| `maxLength` | Longueur maximale (compteur de caractères conseillé). |
| `placeholder` | Texte d'exemple. |
| `eleveChamp` | Présent si le champ existe aussi sur la fiche élève (`classe`, `dateInscription`). Voir ci-dessous. |

> **Ne recopiez pas les listes dans le frontend.** Les options viennent de l'API pour que le front et le back restent d'accord. Les valeurs « Bonne / Bonne / Satisfaisant » pré-sélectionnées dans la maquette sont valides ; c'est un choix d'interface, l'API n'a pas de valeur par défaut.

### Champs liés à l'élève (`eleveChamp`)

Pour `classe` et `dateInscription` :

1. **Pré-remplissez** le champ avec la valeur de l'élève (`GET /eleves/:id` → `classe`, `dateInscription`). Elles sont `null` tant qu'elles n'ont jamais été renseignées : le champ reste alors vide.
2. L'utilisateur peut les modifier.
3. À la génération, **si la valeur envoyée diffère de la fiche, la fiche élève est mise à jour automatiquement** (l'utilisateur ne la ressaisit plus la fois suivante). L'aperçu, lui, ne modifie jamais l'élève.

Après une génération réussie, pensez à rafraîchir les données de l'élève et la liste des élèves (la classe y apparaît et sert à la recherche).

---

## 5. Aperçu — `POST /documents/apercu`

Renvoie le **vrai PDF**, avec le même modèle que le document final.

**Corps (JSON)**

```json
{
  "eleveId": "uuid",
  "typeDocumentId": "uuid",
  "champsSaisis": {
    "classe": "CE1",
    "dateInscription": "2023-06-22",
    "assiduite": "Bonne",
    "conduite": "Bonne",
    "travail": "Satisfaisant",
    "observations": "Passe en classe supérieure"
  }
}
```

| Champ | Règle |
|---|---|
| `eleveId` | UUID d'un élève de l'établissement. |
| `typeDocumentId` | UUID d'un type `disponible`. |
| `champsSaisis` | Objet dont les clés sont celles de `champs`. Voir les règles en [8](#8-le-certificat-de-scolarité). |

**Réponse 200** : le fichier PDF (`Content-Type: application/pdf`, `Content-Disposition: inline`, `Cache-Control: no-store`).

### Différences avec le document final

- Un filigrane rouge pâle **« APERÇU »** en diagonale.
- Le numéro de référence est incomplet (`N°…/2025-2026` : le numéro n'est attribué qu'à la génération).
- À la place du QR code, un cadre en pointillés.
- Une mention en pied de page : « APERÇU — ce document n'a aucune valeur ».

L'aperçu est renvoyé **en flux direct** (il n'y a pas de lien signé) : le téléchargement forcé ne concerne que `POST /documents` et `GET /documents/:id/telechargement`.

### Garanties

- **Aucun effet de bord** : pas de numéro consommé, aucun document enregistré, fiche élève inchangée.
- Même validation que la génération : si l'aperçu réussit, la génération réussira (hors panne ou collision de numéro, très rare).

### Afficher le PDF

L'appel exige le header `Authorization`, donc un simple `<iframe src="…">` ne fonctionne pas. Récupérez le PDF avec `fetch`, transformez-le en `blob`, puis affichez-le :

```ts
const res = await fetch(`${API}/documents/apercu`, { method: 'POST', headers, body });
const blob = await res.blob();
const url = URL.createObjectURL(blob);   // à affecter à <iframe src> ou <object data>
// À la fermeture de la modale :
URL.revokeObjectURL(url);
```

Si `res.ok` est faux, la réponse est du JSON (erreur) et non un PDF : lisez `await res.json()` au lieu de `blob()` (voir [11](#11-exemples-de-code)).

---

## 6. Générer — `POST /documents`

Même corps que l'aperçu.

### En-tête `Idempotency-Key` (recommandé)

```
Idempotency-Key: 3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f
```

UUID généré **une fois à l'ouverture de l'étape 2** et renvoyé tel quel à chaque tentative pour ce formulaire. Il garantit qu'un **double-clic**, ou un nouvel essai après une coupure réseau, ne crée **pas deux documents** et ne consomme **pas deux numéros** : l'API renvoie alors le document déjà créé (même `id`, même `numeroUnique`).

- Une valeur qui n'est pas un UUID → `400` (`code: IDEMPOTENCY_KEY_INVALIDE`).
- Sans cet en-tête, tout fonctionne mais la protection contre les doublons disparaît.
- **La clé identifie une intention, pas un contenu** : avec une même clé, l'API renvoie toujours le **premier** document créé, même si le corps de la requête a changé entre-temps. Générez donc une **nouvelle clé** après chaque génération réussie, et chaque fois que l'utilisateur change d'élève ou de type de document.
- En plus : désactivez le bouton « Télécharger le PDF » pendant l'appel et affichez un état de chargement.

### Réponse 201

```json
{
  "id": "b7f3a2e0-1c4d-4e8a-9a55-2f6d1f0c9e21",
  "numeroUnique": "N°12/2025-2026/CEG-GODOMEY",
  "statut": "ACTIF",
  "eleveId": "uuid",
  "typeDocumentId": "uuid",
  "dateEmission": "2026-10-02",
  "createdAt": "2026-10-02T09:30:00.000Z",
  "urlTelechargement": "https://…signed…"
}
```

| Champ | Description |
|---|---|
| `id` | Identifiant du document (pour `GET /documents/:id/telechargement`). |
| `numeroUnique` | Numéro de référence imprimé sur le document (voir ci-dessous). |
| `statut` | `ACTIF` (`ANNULE` n'est pas encore utilisé). |
| `dateEmission` | Date imprimée sur le document, fixée par le serveur (non modifiable). |
| `urlTelechargement` | Lien signé, **valable 1 heure**, qui **force l'enregistrement du PDF** : le stockage répond avec `Content-Disposition: attachment`, donc le navigateur enregistre le fichier au lieu de l'ouvrir dans son lecteur. Le fichier porte le nom décrit ci-dessous. Ouvrez-le immédiatement (`window.location.assign(url)` ou un lien `<a>` cliqué par programme). Ne le stockez pas. |

> Un rejeu avec la même `Idempotency-Key` renvoie aussi un **201**, avec une `urlTelechargement` **fraîche**.

### Téléchargement et nom du fichier

Le lien contient déjà le paramètre `download=<nom du fichier>` : c'est lui qui fait enregistrer le PDF plutôt que l'afficher. **Utilisez le lien tel quel**, sans l'ouvrir dans un `<iframe>` ni y ajouter de paramètre. Si votre code ajoute lui-même `download=`, ne le faites que lorsque le paramètre est absent.

Nom proposé à l'enregistrement : **`<Nom du type> - <NOM Prénoms>.pdf`**, par exemple :

```
Certificat de scolarite - ANAGONOU Lince Junior.pdf
```

- Le nom de famille est mis en majuscules ; les accents sont retirés (`Kouèdji` → `Kouedji`), y compris les lettres béninoises (`ɛ`, `ɔ`, `ɖ`, `ŋ` → `e`, `o`, `d`, `n`).
- Seuls les lettres, chiffres, espaces, tirets, points et soulignés sont conservés : tout autre caractère devient un espace (`\ / : * ? " < > |` interdits sous Windows, et l'apostrophe : `D'Almeida` → `D Almeida`). Le nom est sûr sur Windows, macOS et Android.
- Le numéro de référence n'est pas utilisé (il contient des `/`). La longueur est limitée.
- Le nom est celui **imprimé sur le document** : corriger ensuite la fiche de l'élève ne change pas le nom du fichier d'un document déjà établi.
- L'API ne fait que proposer ce nom au navigateur : l'utilisateur peut toujours le modifier dans sa boîte d'enregistrement.

La route de re-téléchargement ([7](#7-re-télécharger--get-documentsidtelechargement)) renvoie un lien de même nature, avec le même nom.

### Ce que fait la génération (tout ou rien)

1. Vérifie l'élève, le type et les champs (mêmes règles que l'aperçu).
2. Attribue le numéro de référence.
3. Génère le PDF et l'enregistre.
4. Mémorise `classe` / `dateInscription` sur la fiche élève si modifiées.
5. Enregistre le document.

Si une étape échoue, **rien n'est conservé et aucun numéro n'est perdu**. Une erreur `500` ou un timeout peut donc être rejoué sans risque avec la même `Idempotency-Key`.

### Le numéro de référence

C'est le « format de référence » défini dans les Paramètres, imprimé tel quel :

- `{N}` est remplacé par le numéro d'ordre (1, 2, 3…) et `{ANNEE}` par le libellé de l'année scolaire active.
- Exemple : format `N°{N}/{ANNEE}/CEG-GODOMEY` → `N°12/2025-2026/CEG-GODOMEY`.
- Sans format défini : `N°{N}/{ANNEE}`.
- Le compteur repart à 1 à chaque nouvelle année scolaire si le format contient `{ANNEE}`.
- Le numéro est unique **par établissement**.

Le frontend n'a **rien à calculer** : il affiche `numeroUnique` tel que reçu.

### Le QR code

Il encode `<VERIFICATION_BASE_URL>/<jeton>` (par défaut `<FRONT_URL>/verifier/<jeton>`), avec un jeton aléatoire non devinable. **La page publique de vérification n'est pas encore livrée** (voir [12](#12-ce-qui-nest-pas-encore-disponible)) : prévoyez simplement que la route publique `/verifier/:jeton` sera à créer côté front.

---

## 7. Re-télécharger — `GET /documents/:id/telechargement`

**Réponse 200**

```json
{ "url": "https://…signed…" }
```

Lien signé valable 1 heure, qui **force l'enregistrement du PDF** (même mécanisme et même nom de fichier que `urlTelechargement` de `POST /documents` : `<Nom du type> - <NOM Prénoms>.pdf`, voir [6](#6-générer--post-documents)). Depuis la fiche d'un élève, le bouton « Télécharger » d'un document utilise cette route. Demandez-en un nouveau à chaque clic plutôt que de conserver un ancien lien. `:id` inconnu, mal formé ou appartenant à un autre établissement → `404` (`"Document introuvable."`).

Un lien **expiré** (plus d'une heure) ou altéré est refusé par le stockage, comme auparavant : redemandez simplement un lien à cette route.

**Nouveau** : chaque appel est **tracé** (qui, quand) et apparaît dans l'historique du document (module Archives). Un document **annulé** n'est plus téléchargeable : `409` avec `code: "DOCUMENT_ANNULE"`. Le lien renvoyé par `POST /documents` n'est pas journalisé (l'auteur est déjà enregistré comme « Établi par »).

---

## 8. Le certificat de scolarité

### Règles des champs

| Clé | Libellé | Type | Obligatoire | Règles |
|---|---|---|---|---|
| `classe` | Classe | `text` | Oui | 30 caractères max. Texte libre (`CE1`, `3ème A`…). |
| `dateInscription` | Date d'inscription | `date` | Oui | `AAAA-MM-JJ`. Date réelle, **pas dans le futur**, **postérieure à la date de naissance** de l'élève. |
| `assiduite` | Assiduité | `select` | Oui | `Excellente`, `Bonne`, `Moyenne`, `Insuffisante`. |
| `conduite` | Conduite | `select` | Oui | `Excellente`, `Bonne`, `Moyenne`, `Insuffisante`. |
| `travail` | Travail | `select` | Oui | `Excellent`, `Satisfaisant`, `Moyen`, `Insuffisant`. |
| `observations` | Observations particulières / Décision | `textarea` | Non | 300 caractères max. Les retours à la ligne sont conservés. |

Comportements communs :

- Les espaces en début et fin de saisie sont retirés ; les espaces multiples sont réduits.
- Un champ **absent**, `null` ou vide est considéré comme non renseigné.
- Un champ **inconnu** (non listé dans `champs`) est refusé : `champsSaisis.<nom>` — « Le champ « … » n'est pas autorisé pour ce type de document. »
- Une valeur de `select` hors de la liste est refusée : « Assiduité : valeur non autorisée (Excellente, Bonne, Moyenne, Insuffisante). »

Exemples de messages renvoyés dans `erreurs[].message` :

| `champ` | `message` |
|---|---|
| `champsSaisis.classe` | Classe est obligatoire. |
| `champsSaisis.dateInscription` | Date d'inscription est obligatoire. |
| `champsSaisis.dateInscription` | La date d'inscription ne peut pas être dans le futur. |
| `champsSaisis.dateInscription` | La date d'inscription doit être postérieure à la date de naissance. |
| `champsSaisis.observations` | Observations particulières / Décision ne doit pas dépasser 300 caractères. |
| `eleveId` | L'élève est obligatoire. |
| `typeDocumentId` | Le type de document est obligatoire. |

### Contenu du PDF

**En-tête** : tutelle administrative et établissement à gauche, « République du Bénin » et devise à droite. Ensuite : titre, numéro de référence, texte, appréciations, observations, signature, QR code.

**Texte d'ouverture**, construit avec le signataire enregistré dans les Paramètres :

> Je soussigné, AMOUSSOU Coffi Darius, Directeur de l'École primaire privée Arche du Millénium de Comé, certifie que l'élève DAMESSI Kouèdji Pascaline Hortense, née le 20 avril 2014 à Abomey, immatriculée sous le numéro CEG-0007 (matricule EducMaster : EM-1180924013060), est régulièrement inscrite dans notre établissement depuis le 22 juin 2023 et y poursuit actuellement ses études en classe de CE1, au titre de l'année scolaire 2025-2026.

Accords automatiques : « Je soussigné / soussignée » selon le titre du signataire ; « de l'École… », « du Collège… », « de la Maternelle… » selon le nom de l'établissement ; « née / né », « immatriculée / immatriculé », « inscrite / inscrit » selon le sexe de l'élève. Les éléments absents (matricule, date d'inscription, année scolaire) sont omis proprement.

**Signature** : « Fait à *lieu*, le *date* », puis le titre du signataire (« Le Directeur, », « La Directrice, »…), l'emplacement du **cachet** et de la **signature** numérisés (s'ils sont téléversés), puis le nom du signataire. Le logo de l'établissement est imprimé en filigrane.

**Couleur de la décision** : le texte saisi dans `observations` est affiché en couleur selon son sens, sans rien à envoyer de plus. Le frontend n'a pas à reproduire cette règle : elle s'applique au PDF.

| Couleur | Exemples reconnus |
|---|---|
| **Vert** | « Passe en classe supérieure », « Passe au CE2 », « Passage en 6ème », « Admis(e) », « Promu(e) » |
| **Rouge** | « Redouble la classe », « Redoublement », « Échec », « Ajourné(e) », « Non admis(e) », « Ne passe pas » |
| Noir | Tout autre texte, et « Néant. » si le champ est vide |

La détection est volontairement simple (mots-clés, sans tenir compte de la casse ni des accents) : une formulation inattendue reste en noir plutôt que d'afficher la mauvaise couleur. Pour obtenir la couleur voulue, l'utilisateur peut s'appuyer sur la formulation du `placeholder` (« Ex. Passe en classe supérieure »).

---

## 9. Prérequis dans les Paramètres

Le document est fidèle à ce qui est renseigné dans **Paramètres** (`GET /etablissement`, voir `API_ETABLISSEMENT.md`). Rien n'est bloquant sauf le premier point, mais un établissement mal configuré obtient un document incomplet.

| Paramètre | Effet sur le document | Bloquant ? |
|---|---|---|
| Année scolaire active (`anneeScolaireActive`) | Utilisée dans le numéro (`{ANNEE}`) et dans le texte | **Oui**, si le format de référence contient `{ANNEE}` (c'est le cas du format par défaut) : `409 ANNEE_SCOLAIRE_MANQUANTE` |
| Nom du signataire et titre | Phrase « Je soussigné… » et bloc de signature | Non : sans nom, l'ouverture devient « La Direction de … certifie que… » ; sans titre, « Directeur » est utilisé |
| Ministère de tutelle, direction départementale, devise, coordonnées | En-tête | Non : les lignes vides ne sont pas imprimées |
| Format de référence | Numéro du document | Non : valeur par défaut `N°{N}/{ANNEE}` |
| Lieu par défaut | « Fait à … » | Non : la commune de l'établissement est utilisée |
| Logo, signature, cachet | Filigrane, signature, cachet | Non. **PNG ou JPEG uniquement** : une image WebP est ignorée sans erreur |

**Recommandation** : avant d'ouvrir le formulaire, affichez un avertissement (sans bloquer, hors année scolaire) si `anneeScolaireActive`, `nomSignataire` ou `ministereTutelle` sont vides, avec un lien vers les Paramètres.

**Titre du signataire** : le champ « Titre » des Paramètres n'accepte que `Directeur`, `Directrice`, `Proviseur`, `Proviseure` (toute autre valeur est refusée en `400`). Voir `API_ETABLISSEMENT.md`.

---

## 10. Codes d'erreur

| Statut | `code` | Quand | Que faire côté front |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Corps invalide : élève/type manquant, champ saisi manquant, invalide ou inconnu. | Afficher chaque `erreurs[].message` sous `erreurs[].champ`. |
| 400 | `IDEMPOTENCY_KEY_INVALIDE` | `Idempotency-Key` présent mais pas un UUID. | Bug côté front : générer un UUID valide. |
| 401 | — | Jeton absent ou expiré. | Rafraîchir le jeton ou rediriger vers la connexion. |
| 404 | — | Élève, type, établissement ou document introuvable (ou d'un autre établissement). Le `message` précise lequel (« Élève introuvable. », « Type de document introuvable. », « Document introuvable. »). | Message d'erreur ; revenir à l'étape 1 si l'élève est introuvable. |
| 409 | `TYPE_DOCUMENT_INDISPONIBLE` | Le type n'est pas encore disponible. | Ne devrait pas arriver si le bouton « Établir » est désactivé quand `disponible` est `false`. |
| 409 | `ANNEE_SCOLAIRE_MANQUANTE` | Le format de référence utilise `{ANNEE}` mais aucune année scolaire n'est active. | Inviter à activer une année dans les Paramètres (lien direct). |
| 409 | `DOCUMENT_ANNULE` | `GET /documents/:id/telechargement` sur un document annulé. | Désactiver « Télécharger » pour un document `ANNULE` (l'aperçu reste possible via les Archives). |
| 409 | `NUMERO_DEJA_UTILISE` | Collision de numéro (très rare). | Proposer de réessayer, avec la même `Idempotency-Key`. |
| 500 | — | Panne temporaire (stockage, base). | Proposer de réessayer, avec la même `Idempotency-Key` : aucun doublon n'est possible. |

Pour l'aperçu, seuls `400`, `401`, `404` et `409` (`TYPE_DOCUMENT_INDISPONIBLE`, `ANNEE_SCOLAIRE_MANQUANTE`) sont attendus.

---

## 11. Exemples de code

### Charger les types

```ts
const types = await api.get<TypeDocument[]>('/types-documents');
const cartes = types.filter((t) => filtre === 'TOUS' || t.categorie === filtre);
```

### Construire le formulaire à partir de `champs`

```ts
function valeurInitiale(champ: ChampDefinition, eleve: Eleve): string {
  if (champ.eleveChamp) return eleve[champ.eleveChamp] ?? '';   // classe, dateInscription
  return '';
}

// Rendu selon champ.type : 'text' | 'textarea' | 'select' | 'date'
// - select : <option> à partir de champ.options
// - maxLength : attribut maxlength + compteur éventuel
// - obligatoire : astérisque, sinon « (facultatif) »
```

N'envoyez que les champs que l'utilisateur a renseignés, ou envoyez des chaînes vides : les deux sont acceptés pour un champ facultatif.

### Aperçu

```ts
async function ouvrirApercu(body: CreerDocumentBody): Promise<string> {
  const res = await fetch(`${API}/documents/apercu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw await res.json();               // { statusCode, code?, message, erreurs? }

  return URL.createObjectURL(await res.blob());      // → <iframe src={url}>
}
```

### Générer et télécharger

```ts
// Généré une seule fois à l'ouverture de l'étape 2
const idempotencyKey = crypto.randomUUID();

async function genererEtTelecharger(body: CreerDocumentBody) {
  const res = await fetch(`${API}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw data;

  window.location.assign(data.urlTelechargement);    // déclenche le téléchargement
  return data;                                       // { id, numeroUnique, … }
}
```

### Gérer les erreurs

```ts
function afficherErreur(e: ApiError) {
  switch (e.code) {
    case 'VALIDATION_ERROR':
      e.erreurs.forEach(({ champ, message }) => marquerChamp(champ, message));
      break;
    case 'ANNEE_SCOLAIRE_MANQUANTE':
      afficherBandeau(e.message, { lien: '/parametres' });
      break;
    case 'TYPE_DOCUMENT_INDISPONIBLE':
      afficherBandeau(e.message);
      break;
    default:
      afficherBandeau(e.message ?? 'Une erreur est survenue. Réessayez.');
  }
}
```

`marquerChamp('champsSaisis.classe', …)` : retirez le préfixe `champsSaisis.` pour retrouver la clé du champ du formulaire ; `eleveId` et `typeDocumentId` correspondent aux étapes 1 et 2 du parcours.

---

## 12. Ce qui n'est pas encore disponible

- **Les 4 autres types** (attestation d'inscription, fiche élève, attestation de transfert, demande de transfert) : renvoyés par `GET /types-documents` avec `disponible: false`. Ils s'activeront un par un, sans changement de contrat : même route, nouveaux `champs`.
- **Page publique de vérification** (cible du QR code) : à venir.
- **Archives et annulation** : voir [API_ARCHIVES.md](./API_ARCHIVES.md). La fiche d'un élève (`GET /eleves/:id`) renvoie toujours la liste de ses documents établis (`documents[]` : `id`, `numeroUnique`, `statut`, `createdAt`, `typeDocument`).

---

## 13. Points d'attention par rapport à la maquette

- **La classe n'est plus une donnée obligatoire de l'élève** : elle est vide tant qu'elle n'a pas été saisie. Dans l'étape 1, l'affichage « *Prénom Nom – 3ème A* » doit gérer l'absence de classe (afficher le matricule à la place, ou rien).
- **Étape 2** : les champs, leurs libellés, leurs listes et leurs limites viennent de `champs`. La maquette actuelle les code en dur pour le certificat ; ils sont à remplacer par le rendu piloté par l'API.
- **Un type sans champ** (`champs: []` mais `disponible: true`) correspond au message « Aucune information complémentaire requise pour ce document ». Cela n'existe pas encore (aucun type disponible n'est dans ce cas).
- **L'aperçu est un PDF**, plus un texte HTML reconstitué. Prévoir un `<iframe>`/`<object>` dans la modale, avec un indicateur de chargement.
- **Le téléchargement n'est plus un lien fixe** : `urlTelechargement` expire au bout d'une heure ; la modale « Télécharger le PDF » doit utiliser le lien de la réponse de `POST /documents`.
