# API — Établissement

Toutes les routes sont préfixées par `/etablissement`. Toutes protégées : `Authorization: Bearer <accessToken>` obligatoire (sinon `401`). Les routes marquées 🔒 Directeur renvoient `403` pour un compte `MEMBRE` (message : *"Vous n'avez pas les droits nécessaires pour cette action."*).

Le format d'erreur générique est le même que dans `API_AUTH.md` : `{ "statusCode", "message", "code"? }`.

---

## 1. Consulter les paramètres — `GET /etablissement`

Accessible à tout membre connecté (Directeur ou Membre).

**Réponse 200**

```json
{
  "id": "uuid",
  "nom": "Collège Sainte-Marie",
  "ordreEnseignement": "SECONDAIRE",
  "departement": "Atlantique",
  "commune": "Abomey-Calavi",
  "adresse": "Quartier Godomey, Abomey-Calavi",
  "numeroAgrement": "AGR-0142",
  "telephone": "+22901970000",
  "email": "ceg.godomey@exemple.bj",
  "logoUrl": "https://.../signed-url...",
  "directionDepartementale": "Direction départementale de l'Atlantique",
  "ministereTutelle": "Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle",
  "devise": "Fraternité – Justice – Travail",
  "nomSignataire": "M. Hervé Agbodjan",
  "fonctionSignataire": "Directeur",
  "signatureUrl": "https://.../signed-url...",
  "cachetUrl": "https://.../signed-url...",
  "formatReference": "N°{N}/{ANNEE}/CEG-GODOMEY",
  "prochainNumero": 1,
  "lieuParDefaut": "Abomey-Calavi",
  "anneeScolaireActive": {
    "id": "uuid",
    "libelle": "2025-2026",
    "dateRentree": "2025-09-15T00:00:00.000Z",
    "dateFin": "2026-07-10T00:00:00.000Z"
  }
}
```

Tous les champs sauf `id`/`nom`/`ordreEnseignement`/`departement`/`commune` peuvent être `null` tant qu'ils n'ont pas été renseignés. `anneeScolaireActive` est `null` tant qu'aucune année n'a été créée (§4).

⚠️ **`logoUrl`/`signatureUrl`/`cachetUrl` sont des URLs signées temporaires** (1h) — ne les mettez jamais en cache au-delà de la session en cours. Rappelez `GET /etablissement` pour en obtenir une fraîche plutôt que de réutiliser une ancienne URL.

---

## 2. Mettre à jour les paramètres — `PATCH /etablissement`

🔒 Directeur.

