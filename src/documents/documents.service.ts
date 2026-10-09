import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Eleve,
  Etablissement,
  Prisma,
  TypeDocument,
} from '@prisma/client';
import { creerExceptionChamps } from '../common/validation/erreurs-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { estErreurUnicite } from '../eleves/eleves.mapper.js';
import { construireTexteRecherche } from '../eleves/utils/recherche.js';
import { dateCivileDuJour } from './dates.js';
import type { CreerDocumentDto } from './dto/creer-document.dto.js';
import type { DonneesDocument, ImagesDocument } from './donnees-document.js';
import { estImageSupporteePdf } from './images.js';
import { nomFichierTelechargement } from './nom-fichier.js';
import { formaterNumeroReference } from './numerotation.js';
import { genererTokenQr } from './qr-token.js';
import { normaliserReference } from './reference-normalisee.js';
import { construireTexteRechercheDocument } from './recherche-document.js';
import type { TypeDocumentDefinition } from './types/definitions.js';
import { REGISTRE_TYPES } from './types/registre.js';
import { validerChampsSaisis } from './types/validation-champs.js';

const dateIso = (date: Date) => date.toISOString().slice(0, 10);

interface Contexte {
  eleve: Eleve;
  etablissement: Etablissement & {
    anneeScolaireActive: { libelle: string } | null;
  };
  type: TypeDocument;
  definition: TypeDocumentDefinition;
  champs: Record<string, string>;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /** URL de base encodée dans le QR code : `<base>/<token>`. Configurable (VERIFICATION_BASE_URL), sinon dérivée de FRONT_URL. */
  private urlVerification(token: string): string {
    const base =
      this.config.get<string>('VERIFICATION_BASE_URL') ??
      `${this.config.get<string>('FRONT_URL') ?? 'http://localhost:5173'}/verifier`;
    return `${base.replace(/\/$/, '')}/${token}`;
  }

  // -------------------------------------------------------------------------
  // Catalogue : GET /types-documents
  // -------------------------------------------------------------------------

  /**
   * Types affichés sur l'écran Documents, avec la description de leurs champs
   * (le front construit le formulaire à partir de ça : une seule source de
   * vérité pour les libellés, les listes et les règles).
   */
  async listerTypes() {
    const types = await this.prisma.typeDocument.findMany({
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
    });

    return types.map((type) => {
      const definition = REGISTRE_TYPES.get(type.code);
      const disponible = type.actif && definition !== undefined;
      return {
        id: type.id,
        code: type.code,
        nom: type.nom,
        description: type.description,
        categorie: type.categorie,
        disponible,
        champs: disponible ? definition.champs : [],
      };
    });
  }

  // -------------------------------------------------------------------------
  // Aperçu : aucune écriture, aucun numéro consommé
  // -------------------------------------------------------------------------

  async apercu(
    etablissementId: string,
    dto: CreerDocumentDto,
  ): Promise<{ pdf: Buffer; nomFichier: string }> {
    const contexte = await this.preparer(etablissementId, dto);
    const donnees = this.construireDonnees(contexte, {
      numero: formaterNumeroReference(
        contexte.etablissement.formatReference,
        null,
        contexte.etablissement.anneeScolaireActive?.libelle ?? null,
      ),
      dateEmission: dateCivileDuJour(),
      urlVerification: null,
      apercu: true,
    });

    const images = await this.chargerImages(contexte.etablissement);
    const pdf = await contexte.definition.rendre(donnees, images);
    return { pdf, nomFichier: this.nomFichier(contexte.definition, donnees) };
  }

  // -------------------------------------------------------------------------
  // Génération : numéro + PDF + enregistrement, tout ou rien
  // -------------------------------------------------------------------------

