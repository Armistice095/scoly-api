import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreerAnneeScolaireDto } from './dto/creer-annee-scolaire.dto.js';
import { formatRepartACadaAnnee } from '../../documents/numerotation.js';
import { plancherProchainNumero } from '../../documents/plancher-numero.js';
import type { ModifierAnneeScolaireDto } from './dto/modifier-annee-scolaire.dto.js';

@Injectable()
export class AnneeScolaireService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(etablissementId: string) {
    return this.prisma.anneeScolaire.findMany({
      where: { etablissementId },
      orderBy: { dateRentree: 'desc' },
    });
  }

  /** Crée une nouvelle année et la rend immédiatement active (cas d'usage courant : nouvelle rentrée). */
  async creer(etablissementId: string, dto: CreerAnneeScolaireDto) {
    this.validerDates(new Date(dto.dateRentree), new Date(dto.dateFin));

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const annee = await tx.anneeScolaire.create({
        data: {
          etablissementId,
          libelle: dto.libelle,
          dateRentree: new Date(dto.dateRentree),
          dateFin: new Date(dto.dateFin),
        },
      });

      // Nouvelle année : si le format de référence porte l'année ({ANNEE}),
      // la numérotation des documents repart (N°1/2026-2027…). On la calcule
      // plutôt que de forcer 1 : si une année du même libellé existe déjà, on
      // reprend après son dernier numéro au lieu de redonner des références.
      const { formatReference } = await tx.etablissement.findUniqueOrThrow({
        where: { id: etablissementId },
        select: { formatReference: true },
      });
      const prochainNumero = formatRepartACadaAnnee(formatReference)
        ? await plancherProchainNumero(
            tx,
            etablissementId,
            formatReference,
            annee.libelle,
          )
        : undefined;
      await tx.etablissement.update({
        where: { id: etablissementId },
        data: {
          anneeScolaireActiveId: annee.id,
          ...(prochainNumero !== undefined ? { prochainNumero } : {}),
        },
      });

      return annee;
    });
  }

  async modifier(
    etablissementId: string,
    anneeId: string,
    dto: ModifierAnneeScolaireDto,
  ) {
    const annee = await this.trouverOuEchouer(etablissementId, anneeId);

    const dateRentree = dto.dateRentree
      ? new Date(dto.dateRentree)
      : annee.dateRentree;
    const dateFin = dto.dateFin ? new Date(dto.dateFin) : annee.dateFin;
    this.validerDates(dateRentree, dateFin);

    return this.prisma.anneeScolaire.update({
      where: { id: anneeId },
      data: { libelle: dto.libelle, dateRentree, dateFin },
    });
  }

  /**
   * Réactive une année déjà existante (ex. écran "années passées" — revenir sur
   * une année antérieure). Si le format porte l'année, le compteur reprend
   * APRÈS le dernier numéro déjà émis pour cette année : sans ça il garderait la
   * valeur de l'année précédemment active et redonnerait des références prises.
   */
  async activer(etablissementId: string, anneeId: string) {
    const annee = await this.trouverOuEchouer(etablissementId, anneeId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { formatReference } = await tx.etablissement.findUniqueOrThrow({
        where: { id: etablissementId },
        select: { formatReference: true },
      });
      const prochainNumero = formatRepartACadaAnnee(formatReference)
        ? await plancherProchainNumero(
            tx,
            etablissementId,
            formatReference,
            annee.libelle,
          )
        : undefined;

      return tx.etablissement.update({
        where: { id: etablissementId },
        data: {
          anneeScolaireActiveId: anneeId,
          ...(prochainNumero !== undefined ? { prochainNumero } : {}),
        },
        include: { anneeScolaireActive: true },
      });
    });
  }

  private validerDates(dateRentree: Date, dateFin: Date): void {
    if (dateFin <= dateRentree) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de rentrée.',
      );
    }
  }

  // Toujours filtrer par etablissementId, jamais juste par id : empêche un
  // Directeur d'un établissement d'agir sur les données d'un autre.
  private async trouverOuEchouer(etablissementId: string, anneeId: string) {
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { id: anneeId, etablissementId },
    });

    if (!annee) {
      throw new NotFoundException('Année scolaire introuvable.');
    }

    return annee;
  }
}
