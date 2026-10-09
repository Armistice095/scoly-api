# API — Authentification

Toutes les routes sont préfixées par `/auth`. Toutes les réponses (succès et erreurs) sont en JSON.

Sur toute erreur, le corps a la forme :

```json
{ "statusCode": 400, "message": "Description lisible pour l'utilisateur", "code": "CODE_MACHINE" }
```

`code` n'est présent que sur certaines erreurs prévues pour être traitées spécifiquement par le front (listées ci-dessous). Dans les autres cas, affichez simplement `message`.

---

## 1. Inscription — `POST /auth/inscription`

Réunit les deux étapes du formulaire ("L'établissement" + "Compte administrateur") en un seul appel, à envoyer quand l'utilisateur valide l'étape 2.

**Body**

```json
{
  "nomEtablissement": "Collège Sainte-Marie",
  "ordreEnseignement": "SECONDAIRE",
  "departement": "Atlantique",
  "commune": "Abomey-Calavi",
  "nomComplet": "Jean Dossou",
  "fonction": "Directeur",
  "email": "j.dossou@college-sm.bj",
  "telephone": "+22997000000",
  "motDePasse": "MotDePasse1",
  "confirmationMotDePasse": "MotDePasse1",
  "accepteConditions": true
}
```

`ordreEnseignement` ∈ `MATERNELLE` | `PRIMAIRE` | `SECONDAIRE`. Mot de passe : 8 caractères min, une majuscule, un chiffre (même règle affichée sous le champ).

**Réponse 201**

```json
{ "email": "j.dossou@college-sm.bj" }
```

Pas de tokens : le compte est créé mais **inactif**. Enchaînez sur l'écran de vérification (§2).

**Erreurs**

| Cas | Statut | `code` |
|---|---|---|
| Mots de passe différents | 400 | — |
| E-mail déjà utilisé (compte actif) | 409 | — |
| E-mail déjà utilisé (compte jamais activé) | 409 | `COMPTE_EN_ATTENTE_ACTIVATION` — proposez "Renvoyer le code" (§3) plutôt que de réinscrire |
| Champ invalide/manquant | 400 | — (détail dans `message`) |

---

## 2. Vérifier le code d'activation — `POST /auth/activation/verifier`

**Body**

```json
{ "email": "j.dossou@college-sm.bj", "code": "123456" }
```

**Réponse 200** — connecte automatiquement l'utilisateur (pas besoin de repasser par l'écran de connexion) :

