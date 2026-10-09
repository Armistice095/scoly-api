# API — Notifications

La **cloche** de l'en-tête (badge + menu des dernières notifications) et la page **Centre de notifications**.

## 1. Vue d'ensemble

| Route | Usage | Effet |
|---|---|---|
| `GET /notifications` | Menu de la cloche (`limite=5`) et page complète | Aucun |
| `GET /notifications/non-lues/compteur` | Badge de la cloche | Aucun |
| `POST /notifications/tout-lire` | « Tout marquer comme lu » | Marque tout comme lu |
| `PATCH /notifications/:id/lue` | « Marquer comme lue » | Idempotent |
| `PATCH /notifications/:id/non-lue` | « Marquer comme non lue » | Idempotent |
| `DELETE /notifications/:id` | Supprimer (facultatif côté UI) | Suppression définitive |

Il n'existe **aucune** route de création : les notifications sont produites par le serveur (§9).

## 2. Conventions

- 🔒 Toutes les routes exigent un jeton (`Authorization: Bearer …`). **Directeur et Membre ont les mêmes droits** : chacun ne voit et ne modifie que **SES** notifications (une ligne par destinataire : « lue » est personnel).
- Identité et établissement viennent du jeton, jamais du client.
- Notification d'un collègue, d'un autre établissement, `:id` inconnu **ou mal formé** : tous répondent **`404` « Notification introuvable. »**.
- Erreurs : `{ statusCode, message, code? }`. Validation : `code: "VALIDATION_ERROR"` et `erreurs[]`.
- Dates : ISO 8601 UTC, générées par le serveur.
- Réponses de lecture (`GET`) : `Cache-Control: private, no-store`.

## 3. Objet `Notification`

```json
{
  "id": "6f1c0c52-1b59-4f0e-9f33-3d7a8f7f3b11",
  "type": "DOCUMENT_ETABLI",
  "categorie": "DOCUMENTS",
  "titre": "Document établi",
  "message": "Certificat de scolarité pour Adjovi Akpovi.",
  "lue": false,
  "lueLe": null,
  "documentId": "uuid",
  "membreId": null,
  "createdAt": "2026-10-09T08:30:00.000Z"
}
```

| Champ | Notes |
|---|---|
| `type` | `DOCUMENT_ETABLI`, `DOCUMENT_ANNULE`, `INVITATION_ACCEPTEE` |
| `categorie` | `DOCUMENTS` ou `EQUIPE` |
| `titre`, `message` | Texte final en français, figé à la création : affichez-les tels quels |
| `documentId` | Renseigné pour `DOCUMENT_*` → ouvrir `/archives/:id` |
| `membreId` | Renseigné pour `INVITATION_ACCEPTEE` → page Équipe |

## 4. Lister — `GET /notifications`

Query (tous facultatifs ; une valeur vide = pas de filtre) :

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `statut` | `toutes`, `non-lues` | `toutes` |
| `type` | un `type` ci-dessus | — |
| `categorie` | `DOCUMENTS`, `EQUIPE` | — |
| `page` | entier ≥ 1 | `1` |
| `limite` | 1 à 50 | `10` |

Plus récentes d'abord.

```json
{
  "data": [ { "…": "Notification" } ],
  "meta": { "total": 12, "page": 1, "limite": 5, "totalPages": 3, "nonLues": 4 }
}
```

`meta.total` tient compte des filtres ; **`meta.nonLues` non** (total des non lues de l'utilisateur) : il met le badge à jour sans second appel.

## 5. Compteur — `GET /notifications/non-lues/compteur`

`200` → `{ "nonLues": 4 }`

## 6. Marquer lue / non lue

`PATCH /notifications/:id/lue` et `PATCH /notifications/:id/non-lue` → `200` + la `Notification` à jour. **Idempotents** : refaire l'appel ne change rien (`lueLe` garde sa date d'origine).

## 7. Tout marquer comme lu — `POST /notifications/tout-lire`

Pas de body. `200` → `{ "marquees": 4 }`

## 8. Supprimer — `DELETE /notifications/:id`

`204` sans corps. Définitif.

## 9. Quand une notification est-elle créée ?

Jamais pour la personne qui a fait l'action.

| Évènement | Destinataires | Préférence (`/auth/notifications`) |
|---|---|---|
| Document établi (`POST /documents`) | Collègues actifs de l'établissement | `notifDocumentGenere` |
| Document annulé (`POST /archives/:id/annulation`) | Collègues actifs de l'établissement | aucune (toujours envoyée) |
| Invitation acceptée | **Directeurs** de l'établissement | `notifInvitationAcceptee` |

Une panne de création de notification ne fait jamais échouer l'action d'origine.

## 10. Mettre à jour le badge

Appelez `GET /notifications/non-lues/compteur` au chargement de l'application, à l'ouverture de la cloche et périodiquement (ex. toutes les 60 s, onglet visible). Après `PATCH`/`POST`/`DELETE`, relisez le compteur (ou `meta.nonLues` d'un `GET /notifications`). Pas de temps réel (WebSocket/SSE) pour l'instant.

## 11. Codes d'erreur

| Statut | Quand |
|---|---|
| `400` `VALIDATION_ERROR` | `statut`, `type`, `categorie`, `page` ou `limite` invalide |
| `401` | Jeton absent ou expiré (→ `/auth/rafraichir`) |
| `404` « Notification introuvable. » | Inconnue, d'un collègue, d'un autre établissement, ou id mal formé |
