import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { plancherProchainNumero } from '../documents/plancher-numero.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { extensionDepuisMime } from '../storage/image-upload.options.js';
import type { MettreAJourEtablissementDto } from './dto/mettre-a-jour-etablissement.dto.js';
import { enteteParDefaut, recalerEntete } from './entete-officielle.js';

export type TypeImageEtablissement = 'logo' | 'signature' | 'cachet';

const TYPES_IMAGE_VALIDES: readonly TypeImageEtablissement[] = [
  'logo',
  'signature',
  'cachet',
];

const AVEC_ANNEE_ACTIVE = {
  include: { anneeScolaireActive: true },
} satisfies Prisma.EtablissementDefaultArgs;
type EtablissementAvecAnneeActive = Prisma.EtablissementGetPayload<
  typeof AVEC_ANNEE_ACTIVE
>;

@Injectable()
export class EtablissementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async recuperer(etablissementId: string) {
    const etablissement = await this.prisma.etablissement.findUniqueOrThrow({
      where: { id: etablissementId },
      ...AVEC_ANNEE_ACTIVE,
    });

    return this.versReponse(etablissement);
  }

  /** Valeurs d'en-tête calculées par les règles officielles (aperçu pour le front, sans écriture). */
  enteteParDefaut(
    ordreEnseignement: Parameters<typeof enteteParDefaut>[0],
    departement: string,
  ) {
    return enteteParDefaut(ordreEnseignement, departement);
  }

  async mettreAJour(
    etablissementId: string,
    dtoRecu: MettreAJourEtablissementDto,
  ) {
    const dto = await this.avecEnteteRecale(etablissementId, dtoRecu);

    // Le numéro (ou le format qui le met en forme) change : on vérifie qu'aucune
    // référence déjà attribuée ne peut être redonnée. Sinon, mise à jour simple.
    const toucheLaNumerotation =
      dto.prochainNumero !== undefined || dto.formatReference !== undefined;

    const etablissement = toucheLaNumerotation
      ? await this.mettreAJourNumerotation(etablissementId, dto)
      : await this.prisma.etablissement.update({
          where: { id: etablissementId },
          data: dto,
          ...AVEC_ANNEE_ACTIVE,
        });

    return this.versReponse(etablissement);
  }

  /**
   * Si l'ordre ou le département change, les champs d'en-tête restés
   * automatiques suivent ; ceux que le Directeur a personnalisés (ou envoyés
   * dans la même requête) ne sont jamais écrasés — cf. `recalerEntete`.
   */
  private async avecEnteteRecale(
    etablissementId: string,
    dto: MettreAJourEtablissementDto,
  ): Promise<MettreAJourEtablissementDto> {
    if (dto.ordreEnseignement === undefined && dto.departement === undefined) {
      return dto;
    }
    const actuel = await this.prisma.etablissement.findUniqueOrThrow({
      where: { id: etablissementId },
      select: {
        ordreEnseignement: true,
        departement: true,
        ministereTutelle: true,
        directionDepartementale: true,
        devise: true,
      },
    });
    return { ...dto, ...recalerEntete(actuel, dto) };
  }

  /**
   * Les références émises sont définitives (annulées comprises) : le prochain
   * numéro ne peut pas redescendre sous le dernier numéro déjà attribué.
   *
   * La ligne de l'établissement est verrouillée (FOR UPDATE) le temps de la
   * vérification : une génération de document en cours (qui incrémente le même
   * compteur) est attendue, puis comptée — pas de course entre « je lis le plus
   * grand numéro » et « j'écris le nouveau compteur ».
   */
  private mettreAJourNumerotation(
    etablissementId: string,
    dto: MettreAJourEtablissementDto,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT "id" FROM "etablissements" WHERE "id" = ${etablissementId} FOR UPDATE`;

      const actuel = await tx.etablissement.findUniqueOrThrow({
        where: { id: etablissementId },
        select: {
          formatReference: true,
          prochainNumero: true,
          anneeScolaireActive: { select: { libelle: true } },
        },
      });

      // Valeurs d'après la mise à jour : celles envoyées, sinon celles en base.
      const plancher = await plancherProchainNumero(
        tx,
        etablissementId,
        dto.formatReference ?? actuel.formatReference,
        actuel.anneeScolaireActive?.libelle ?? null,
      );
      const prochainNumero = dto.prochainNumero ?? actuel.prochainNumero;

      if (prochainNumero < plancher) {
        throw new ConflictException({
          message: `Le prochain numéro doit être au moins ${plancher} : le numéro ${plancher - 1} a déjà été attribué (même pour un document annulé).`,
          code: 'PROCHAIN_NUMERO_TROP_BAS',
          prochainNumeroMinimum: plancher,
        });
      }

      return tx.etablissement.update({
        where: { id: etablissementId },
        data: dto,
        ...AVEC_ANNEE_ACTIVE,
      });
    });
  }

  static estTypeImageValide(valeur: string): valeur is TypeImageEtablissement {
    return (TYPES_IMAGE_VALIDES as readonly string[]).includes(valeur);
  }

  async televerserImage(
    etablissementId: string,
    type: TypeImageEtablissement,
    fichier?: Express.Multer.File,
  ) {
    if (!fichier) {
      throw new BadRequestException('Aucun fichier reçu.');
    }

    const extension = extensionDepuisMime(fichier.mimetype);
    const chemin = `etablissements/${etablissementId}/${type}.${extension}`;
    await this.storage.televerser(chemin, fichier.buffer, fichier.mimetype);

    const champ = `${type}Chemin` as const;
    const etablissement = await this.prisma.etablissement.update({
      where: { id: etablissementId },
      data: { [champ]: chemin },
      ...AVEC_ANNEE_ACTIVE,
    });

    return this.versReponse(etablissement);
  }

  /**
   * Résout logoChemin/signatureChemin/cachetChemin en URLs signées fraîches
   * à chaque lecture — jamais mises en cache au-delà de la requête (elles
   * expirent, cf. StorageService).
   */
  private async versReponse(etablissement: EtablissementAvecAnneeActive) {
    const [logoUrl, signatureUrl, cachetUrl] = await Promise.all([
      etablissement.logoChemin
        ? this.storage.obtenirUrlSignee(etablissement.logoChemin)
        : Promise.resolve(null),
      etablissement.signatureChemin
        ? this.storage.obtenirUrlSignee(etablissement.signatureChemin)
        : Promise.resolve(null),
      etablissement.cachetChemin
        ? this.storage.obtenirUrlSignee(etablissement.cachetChemin)
        : Promise.resolve(null),
    ]);

    return {
      id: etablissement.id,
      nom: etablissement.nom,
      ordreEnseignement: etablissement.ordreEnseignement,
      departement: etablissement.departement,
      commune: etablissement.commune,
      adresse: etablissement.adresse,
      numeroAgrement: etablissement.numeroAgrement,
      telephone: etablissement.telephone,
      email: etablissement.email,
      logoUrl,
      directionDepartementale: etablissement.directionDepartementale,
      ministereTutelle: etablissement.ministereTutelle,
      devise: etablissement.devise,
      nomSignataire: etablissement.nomSignataire,
      fonctionSignataire: etablissement.fonctionSignataire,
      signatureUrl,
      cachetUrl,
      formatReference: etablissement.formatReference,
      prochainNumero: etablissement.prochainNumero,
      lieuParDefaut: etablissement.lieuParDefaut,
      anneeScolaireActive: etablissement.anneeScolaireActive,
    };
  }
}