```json
{
  "utilisateur": {
    "id": "uuid",
    "email": "j.dossou@college-sm.bj",
    "nomComplet": "Jean Dossou",
    "fonction": "Directeur",
    "telephone": "+22997000000",
    "role": "DIRECTEUR",
    "emailVerifie": true,
    "actif": true,
    "notifDocumentGenere": true,
    "notifInvitationAcceptee": true
  },
  "etablissement": {
    "id": "uuid",
    "nom": "Collège Sainte-Marie",
    "ordreEnseignement": "SECONDAIRE",
    "departement": "Atlantique",
    "commune": "Abomey-Calavi"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Erreurs** : `400` avec le message générique **"Code invalide ou expiré."** — que ce soit un mauvais code, un code expiré (>10 min), un code déjà utilisé, ou un e-mail inconnu. Ne pas essayer de distinguer ces cas côté front.

---

## 3. Renvoyer le code d'activation — `POST /auth/activation/renvoyer`

**Body** : `{ "email": "j.dossou@college-sm.bj" }`

**Réponse 200** (toujours, même si le compte n'existe pas ou est déjà actif) :

```json
{ "message": "Si ce compte existe et est en attente d'activation, un nouveau code a été envoyé." }
```

**Erreur 429** si appelé moins de 60 secondes après le précédent envoi — correspond au minuteur "Renvoyer le code (51 s)" affiché sur la maquette. Désactivez le bouton pendant ce délai côté front **et** laissez ce statut gérer le cas où l'utilisateur contourne le minuteur.

---

## 4. Connexion — `POST /auth/connexion`

**Body**

```json
{ "email": "j.dossou@college-sm.bj", "motDePasse": "MotDePasse1", "resterConnecte": true }
```

`resterConnecte` (optionnel, défaut `false`) correspond à la case "Rester connecté" — impacte uniquement la durée de vie du `refreshToken` (7 jours si coché, 1 jour sinon).

**Réponse 200** : même forme que §2 (`utilisateur`, `etablissement`, `accessToken`, `refreshToken`).

**Erreurs**

| Cas | Statut | `code` |
|---|---|---|
| E-mail ou mot de passe incorrect | 401 | — (message : *"E-mail ou mot de passe incorrect."*, identique dans les deux cas) |
| Compte pas encore activé | 403 | `COMPTE_NON_ACTIVE` — redirigez vers l'écran de vérification (§2), en proposant de renvoyer un code (§3) |

---

## 5. Mot de passe oublié — `POST /auth/mot-de-passe-oublie`

**Body** : `{ "email": "j.dossou@college-sm.bj" }`

**Réponse 200** (toujours, que l'e-mail existe ou non — volontaire, pour ne pas exposer quels e-mails sont enregistrés) :

```json
{ "message": "Si un compte existe avec cette adresse, un code de vérification a été envoyé." }
```

Affichez ce message tel quel, sans condition, à l'écran "Mot de passe oublié" après clic sur "Envoyer le code".

---

## 6. Vérifier le code de réinitialisation — `POST /auth/mot-de-passe-oublie/verifier`

**Body** : `{ "email": "j.dossou@college-sm.bj", "code": "123456" }`

**Réponse 200**

```json
{ "resetToken": "eyJ..." }
```

Conservez `resetToken` en mémoire côté front (state de l'app, pas de stockage persistant) et transmettez-le à l'étape suivante — il est valable **10 minutes** et à usage unique. L'utilisateur n'a pas à ressaisir le code sur l'écran "Nouveau mot de passe".

**Erreur 400** : même message générique **"Code invalide ou expiré."** qu'en §2.

---

## 7. Réinitialiser le mot de passe — `POST /auth/mot-de-passe-oublie/reinitialiser`

**Body**

```json
{
  "resetToken": "eyJ...",
  "nouveauMotDePasse": "NouveauMdp1",
  "confirmationMotDePasse": "NouveauMdp1"
}
```

**Réponse 200** : `{ "message": "Mot de passe mis à jour." }` — redirigez ensuite vers l'écran de connexion.

**Erreurs** : `400` si les mots de passe diffèrent, ou si `resetToken` est invalide/expiré (message : *"Ce lien de réinitialisation est invalide ou a expiré."* — renvoyez l'utilisateur à l'étape "Mot de passe oublié").

---

## 8. Rafraîchir la session — `POST /auth/rafraichir`

**Body** : `{ "refreshToken": "eyJ..." }`

**Réponse 200** : nouveaux `accessToken`/`refreshToken` (même forme que §2, sans `utilisateur`/`etablissement` réévalués si vous préférez les garder en cache front — actuellement le back les renvoie aussi).

**Erreur 401** si le refresh token est invalide/expiré : redirigez vers l'écran de connexion.

---

## 9. Mettre à jour mon profil — `PATCH /auth/profil`

🔒 Authentifié (`Authorization: Bearer <accessToken>`).

**Body** (tous les champs optionnels) : `{ "nomComplet": "Jean Dossou", "telephone": "+22997000001" }`

L'e-mail n'est **pas** modifiable ici (c'est l'identifiant de connexion — cf. la note déjà affichée sur la maquette "Mon profil").

**Réponse 200** : l'objet `utilisateur` mis à jour (même forme qu'en §2).

---

## 10. Changer mon mot de passe — `PATCH /auth/mot-de-passe`

🔒 Authentifié. Différent de "mot de passe oublié" (§5-7) : ici l'utilisateur est déjà connecté et doit prouver qu'il connaît son mot de passe actuel.

**Body**

```json
{ "motDePasseActuel": "MotDePasse1", "nouveauMotDePasse": "NouveauMdp1", "confirmationMotDePasse": "NouveauMdp1" }
```

**Réponse 200** : `{ "message": "Mot de passe mis à jour." }`

**Erreurs** : `400` si les deux nouveaux mots de passe diffèrent, ou si `motDePasseActuel` est incorrect (message : *"Mot de passe actuel incorrect."*).

---

## 11. Préférences de notification — `PATCH /auth/notifications`

🔒 Authentifié.

**Body** (tous les champs optionnels) : `{ "notifDocumentGenere": true, "notifInvitationAcceptee": false }`

**Réponse 200** : l'objet `utilisateur` mis à jour.

---

## Notes pour l'intégration

- **`accessToken`** : à joindre en `Authorization: Bearer <token>` sur toutes les routes protégées (🔒 dans cette doc, et voir `API_ETABLISSEMENT.md` / `API_EQUIPE.md`). Durée de vie courte (15 min par défaut) — utilisez `/auth/rafraichir` en cas de `401` sur une route protégée, avant de renvoyer l'utilisateur à l'écran de connexion.
- **Routes réservées au Directeur** : certaines routes (listées dans `API_ETABLISSEMENT.md` / `API_EQUIPE.md`) renvoient `403` avec le message *"Vous n'avez pas les droits nécessaires pour cette action."* si l'utilisateur connecté n'a pas le rôle `DIRECTEUR`. Le front peut aussi masquer ces actions en se basant sur `utilisateur.role` reçu à la connexion, mais le back retranche toujours ce contrôle — jamais de confiance aveugle dans l'UI.
- **Compte désactivé** : `POST /auth/connexion` renvoie `403` avec `code: "COMPTE_DESACTIVE"` si le Directeur a désactivé ce compte (§ Équipe).
- Les messages d'erreur listés ci-dessus sont ceux renvoyés par le back — vous pouvez les afficher tels quels, ils sont déjà rédigés pour l'utilisateur final.