  async creer(
    etablissementId: string,
    utilisateurId: string,
    dto: CreerDocumentDto,
    cleIdempotence?: string,
  ) {
    // Double-clic / nouvel essai après un timeout réseau : on renvoie le
    // document déjà créé au lieu d'en fabriquer un second (et de brûler un numéro).
    if (cleIdempotence) {
      const existant = await this.trouverParCle(
        etablissementId,
        cleIdempotence,
      );
      if (existant) return this.versReponse(existant);
    }

    const contexte = await this.preparer(etablissementId, dto);

    const id = randomUUID();
    const chemin = `etablissements/${etablissementId}/documents/${id}.pdf`;
    // 192 bits d'aléa, URL-safe : non devinable (contrairement au numéro, séquentiel).
    const qrCodeToken = genererTokenQr();
    const dateEmission = dateCivileDuJour();
    const images = await this.chargerImages(contexte.etablissement);

    let pdfEnvoye = false;
    try {
      const document = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // 1. Numéro. L'UPDATE verrouille la ligne de l'établissement jusqu'au
          //    commit : deux générations simultanées sont sérialisées, jamais
          //    de doublon. Si la suite échoue, le compteur revient en arrière
          //    avec la transaction : pas de trou dans la numérotation.
          const etab = await tx.etablissement.update({
            where: { id: etablissementId },
            data: { prochainNumero: { increment: 1 } },
            select: { prochainNumero: true },
          });
          const numeroOrdre = etab.prochainNumero - 1;
          const numero = formaterNumeroReference(
            contexte.etablissement.formatReference,
            numeroOrdre,
            contexte.etablissement.anneeScolaireActive?.libelle ?? null,
          );

          // 2. PDF, rendu à partir des données qui seront figées en base.
          const donnees = this.construireDonnees(contexte, {
            numero,
            dateEmission,
            urlVerification: this.urlVerification(qrCodeToken),
            apercu: false,
          });
          const pdf = await contexte.definition.rendre(donnees, images);
          await this.storage.televerser(chemin, pdf, 'application/pdf');
          pdfEnvoye = true;

          // 3. Ce que l'utilisateur a saisi pour l'élève (classe, date
          //    d'inscription) est mémorisé sur sa fiche.
          await this.memoriserSurEleve(tx, contexte);

          // 4. Le document.
          return tx.document.create({
            data: {
              id,
              etablissementId,
              eleveId: contexte.eleve.id,
              typeDocumentId: contexte.type.id,
              // Auteur : toujours l'utilisateur du JWT, jamais une valeur du client.
              etabliParId: utilisateurId,
              numeroUnique: numero,
              numeroOrdre,
              // Clé de la page publique de vérification (saisie manuelle).
              referenceNormalisee: normaliserReference(numero),
              rechercheNormalisee: construireTexteRechercheDocument(
                numero,
                donnees.eleve,
              ),
              champsSaisis: contexte.champs,
              donneesFigees: donnees as unknown as Prisma.InputJsonValue,
              dateEmission: new Date(`${dateEmission}T00:00:00.000Z`),
              cleIdempotence: cleIdempotence ?? null,
              urlPdf: chemin,
              qrCodeToken,
            },
            include: { typeDocument: { select: { nom: true } } },
          });
        },
        { timeout: 30_000 },
      );

      // Hors transaction et sans `await` bloquant l'échec : le document est
      // émis, une notification manquée ne doit pas le faire échouer
      // (NotificationsService.documentEtabli ne lève jamais).
      await this.notifications.documentEtabli({
        etablissementId,
        auteurId: utilisateurId,
        documentId: document.id,
        typeDocumentNom: document.typeDocument.nom,
        eleveNomComplet: `${contexte.eleve.prenoms} ${contexte.eleve.nom}`,
      });

