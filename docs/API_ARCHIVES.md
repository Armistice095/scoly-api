# API — Archives

Registre officiel et traçable de **tous les documents émis** par l'établissement : liste filtrable, fiche détaillée avec historique, aperçu, téléchargement et annulation.

**Sommaire**

1. [Vue d'ensemble](#1-vue-densemble)
2. [Conventions](#2-conventions)
3. [Lister — `GET /archives`](#3-lister--get-archives)
4. [Fiche — `GET /archives/:id`](#4-fiche--get-archivesid)
5. [Annuler — `POST /archives/:id/annulation`](#5-annuler--post-archivesidannulation)
6. [Télécharger — `GET /archives/:id/telechargement`](#6-télécharger--get-archivesidtelechargement)
7. [Aperçu — `GET /archives/:id/apercu`](#7-aperçu--get-archivesidapercu)
8. [Codes d'erreur](#8-codes-derreur)
9. [Garanties d'intégrité](#9-garanties-dintégrité)
10. [Correspondance avec la maquette](#10-correspondance-avec-la-maquette)

---

## 1. Vue d'ensemble

| Route | Rôle | Effet |
|---|---|---|
| `GET /archives` | Liste paginée (recherche, type, statut, tri) | Aucun |
| `GET /archives/:id` | Fiche : document, élève, auteur, historique, annulation | Aucun |
| `POST /archives/:id/annulation` | Annule le document (motif obligatoire) | Statut `ANNULE` + enregistrement de l'annulation |
| `GET /archives/:id/telechargement` | Lien signé (1 h) du PDF | Journalise le téléchargement |
| `GET /archives/:id/apercu` | Le PDF (flux), pour la modale « Aperçu » | Aucun |

Il n'existe **aucune** route de suppression, de modification ou de réactivation.

## 2. Conventions

- 🔒 Toutes les routes exigent un jeton. **Directeur et Membre ont les mêmes droits**, annulation comprise.
- L'établissement vient du jeton. Un document d'un autre établissement, un `:id` inconnu ou mal formé répondent **`404` « Document introuvable. »**.
- Erreurs : `{ statusCode, message, code? }`. Erreurs de validation : `code: "VALIDATION_ERROR"` et `erreurs[]` (`champ`, `message`), comme dans les autres modules.
- Les dates sont des instants ISO UTC (`createdAt`, `le`) : formatez-les dans le fuseau **Africa/Porto-Novo** pour afficher « 3 oct. 2026 » et « 14:31 ». `dateEmission` est une date seule (`YYYY-MM-DD`).
- L'élève affiché est celui **imprimé sur le document** : corriger sa fiche plus tard ne modifie pas l'archive.

## 3. Lister — `GET /archives`

Paramètres (tous optionnels ; une valeur vide = « pas de filtre ») :

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `search` | Texte (≤ 100 car.) : référence, nom, prénoms, matricules. Plusieurs mots → tous doivent correspondre. Sans accents ni casse. | — |
| `typeDocumentId` | UUID d'un type (`GET /types-documents`) | tous |
| `statut` | `ACTIF` \| `ANNULE` | tous |
| `eleveId` | UUID d'un élève | tous |
| `tri` | `recent` (plus récents d'abord) \| `ancien` | `recent` |
| `page` / `limit` | entiers ≥ 1 / 1 à 100 | `1` / `10` |

**Réponse 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "reference": "N°24/2025-2026/CEG-GODOMEY",
      "statut": "ACTIF",
      "createdAt": "2026-10-03T13:31:00.000Z",
      "dateEmission": "2026-10-03",
      "typeDocument": { "id": "uuid", "code": "CERTIFICAT_SCOLARITE", "nom": "Certificat de scolarité" },
      "eleve": { "id": "uuid", "nomComplet": "Adjovi Akpovi" },
      "annulation": null,
      "telechargeable": true
    },
    {
      "id": "uuid",
      "reference": "N°22/2025-2026/CEG-GODOMEY",
      "statut": "ANNULE",
      "annulation": { "motif": "Erreur sur le nom de l’élève", "le": "2026-10-02T09:57:00.000Z" },
      "telechargeable": false
    }
  ],
  "meta": { "total": 25, "page": 1, "limit": 10, "totalPages": 3 }
}
```

`meta.total` alimente « 25 documents ». Pour un document annulé : référence barrée, badge « Annulé » et `annulation.motif` sous le badge.

## 4. Fiche — `GET /archives/:id`

```json
{
  "id": "uuid",
  "reference": "N°22/2025-2026/CEG-GODOMEY",
  "statut": "ANNULE",
  "createdAt": "2026-10-01T07:57:00.000Z",
  "dateEmission": "2026-10-01",
  "typeDocument": { "id": "uuid", "code": "CERTIFICAT_SCOLARITE", "nom": "Certificat de scolarité" },
  "eleve": {
    "id": "uuid", "nom": "Zinsou", "prenoms": "Yannick", "nomComplet": "Yannick Zinsou",
    "matricule": "CEG-0004", "matriculeEducMaster": "EM-7300211"
  },
  "etabli": {
    "par": { "id": "uuid", "nomComplet": "Eugène Sèdjro", "fonction": "Directeur" },
    "le": "2026-10-01T07:57:00.000Z"
  },
  "annulation": {
    "par": { "id": "uuid", "nomComplet": "Eugène Sèdjro", "fonction": "Directeur" },
    "le": "2026-10-02T09:57:00.000Z",
    "motif": "Erreur sur le nom de l’élève"
  },
  "historique": [
    { "type": "ANNULE",     "le": "2026-10-02T09:57:00.000Z", "par": { "id": "uuid", "nomComplet": "Eugène Sèdjro", "fonction": "Directeur" } },
    { "type": "TELECHARGE", "le": "2026-10-01T08:23:00.000Z", "par": { "id": "uuid", "nomComplet": "Eugène Sèdjro", "fonction": "Directeur" } },
    { "type": "ETABLI",     "le": "2026-10-01T07:57:00.000Z", "par": { "id": "uuid", "nomComplet": "Eugène Sèdjro", "fonction": "Directeur" } }
  ],
  "nombreTelechargements": 1,
  "telechargeable": false
}
```

- `annulation` vaut `null` pour un document actif (le bloc « Annulation » n'est alors pas affiché).
- `historique` : du plus récent au plus ancien ; affichez `« <Établi|Téléchargé|Annulé> par <nomComplet> (<fonction>) »`. Les 100 téléchargements les plus récents sont listés ; `nombreTelechargements` donne le total.
- « Voir la fiche élève » → `GET /eleves/:eleve.id`.
- Boutons : « Annuler le document » et « Télécharger » seulement si `statut === "ACTIF"` (`telechargeable`). « Voir l'aperçu » est toujours disponible.

## 5. Annuler — `POST /archives/:id/annulation`

**Body**

```json
{ "motif": "Erreur sur le nom de l'élève" }
```

`motif` : obligatoire, 5 à 500 caractères (espaces autour retirés). Tout autre champ est refusé (`400`) : l'auteur et la date viennent du serveur.

**Réponse 200** : la fiche à jour (même forme qu'au §4) — remplacez simplement les données du panneau, puis rechargez ou mettez à jour la ligne de la liste.

**L'annulation est définitive** : pas de réactivation, la référence reste attribuée, le document reste dans l'archive et son PDF reste consultable en aperçu, mais plus téléchargeable.

| Cas | Réponse |
|---|---|
| Motif absent / trop court / trop long | `400` `VALIDATION_ERROR` |
| Document déjà annulé (y compris deux annulations simultanées) | `409` `DOCUMENT_DEJA_ANNULE` |
| Inconnu / autre établissement | `404` |

Rafraîchir la liste sur `409 DOCUMENT_DEJA_ANNULE` (quelqu'un d'autre l'a annulé entre-temps).

## 6. Télécharger — `GET /archives/:id/telechargement`

```json
{ "url": "https://…signed…" }
```

Même règle que `GET /documents/:id/telechargement` (c'est le même code) : lien valable 1 h qui force l'enregistrement du PDF sous le nom `<Type> - <NOM Prénoms>.pdf` ; **le téléchargement est journalisé** (qui, quand) ; `409 DOCUMENT_ANNULE` si le document est annulé. Ouvrez le lien tout de suite, demandez-en un nouveau à chaque clic.

## 7. Aperçu — `GET /archives/:id/apercu`

Renvoie le **PDF lui-même** (`Content-Type: application/pdf`, `Content-Disposition: inline`, non mis en cache). Récupérez-le avec le jeton (`fetch` → `blob()` → `URL.createObjectURL`) pour l'afficher dans la modale, comme l'aperçu des Documents. Disponible aussi pour un document annulé. **Non journalisé.** `404` si le document ou son fichier n'existe plus.

## 8. Codes d'erreur

| Statut | `code` | Quand |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Paramètre de liste invalide, motif absent/trop court/trop long |
| 401 | — | Jeton absent ou expiré |
| 404 | — | « Document introuvable. » (inconnu, mal formé ou autre établissement) ; « Le fichier PDF de ce document est introuvable. » |
| 409 | `DOCUMENT_DEJA_ANNULE` | Annulation d'un document déjà annulé |
| 409 | `DOCUMENT_ANNULE` | Téléchargement d'un document annulé |

## 9. Garanties d'intégrité

- **Aucune suppression physique** : ni route, ni code. De plus, la **base elle-même** refuse la suppression d'un document, d'une annulation ou d'une ligne du journal de téléchargements, et toute modification d'un document archivé hormis le passage `ACTIF → ANNULE` (migration `archives_immuabilite`, triggers PostgreSQL). Un document annulé ne peut pas être réactivé, même à la main en SQL.
- **Annulation tracée** : qui (`annuleParId`), quand, pourquoi (`motif`), écrits dans la même transaction que le changement de statut.
- **Références jamais réutilisées** : la contrainte `(établissement, référence)` couvre les documents annulés, et `PATCH /etablissement` refuse un `prochainNumero` déjà attribué (`PROCHAIN_NUMERO_TROP_BAS`).
- **Nettoyage des données de test avant la mise en ligne** (hors application, dans une seule transaction) :

```sql
BEGIN;
SET LOCAL scoly.autoriser_purge = 'on';
DELETE FROM telechargements_documents;
DELETE FROM annulations;
DELETE FROM documents;
COMMIT;
```

## 10. Correspondance avec la maquette

| Élément de la maquette | Source |
|---|---|
| « 25 documents » | `meta.total` |
| Filtres « Tous les documents » / « Tous les statuts » | `typeDocumentId` (liste `GET /types-documents`) / `statut` |
| « Plus récents d'abord » | `tri` |
| Menu `…` : Voir / Télécharger / Annuler | `GET /archives/:id` / §6 / §5 |
| Panneau « Fiche du document » | §4 |
| Modale « Annuler ce document ? » (texte d'explication) | référence, type et `eleve.nomComplet` de la ligne |
| « Motif : … » sous le badge | `annulation.motif` de la liste |