**Body** — tous les champs optionnels (mise à jour partielle, n'envoyez que ce qui a changé) :

```json
{
  "nom": "Collège Sainte-Marie",
  "ordreEnseignement": "SECONDAIRE",
  "departement": "Atlantique",
  "commune": "Abomey-Calavi",
  "adresse": "...",
  "numeroAgrement": "AGR-0142",
  "telephone": "+22901970000",
  "email": "ceg.godomey@exemple.bj",
  "directionDepartementale": "...",
  "ministereTutelle": "...",
  "devise": "...",
  "nomSignataire": "...",
  "fonctionSignataire": "...",
  "formatReference": "N°{N}/{ANNEE}/CEG-GODOMEY",
  "prochainNumero": 1,
  "lieuParDefaut": "Abomey-Calavi"
}
```

`ordreEnseignement` ∈ `MATERNELLE` | `PRIMAIRE` | `SECONDAIRE`. `formatReference` doit contenir le token `{N}` (erreur `400` sinon).

**Réponse 200** : même forme que §1 (établissement à jour).

**Erreur 409 `PROCHAIN_NUMERO_TROP_BAS`** : les références émises sont définitives, **même pour un document annulé**. `prochainNumero` ne peut donc pas être inférieur au dernier numéro déjà attribué + 1 (si le format contient `{ANNEE}`, on ne compte que les documents de l'année active ; sinon la numérotation est continue). Le contrôle s'applique aussi quand on change seulement `formatReference`.

```json
{
  "statusCode": 409,
  "message": "Le prochain numéro doit être au moins 25 : le numéro 24 a déjà été attribué (même pour un document annulé).",
  "code": "PROCHAIN_NUMERO_TROP_BAS",
  "prochainNumeroMinimum": 25
}
```

Côté front : afficher `message`, et vous pouvez pré-remplir le champ avec `prochainNumeroMinimum`. Monter le compteur (sauter des numéros) reste toujours permis.

---

## 3. Téléverser une image — `POST /etablissement/images/:type`

🔒 Directeur. `:type` ∈ `logo` | `signature` | `cachet`.

**Requête** : `multipart/form-data`, champ **`fichier`** (PNG/JPEG/WebP, 2 Mo max).

**Réponse 200** : même forme que §1, avec l'URL signée du champ concerné mise à jour.

**Erreurs** : `400` si le type n'est pas l'un des trois valides, si aucun fichier n'est reçu, ou si le format/la taille ne respecte pas les contraintes (message explicite renvoyé par le back, affichable tel quel).

---

## 4. Années scolaires

Sous-ressource dédiée à l'historique des années (écran "années scolaires passées").

### 4.1 Lister — `GET /etablissement/annees-scolaires`

Accessible à tout membre. **Réponse 200** : tableau, plus récente en premier.

```json
[
  { "id": "uuid", "libelle": "2025-2026", "dateRentree": "2025-09-15T00:00:00.000Z", "dateFin": "2026-07-10T00:00:00.000Z" }
]
```

### 4.2 Créer une nouvelle année — `POST /etablissement/annees-scolaires`

🔒 Directeur. **La nouvelle année devient automatiquement l'année active** (cas d'usage courant : nouvelle rentrée).

**Body** : `{ "libelle": "2026-2027", "dateRentree": "2026-09-15", "dateFin": "2027-07-10" }`

**Réponse 201** : l'année créée. **Erreur 400** si `dateFin` ≤ `dateRentree`. Si le format de référence contient `{ANNEE}`, la numérotation repart de 1 pour cette année (ou reprend après le dernier numéro si une année de même libellé a déjà émis des documents).

### 4.3 Modifier une année — `PATCH /etablissement/annees-scolaires/:id`

🔒 Directeur. Body : mêmes champs qu'en 4.2, tous optionnels. Ne change **pas** l'année active.

### 4.4 Activer une année existante — `PATCH /etablissement/annees-scolaires/:id/activer`

🔒 Directeur. Pas de body. Utile pour revenir sur une année antérieure depuis l'écran d'historique. Si le format contient `{ANNEE}`, `prochainNumero` est **recalculé** : il reprend après le dernier numéro émis pour cette année (jamais le compteur de l'année précédemment active, qui redonnerait des références déjà prises). **Réponse 200** : l'établissement à jour (même forme qu'en §1, avec `anneeScolaireActive` mis à jour).

**Erreur 404** si `:id` n'appartient pas à l'établissement du Directeur connecté.

---

## Notes pour l'intégration

- Le "Numéro d'agrément", "Téléphone", "E-mail", etc. n'ont pas d'astérisque sur la maquette : ils sont optionnels côté back, à vous d'imposer ou non un rappel front pour compléter le profil.
- Aucune route de ce fichier ne gère encore le toggle "Documents proposés" — repoussé volontairement au module Document (cf. échanges précédents).

---

## Signataire des documents

`nomSignataire` (texte libre, ex. `AMOUSSOU Coffi Darius`, imprimé tel quel) et `fonctionSignataire`, qui doit être **l'une de ces quatre valeurs exactes** (liste déroulante « Titre » des Paramètres) :

`Directeur` · `Directrice` · `Proviseur` · `Proviseure`

Toute autre valeur est refusée en `400` (`champ: "fonctionSignataire"`). Le titre sert à accorder les documents (« Je soussignée… », « La Directrice, »). Sans titre enregistré, les documents utilisent `Directeur` (valeur pré-sélectionnée de l'écran).

Un ancien titre libre déjà en base (ex. « Le Directeur et PO ») continue d'être imprimé tel quel, mais ne peut plus être ré-enregistré : à corriger depuis les Paramètres. Les images `signatureChemin` et `cachetChemin` sont imprimées sur les documents (PNG ou JPEG).
