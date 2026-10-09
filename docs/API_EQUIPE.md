# API — Équipe

Deux groupes de routes : `/equipe/*` (gestion de l'équipe, réservée au Directeur, authentifiée) et `/invitation/*` (acceptation d'une invitation, **publiques** — la personne invitée n'a pas encore de compte actif).

Le format d'erreur générique est le même que dans `API_AUTH.md` : `{ "statusCode", "message", "code"? }`.

---

## `/equipe` — authentifié, réservé au Directeur

Toutes les routes ci-dessous exigent `Authorization: Bearer <accessToken>` **et** le rôle `DIRECTEUR` (sinon `403`, message : *"Vous n'avez pas les droits nécessaires pour cette action."*).

### 1. Lister l'équipe — `GET /equipe`

**Réponse 200**

```json
[
  {
    "id": "uuid",
    "nomComplet": "Colette Sossou",
    "fonction": "Secrétariat",
    "email": "c.sossou@ceg-godomey.bj",
    "role": "MEMBRE",
    "statut": "ACTIF"
  },
  {
    "id": "uuid",
    "nomComplet": null,
    "fonction": "Secrétariat",
    "email": "n.tossou@ceg-godomey.bj",
    "role": "MEMBRE",
    "statut": "EN_ATTENTE"
  }
]
```

`statut` ∈ `EN_ATTENTE` (invité, pas encore accepté — `nomComplet`/`telephone` sont `null` jusque-là) | `ACTIF` | `DESACTIVE`. Le Directeur lui-même apparaît dans la liste avec `role: "DIRECTEUR"`.

### 2. Inviter un membre — `POST /equipe/inviter`

**Body** : `{ "email": "n.tossou@ceg-godomey.bj", "fonction": "Secrétariat" }`

Crée immédiatement un compte inactif et envoie l'e-mail d'invitation (lien, pas un code à 6 chiffres — cf. `POST /invitation/accepter` plus bas).

**Réponse 201** : `{ "id": "uuid", "email": "...", "fonction": "Secrétariat", "statut": "EN_ATTENTE" }`

**Erreur 409** si l'e-mail est déjà utilisé par un compte (actif, en attente ou désactivé — toutes les adresses e-mail sont uniques sur la plateforme, tous établissements confondus).

### 3. Renvoyer l'invitation — `POST /equipe/:id/renvoyer-invitation`

Pas de body. **Réponse 200** : `{ "message": "Invitation renvoyée." }`

**Erreurs** : `400` si le compte est déjà activé, ou `429` si moins de 60 secondes se sont écoulées depuis le dernier envoi (même logique de cooldown que les codes d'activation).

### 4. Désactiver / réactiver — `PATCH /equipe/:id/desactiver` et `PATCH /equipe/:id/reactiver`

Pas de body. Un compte désactivé ne peut plus se connecter (`POST /auth/connexion` renverra `403 COMPTE_DESACTIVE`, cf. `API_AUTH.md`).

**Réponse 200** : la ligne mise à jour (même forme qu'en §1, un seul élément).

**Erreur 400** si `:id` correspond au compte `DIRECTEUR` — il ne peut pas être désactivé par ce biais.

---

## `/invitation` — public, aucune authentification

À utiliser sur la page que la personne invitée ouvre en cliquant le lien reçu par e-mail (`{FRONT_URL}/invitation?id=...&token=...`).

### 5. Consulter l'invitation — `GET /invitation?id=...&token=...`

Ne consomme pas le jeton (l'utilisateur peut recharger la page sans casser son invitation). Appelez ceci pour afficher le contexte avant le formulaire ("Vous êtes invité(e) par...").

**Réponse 200** : `{ "email": "n.tossou@ceg-godomey.bj", "fonction": "Secrétariat", "etablissementNom": "CEG Godomey" }`

**Erreur 400** si le lien est invalide, expiré (7 jours) ou déjà utilisé — message : *"Ce lien d'invitation est invalide ou a expiré."* Affichez un état "lien expiré, contactez votre directeur" plutôt qu'un formulaire.

### 6. Accepter l'invitation — `POST /invitation/accepter`

**Body** (`id`/`token` = les mêmes valeurs que dans le lien) :

```json
{
  "id": "uuid",
  "token": "64-caractères-hex",
  "nomComplet": "Nadège Tossou",
  "telephone": "+22997000002",
  "motDePasse": "MotDePasse1",
  "confirmationMotDePasse": "MotDePasse1"
}
```

**Réponse 200** — connecte automatiquement (même forme que `POST /auth/connexion`, cf. `API_AUTH.md` §2) :

```json
{
  "utilisateur": { "...": "..." },
  "etablissement": { "...": "..." },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Erreurs** : `400` si les mots de passe diffèrent, ou si le jeton est invalide/expiré/déjà utilisé (même message qu'en §5 — cette fois-ci le jeton **est** consommé en cas de succès, un lien ne sert qu'une fois).

---

## Notes pour l'intégration

- La colonne "Rôle" de la maquette (Directeur / Secrétariat / Censeur) correspond au champ **`fonction`** (texte libre), pas au champ `role` interne (`DIRECTEUR`/`MEMBRE`, qui ne sert qu'aux permissions et n'a pas vocation à être affiché tel quel).
- Le profil de la personne connectée (nom, mot de passe, notifications) se gère via `/auth/profil`, `/auth/mot-de-passe`, `/auth/notifications` — voir `API_AUTH.md` §9-11, pas dans ce fichier.
