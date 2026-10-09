# SPEC.md — Spécifications produit de Scoly

Version 1.0 — Document vivant, à mettre à jour au fil du développement.

## 1. Vision

Scoly est une plateforme web destinée aux établissements scolaires, dont l'unique
objectif est de **dématérialiser et automatiser l'établissement des documents
administratifs scolaires** (certificats, attestations, fiches...).

Scoly n'est **pas** un logiciel de gestion scolaire complet : pas de gestion des
notes/bulletins, pas de comptabilité, pas d'emploi du temps, pas de messagerie
parents-école. Le périmètre est volontairement restreint à un seul métier :
produire rapidement des documents administratifs officiels, fiables et
vérifiables.

## 2. Problème adressé

- Rédaction manuelle et répétitive des documents administratifs
- Ressaisie des mêmes informations élève à chaque document
- Risque d'erreurs, de documents perdus ou mal classés
- Absence de moyen simple de vérifier l'authenticité d'un document déjà émis

## 3. Utilisateurs

| Rôle | Description | Portée MVP |
|---|---|---|
| **Compte établissement** | Le compte de l'école ; gère élèves, documents, archives, paramètres | Oui — un seul utilisateur par établissement au MVP |
| **Utilisateur secondaire (secrétariat, direction)** | Plusieurs comptes par établissement avec droits différents | Non — V2 |
| **Vérificateur externe** | Toute personne qui scanne un QR code (parent, employeur, autre école, administration) — pas de compte, accès public en lecture seule | Oui |
| **Super-admin Scoly** | Équipe Scoly, supervision multi-établissements, support | Non — à définir en V2 |

## 4. Primitives métier / règles fondamentales

Ces règles sont non négociables et structurent tout le système :

1. **Un élève est enregistré une seule fois** par établissement, puis réutilisé
   pour générer tout document le concernant.
2. **Un document généré est figé** : il ne peut jamais être modifié après
   création.
3. **Correction = Annulation + Régénération**, jamais d'édition ni de
   suppression. Un document annulé reste visible dans l'archive avec le statut
   `Annulé` et un motif obligatoire.
4. **Chaque document possède un identifiant unique** et un **QR code de
   vérification** imprimés dessus.
5. **La vérification publique n'affiche que l'essentiel** : élève, type de
   document, établissement, numéro, statut (valide/annulé). Jamais
   d'informations sensibles (appréciations, observations, coordonnées...).
6. **Isolation stricte des données entre établissements** (multi-tenant) : un
   établissement ne voit jamais les élèves ou documents d'un autre.

## 5. Portée fonctionnelle

### 5.1 MVP

| Module | Fonctionnalités |
|---|---|
| Authentification | Connexion établissement, mot de passe oublié |
| Élèves | Ajout manuel, liste, recherche/filtre, fiche détail, modification |
| Documents | Génération du **Certificat de scolarité** uniquement |
| Génération | Sélection élève → informations complémentaires → aperçu → génération PDF |
| Vérification | Page publique de vérification via QR code (valide / annulé / introuvable) |
| Archives | Liste des documents générés, filtres, annulation avec motif, réimpression |
| Paramètres | Informations de l'établissement (nom, adresse, direction départementale, signataire) |

### 5.2 V1

- Import d'élèves en masse (Excel/CSV) avec écran de validation/correspondance
- Nouveaux types de documents : attestation d'inscription, fiche individuelle,
  attestation/certificat de transfert, exeat, autorisation de sortie,
  convocation, etc.
- Personnalisation du modèle par établissement (logo, en-tête)

### 5.3 V2 (pistes, non engageantes)

- Multi-utilisateurs par établissement avec rôles
- Tableau de bord de supervision (direction départementale / ministère)
- API publique / intégrations tierces

## 6. Parcours détaillé — Génération d'un Certificat de scolarité (MVP)

1. L'utilisateur clique sur **Documents**
2. Il sélectionne la carte **Certificat de scolarité**
3. **Étape 1/3 — Élève** : recherche et sélection d'un élève existant
4. **Étape 2/3 — Informations** : formulaire avec les champs variables :
   - Classe actuelle (pré-remplie si connue, modifiable)
   - Assiduité (liste : Excellente / Bonne / Moyenne / Insuffisante)
   - Conduite (même échelle)
   - Travail (Excellent / Satisfaisant / Moyen / Insuffisant)
   - Observations particulières / Décision (texte libre, ex. "Admis au CEP")
   - Date d'émission (par défaut aujourd'hui)
5. **Étape 3/3 — Aperçu** : rendu exact du PDF final, boutons "Modifier" /
   "Confirmer et générer"
6. **Confirmation** : le PDF est généré, numéro unique attribué, QR code
   inséré ; boutons "Télécharger" / "Imprimer" ; le document apparaît
   immédiatement dans les Archives avec le statut `Actif`

## 7. Modèle de données (conceptuel)

Voir détail technique dans `ARCHITECTURE.md`. Entités principales :

- **Etablissement** (tenant)
- **Utilisateur** (compte de connexion, rattaché à un établissement)
- **Eleve** (rattaché à un établissement)
- **TypeDocument** (référentiel : Certificat de scolarité, etc.)
- **Document** (instance générée : élève, type, champs saisis, statut, numéro
  unique, PDF, historique d'annulation)

## 8. Exigences non fonctionnelles

- **Langue** : français uniquement au MVP
- **Support réseau** : connexions parfois lentes (contexte Bénin) → interface
  légère, pas de dépendances lourdes côté client, fonctionnement correct en
  3G/4G
- **Impression** : les PDF générés doivent s'imprimer correctement en A4, sans
  distorsion, avec le QR code net et scannable
- **Sécurité** : isolation des données entre établissements, mots de passe
  hashés, endpoints de vérification publics en lecture seule uniquement
- **Disponibilité** : pas d'exigence de haute disponibilité stricte au MVP,
  mais sauvegardes régulières de la base de données obligatoires (les
  documents administratifs ne doivent jamais être perdus)
- **Accessibilité utilisateur** : personnel non technophile → parcours
  guidés, messages d'erreur clairs, peu de jargon

## 9. Écrans (référence)

Voir la liste complète et priorisée dans la conversation produit. Écrans
prioritaires MVP : Connexion, Tableau de bord, Élèves (liste/ajout/détail),
Documents (choix type), Génération (3 étapes), Confirmation, Archives
(liste/détail/annulation), Paramètres établissement, Vérification publique
(valide/annulé/introuvable).

## 10. Critères d'acceptation clés (MVP)

- [ ] Un établissement peut créer un compte et se connecter
- [ ] Un établissement peut ajouter un élève manuellement et le retrouver par
      recherche
- [ ] Un établissement peut générer un certificat de scolarité pour un élève
      en moins de 2 minutes
- [ ] Le PDF généré est correctement mis en page et imprimable en A4
- [ ] Chaque document généré a un numéro unique et un QR code fonctionnel
- [ ] Scanner le QR code affiche la page de vérification correcte selon le
      statut du document
- [ ] Un document peut être annulé (motif obligatoire) et un nouveau document
      peut être généré à la place
- [ ] Un établissement ne peut jamais voir les données d'un autre
      établissement