      return this.versReponse(document);
    } catch (erreur) {
      if (pdfEnvoye) await this.storage.supprimer(chemin); // pas de PDF orphelin
      return this.traduireErreur(erreur, etablissementId, cleIdempotence);
    }
  }

  // -------------------------------------------------------------------------
  // Téléchargement : GET /documents/:id/telechargement (et /archives/:id/telechargement)
  // -------------------------------------------------------------------------

  /**
   * Délivre un lien signé (1 h) vers le PDF, et trace QUI le demande.
   *
   * - Un document annulé n'est plus téléchargeable (409 DOCUMENT_ANNULE).
   * - Le lien n'est renvoyé qu'une fois la trace enregistrée : si l'écriture du
   *   journal échoue, la requête échoue — pas de téléchargement non tracé.
   * - La génération (POST /documents) ne passe pas par ici : le lien qu'elle
   *   renvoie à l'auteur est déjà couvert par « Établi par … ».
   */
  async urlTelechargement(
    etablissementId: string,
    utilisateurId: string,
    documentId: string,
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, etablissementId },
      select: {
        id: true,
        statut: true,
        urlPdf: true,
        donneesFigees: true,
        typeDocument: { select: { nom: true } },
      },
    });
    if (!document?.urlPdf) throw new NotFoundException('Document introuvable.');

    if (document.statut === 'ANNULE') {
      throw new ConflictException({
        message: 'Ce document est annulé : il ne peut plus être téléchargé.',
        code: 'DOCUMENT_ANNULE',
      });
    }

    const url = await this.urlSigneeDeTelechargement(document);
    await this.prisma.telechargementDocument.create({
      data: { documentId: document.id, utilisateurId },
    });
    return { url };
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  /** Charge et valide tout ce qu'il faut pour rendre un document (aperçu ou réel). Toujours borné à l'établissement. */
  private async preparer(
    etablissementId: string,
    dto: CreerDocumentDto,
  ): Promise<Contexte> {
    const [eleve, etablissement, type] = await Promise.all([
      this.chargerEleve(etablissementId, dto.eleveId),
      this.chargerEtablissement(etablissementId),
      this.prisma.typeDocument.findUnique({
        where: { id: dto.typeDocumentId },
      }),
    ]);

    if (!eleve) throw new NotFoundException('Élève introuvable.');
    if (!etablissement)
      throw new NotFoundException('Établissement introuvable.');
    if (!type) throw new NotFoundException('Type de document introuvable.');

    const definition = REGISTRE_TYPES.get(type.code);
    if (!type.actif || !definition) {
      throw new ConflictException({
        message: "Ce type de document n'est pas encore disponible.",
        code: 'TYPE_DOCUMENT_INDISPONIBLE',
      });
    }

    const resultat = validerChampsSaisis(definition, dto.champsSaisis, {
      eleve: { dateNaissance: dateIso(eleve.dateNaissance) },
    });
    if (!resultat.ok) throw creerExceptionChamps(resultat.erreurs);

    return { eleve, etablissement, type, definition, champs: resultat.champs };
  }

  private chargerEleve(etablissementId: string, eleveId: string) {
    return this.prisma.eleve.findFirst({
      where: { id: eleveId, etablissementId },
    });
  }

  private chargerEtablissement(etablissementId: string) {
    return this.prisma.etablissement.findUnique({
      where: { id: etablissementId },
      include: { anneeScolaireActive: { select: { libelle: true } } },
    });
  }

  private construireDonnees(
    { eleve, etablissement, champs }: Contexte,
    variables: Pick<
      DonneesDocument,
      'numero' | 'dateEmission' | 'urlVerification' | 'apercu'
    >,
  ): DonneesDocument {
    return {
      etablissement: {
        nom: etablissement.nom,
        ministereTutelle: etablissement.ministereTutelle,
        directionDepartementale: etablissement.directionDepartementale,
        devise: etablissement.devise,
        adresse: etablissement.adresse,
        telephone: etablissement.telephone,
        email: etablissement.email,
        nomSignataire: etablissement.nomSignataire,
        fonctionSignataire: etablissement.fonctionSignataire,
        lieu: etablissement.lieuParDefaut?.trim() || etablissement.commune,
      },
      anneeScolaire: etablissement.anneeScolaireActive?.libelle ?? null,
      eleve: {
        nom: eleve.nom,
        prenoms: eleve.prenoms,
        sexe: eleve.sexe,
        dateNaissance: dateIso(eleve.dateNaissance),
        lieuNaissance: eleve.lieuNaissance,
        matricule: eleve.matricule,
        matriculeEducMaster: eleve.matriculeEducMaster,
      },
      champs,
      ...variables,
    };
  }

  /** Logo (filigrane), signature et cachet : facultatifs, jamais bloquants. */
  private async chargerImages(etablissement: {
    logoChemin: string | null;
    signatureChemin: string | null;
    cachetChemin: string | null;
  }): Promise<ImagesDocument> {
    const lire = async (chemin: string | null) => {
      if (!chemin) return undefined;
      const octets = await this.storage.telecharger(chemin);
      if (!octets) return undefined;
      if (!estImageSupporteePdf(octets)) {
        this.logger.warn(
          `Image ignorée dans le PDF (format non supporté, PNG ou JPEG requis) : ${chemin}`,
        );
        return undefined;
      }
      return octets;
    };
    const [logo, signature, cachet] = await Promise.all([
      lire(etablissement.logoChemin),
      lire(etablissement.signatureChemin),
      lire(etablissement.cachetChemin),
    ]);
    return { logo, signature, cachet };
  }

  /** Mémorise sur la fiche élève les champs « partagés » saisis (classe, date d'inscription), si modifiés. */
  private async memoriserSurEleve(
    tx: Prisma.TransactionClient,
    { eleve, definition, champs }: Contexte,
  ) {
    const data: Prisma.EleveUncheckedUpdateInput = {};
    let classe = eleve.classe;

    for (const champ of definition.champs) {
      const valeur = champ.eleveChamp ? champs[champ.cle] : undefined;
      if (!valeur) continue;

      if (champ.eleveChamp === 'classe' && valeur !== eleve.classe) {
        data.classe = valeur;
        classe = valeur;
      }
      if (
        champ.eleveChamp === 'dateInscription' &&
        valeur !==
          (eleve.dateInscription ? dateIso(eleve.dateInscription) : null)
      ) {
        data.dateInscription = new Date(`${valeur}T00:00:00.000Z`);
      }
    }

    if (Object.keys(data).length === 0) return;
    // La classe fait partie du texte de recherche : à recalculer avec elle.
    data.rechercheNormalisee = construireTexteRecherche({ ...eleve, classe });
    await tx.eleve.update({ where: { id: eleve.id }, data });
  }

  private nomFichier(
    definition: TypeDocumentDefinition,
    donnees: DonneesDocument,
  ): string {
    const morceau = (texte: string) =>
      texte
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_');
    return `${definition.prefixeFichier}_${morceau(donnees.eleve.nom.toLocaleUpperCase('fr-FR'))}_${morceau(donnees.eleve.prenoms)}.pdf`;
  }

  private trouverParCle(etablissementId: string, cleIdempotence: string) {
    return this.prisma.document.findFirst({
      where: { etablissementId, cleIdempotence },
      include: { typeDocument: { select: { nom: true } } },
    });
  }

  /**
   * Lien signé (1 h) qui FORCE l'enregistrement du PDF : le paramètre
   * `download` fait répondre le stockage avec `Content-Disposition:
   * attachment`, sinon le navigateur ouvrirait le PDF dans son lecteur.
   * Le nom vient de ce qui est imprimé sur le document (données figées) et
   * du nom du type : il reste cohérent même si l'élève est corrigé ensuite.
   */
  private urlSigneeDeTelechargement(document: {
    urlPdf: string | null;
    donneesFigees: unknown;
    typeDocument: { nom: string };
  }): Promise<string> {
    const { eleve } = document.donneesFigees as DonneesDocument;
    return this.storage.obtenirUrlSignee(
      document.urlPdf as string,
      nomFichierTelechargement(
        document.typeDocument.nom,
        eleve.nom,
        eleve.prenoms,
      ),
    );
  }

  private async versReponse(document: {
    id: string;
    numeroUnique: string;
    statut: string;
    dateEmission: Date;
    createdAt: Date;
    urlPdf: string | null;
    donneesFigees: unknown;
    typeDocument: { nom: string };
    typeDocumentId: string;
    eleveId: string;
  }) {
    return {
      id: document.id,
      numeroUnique: document.numeroUnique,
      statut: document.statut,
      eleveId: document.eleveId,
      typeDocumentId: document.typeDocumentId,
      dateEmission: dateIso(document.dateEmission),
      createdAt: document.createdAt,
      // Lien frais (1 h) qui télécharge le PDF. Pour un autre : GET /documents/:id/telechargement.
      urlTelechargement: document.urlPdf
        ? await this.urlSigneeDeTelechargement(document)
        : null,
    };
  }

  private async traduireErreur(
    erreur: unknown,
    etablissementId: string,
    cleIdempotence?: string,
  ) {
    if (estErreurUnicite(erreur)) {
      // Course d'idempotence : la requête jumelle (même clé) vient de créer le
      // document. On renvoie ce document, comme pour un simple rejeu.
      if (cleIdempotence) {
        const existant = await this.trouverParCle(
          etablissementId,
          cleIdempotence,
        );
        if (existant) return this.versReponse(existant);
      }
      throw new ConflictException({
        message: 'Conflit de numérotation. Réessayez.',
        code: 'NUMERO_DEJA_UTILISE',
      });
    }
    throw erreur;
  }
}
