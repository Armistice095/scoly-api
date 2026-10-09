import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { creerExceptionChamps } from '../common/validation/erreurs-validation.js';
import { verifierDateInscription } from './validators/est-date-inscription.validator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreerEleveDto } from './dto/creer-eleve.dto.js';
import type { ModifierEleveDto } from './dto/modifier-eleve.dto.js';
import type { ListerElevesQueryDto } from './dto/lister-eleves-query.dto.js';
import {
  dateDepuisTexte,
  estErreurUnicite,
  versDonneesCreation,
  versReponse,
} from './eleves.mapper.js';
import {
  construireTexteRecherche,
  motsDeRecherche,
} from './utils/recherche.js';

@Injectable()
export class ElevesService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(etablissementId: string, query: ListerElevesQueryDto) {
    const { page, limit } = query;
    const where = this.construireFiltre(etablissementId, query);

    const [total, eleves] = await this.prisma.$transaction([
      this.prisma.eleve.count({ where }),
      this.prisma.eleve.findMany({
        where,
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: eleves.map(versReponse),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Fiche élève, avec les documents déjà établis pour lui (vide tant que le module Documents n'existe pas). */
  async recuperer(etablissementId: string, eleveId: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: eleveId, etablissementId },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            numeroUnique: true,
            statut: true,
            createdAt: true,
            typeDocument: { select: { code: true, nom: true } },
          },
        },
      },
    });

    if (!eleve) {
      throw new NotFoundException('Élève introuvable.');
    }

    const { documents, ...donnees } = eleve;
    return { ...versReponse(donnees), documents };
  }

  async creer(etablissementId: string, dto: CreerEleveDto) {
    await this.verifierMatriculesLibres(etablissementId, dto);
    if (!dto.confirmerDoublon) {
      await this.verifierDoublonPossible(etablissementId, dto);
    }

    try {
      const eleve = await this.prisma.eleve.create({
        data: versDonneesCreation(etablissementId, dto),
      });
      return versReponse(eleve);
    } catch (erreur) {
      throw this.traduireErreurUnicite(erreur);
    }
  }

  async modifier(
    etablissementId: string,
    eleveId: string,
    dto: ModifierEleveDto,
  ) {
    const existant = await this.trouverOuEchouer(etablissementId, eleveId);

    await this.verifierMatriculesLibres(etablissementId, dto, eleveId);
    this.verifierCoherenceDates(existant, dto);

    const identiteModifiee =
      dto.nom !== undefined ||
      dto.prenoms !== undefined ||
      dto.dateNaissance !== undefined;
    if (identiteModifiee && !dto.confirmerDoublon) {
      await this.verifierDoublonPossible(
        etablissementId,
        {
          nom: dto.nom ?? existant.nom,
          prenoms: dto.prenoms ?? existant.prenoms,
          dateNaissance:
            dto.dateNaissance ??
            existant.dateNaissance.toISOString().slice(0, 10),
        },
        eleveId,
      );
    }

    // Seuls les champs présents dans la requête sont écrits : `undefined` =
    // inchangé, `null` (champs facultatifs uniquement) = effacé.
    // `confirmerDoublon` n'est jamais persisté.
    const data: Prisma.EleveUncheckedUpdateInput = {
      matricule: dto.matricule,
      matriculeEducMaster: dto.matriculeEducMaster,
      nom: dto.nom,
      prenoms: dto.prenoms,
      sexe: dto.sexe,
      dateNaissance:
        dto.dateNaissance !== undefined
          ? dateDepuisTexte(dto.dateNaissance)
          : undefined,
      lieuNaissance: dto.lieuNaissance,
      parentTuteur: dto.parentTuteur,
      telephone: dto.telephone,
      adresse: dto.adresse,
      classe: dto.classe,
      dateInscription:
        dto.dateInscription === undefined
          ? undefined
          : dto.dateInscription === null
            ? null
            : dateDepuisTexte(dto.dateInscription),
      // Dérivé des valeurs finales (envoyées ou déjà en base) : toujours recalculé.
      rechercheNormalisee: construireTexteRecherche({
        nom: dto.nom ?? existant.nom,
        prenoms: dto.prenoms ?? existant.prenoms,
        matricule:
          dto.matricule !== undefined ? dto.matricule : existant.matricule,
        matriculeEducMaster:
          dto.matriculeEducMaster !== undefined
            ? dto.matriculeEducMaster
            : existant.matriculeEducMaster,
        classe: dto.classe !== undefined ? dto.classe : existant.classe,
      }),
    };

    try {
      const eleve = await this.prisma.eleve.update({
        where: { id: eleveId },
        data,
      });
      return versReponse(eleve);
    } catch (erreur) {
      throw this.traduireErreurUnicite(erreur);
    }
  }

  /**
   * La date d'inscription doit rester postérieure à la naissance, même quand
   * un seul des deux champs est envoyé (le DTO ne voit que ce qui est dans la
   * requête ; ici on compare avec les valeurs fusionnées).
   */
  private verifierCoherenceDates(
    existant: { dateNaissance: Date; dateInscription: Date | null },
    dto: ModifierEleveDto,
  ) {
    if (dto.dateInscription === undefined && dto.dateNaissance === undefined) {
      return;
    }
    const inscription =
      dto.dateInscription !== undefined
        ? dto.dateInscription
        : (existant.dateInscription?.toISOString().slice(0, 10) ?? null);
    if (!inscription) return;

    const naissance =
      dto.dateNaissance ?? existant.dateNaissance.toISOString().slice(0, 10);
    const message = verifierDateInscription(inscription, naissance);
    if (message) {
      throw creerExceptionChamps([{ champ: 'dateInscription', message }]);
    }
  }

  private construireFiltre(
    etablissementId: string,
    query: ListerElevesQueryDto,
  ): Prisma.EleveWhereInput {
    // « adjaho nad » : chaque mot doit se retrouver dans le texte de recherche
    // de l'élève (nom, prénoms, matricules), quel que soit l'ordre des mots.
    // Texte et mots sont normalisés pareil (sans accents ni casse).
    const mots = motsDeRecherche(query.search ?? '');

    return {
      etablissementId,
      ...(query.statut ? { statut: query.statut } : {}),
      ...(mots.length > 0
        ? {
            AND: mots.map((mot) => ({
              rechercheNormalisee: { contains: mot },
            })),
          }
        : {}),
    };
  }

  // Toujours filtrer par etablissementId, jamais juste par id : empêche un
  // utilisateur d'un établissement d'agir sur les élèves d'un autre.
  private async trouverOuEchouer(etablissementId: string, eleveId: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: eleveId, etablissementId },
    });

    if (!eleve) {
      throw new NotFoundException('Élève introuvable.');
    }

    return eleve;
  }

  /** Vérification « amicale » avant écriture ; la contrainte unique en base reste le filet de sécurité contre les courses. */
  private async verifierMatriculesLibres(
    etablissementId: string,
    champs: { matricule?: string | null; matriculeEducMaster?: string | null },
    eleveIdExclu?: string,
  ) {
    const { matricule, matriculeEducMaster } = champs;
    const conditions: Prisma.EleveWhereInput[] = [];
    if (matricule) {
      conditions.push({
        matricule: { equals: matricule, mode: 'insensitive' },
      });
    }
    if (matriculeEducMaster) {
      conditions.push({
        matriculeEducMaster: {
          equals: matriculeEducMaster,
          mode: 'insensitive',
        },
      });
    }
    if (conditions.length === 0) return;

    const conflits = await this.prisma.eleve.findMany({
      where: {
        etablissementId,
        ...(eleveIdExclu ? { id: { not: eleveIdExclu } } : {}),
        OR: conditions,
      },
      select: { matricule: true, matriculeEducMaster: true },
    });

    const egal = (a?: string | null, b?: string | null) =>
      !!a && !!b && a.toLowerCase() === b.toLowerCase();

    if (conflits.some((c) => egal(c.matricule, matricule))) {
      throw new ConflictException({
        message: 'Ce matricule est déjà attribué à un autre élève.',
        code: 'MATRICULE_DEJA_UTILISE',
      });
    }
    if (
      conflits.some((c) => egal(c.matriculeEducMaster, matriculeEducMaster))
    ) {
      throw new ConflictException({
        message: 'Ce matricule EducMaster est déjà attribué à un autre élève.',
        code: 'MATRICULE_EDUCMASTER_DEJA_UTILISE',
      });
    }
  }

  /** Même nom + prénoms + date de naissance : probablement un doublon. Bloque sauf confirmation explicite (`confirmerDoublon`). */
  private async verifierDoublonPossible(
    etablissementId: string,
    identite: { nom: string; prenoms: string; dateNaissance: string },
    eleveIdExclu?: string,
  ) {
    const homonyme = await this.prisma.eleve.findFirst({
      where: {
        etablissementId,
        ...(eleveIdExclu ? { id: { not: eleveIdExclu } } : {}),
        nom: { equals: identite.nom, mode: 'insensitive' },
        prenoms: { equals: identite.prenoms, mode: 'insensitive' },
        dateNaissance: dateDepuisTexte(identite.dateNaissance),
      },
      select: { id: true },
    });

    if (homonyme) {
      throw new ConflictException({
        message:
          'Un élève avec le même nom, les mêmes prénoms et la même date de naissance existe déjà.',
        code: 'ELEVE_DOUBLON_POSSIBLE',
      });
    }
  }

  private traduireErreurUnicite(erreur: unknown): unknown {
    if (estErreurUnicite(erreur)) {
      return new ConflictException({
        message: 'Un élève avec ce matricule existe déjà.',
        code: 'MATRICULE_DEJA_UTILISE',
      });
    }
    return erreur;
  }
}
