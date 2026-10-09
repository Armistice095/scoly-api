import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { aplatirErreurs } from '../../common/validation/erreurs-validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreerEleveDto } from '../dto/creer-eleve.dto.js';
import {
  dateDepuisTexte,
  estErreurUnicite,
  versDonneesCreation,
} from '../eleves.mapper.js';
import { normaliserTexte } from './colonnes.js';
import { lireFichierExcel } from './lecture-excel.js';
import { genererModeleExcel } from './modele-excel.js';

export interface ErreurLigneImport {
  ligne: number;
  messages: string[];
}

const cleIdentite = (nom: string, prenoms: string, dateNaissance: string) =>
  `${normaliserTexte(nom)}|${normaliserTexte(prenoms)}|${dateNaissance}`;

@Injectable()
export class ElevesImportService {
  constructor(private readonly prisma: PrismaService) {}

  genererModele(): Promise<Buffer> {
    return genererModeleExcel();
  }

  /**
   * Import « tout ou rien » : si UNE ligne est invalide, rien n'est écrit et
   * la réponse liste toutes les erreurs par numéro de ligne Excel, pour
   * corriger le fichier en une seule passe.
   */
  async importer(etablissementId: string, fichier?: Express.Multer.File) {
    if (!fichier) {
      throw new BadRequestException({
        message: 'Aucun fichier reçu.',
        code: 'FICHIER_INVALIDE',
      });
    }

    const lignes = await lireFichierExcel(fichier.buffer);

    const erreurs = new Map<number, string[]>();
    const ajouterErreur = (ligne: number, message: string) =>
      erreurs.set(ligne, [...(erreurs.get(ligne) ?? []), message]);

    // 1. Mêmes règles que la création unitaire (CreerEleveDto).
    const valides: { ligne: number; dto: CreerEleveDto }[] = [];
    for (const { ligne, valeurs } of lignes) {
      const dto = plainToInstance(CreerEleveDto, valeurs);
      const problemes = validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (problemes.length > 0) {
        for (const { message } of aplatirErreurs(problemes)) {
          ajouterErreur(ligne, message);
        }
      } else {
        valides.push({ ligne, dto });
      }
    }

    // 2. Doublons à l'intérieur du fichier.
    this.detecterDoublonsDansFichier(valides, ajouterErreur);

    // 3. Doublons avec les élèves déjà enregistrés (une seule requête).
    await this.detecterDoublonsEnBase(etablissementId, valides, ajouterErreur);

    if (erreurs.size > 0) {
      const detail: ErreurLigneImport[] = [...erreurs.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ligne, messages]) => ({ ligne, messages }));

      throw new BadRequestException({
        message: `Le fichier contient des erreurs sur ${detail.length} ligne(s). Aucun élève n'a été importé.`,
        code: 'IMPORT_INVALIDE',
        erreurs: detail,
      });
    }

    try {
      const { count } = await this.prisma.eleve.createMany({
        data: valides.map(({ dto }) =>
          versDonneesCreation(etablissementId, dto),
        ),
      });
      return { importes: count };
    } catch (erreur) {
      // Course : un élève avec le même matricule a été créé entre la
      // vérification et l'écriture. La transaction implicite de createMany
      // garantit qu'aucune ligne n'a été insérée.
      if (estErreurUnicite(erreur)) {
        throw new ConflictException({
          message:
            "Un matricule du fichier vient d'être attribué à un autre élève. Aucun élève n'a été importé ; réessayez.",
          code: 'IMPORT_CONFLIT',
        });
      }
      throw erreur;
    }
  }

  private detecterDoublonsDansFichier(
    valides: { ligne: number; dto: CreerEleveDto }[],
    ajouterErreur: (ligne: number, message: string) => void,
  ) {
    const vus = {
      matricule: new Map<string, number>(),
      educmaster: new Map<string, number>(),
      identite: new Map<string, number>(),
    };

    for (const { ligne, dto } of valides) {
      const controles: [
        Map<string, number>,
        string | null | undefined,
        string,
      ][] = [
        [vus.matricule, dto.matricule?.toLowerCase(), 'Matricule'],
        [
          vus.educmaster,
          dto.matriculeEducMaster?.toLowerCase(),
          'Matricule EducMaster',
        ],
        [
          vus.identite,
          cleIdentite(dto.nom, dto.prenoms, dto.dateNaissance),
          'Élève (même nom, prénoms et date de naissance)',
        ],
      ];

      for (const [registre, cle, libelle] of controles) {
        if (!cle) continue;
        const premiere = registre.get(cle);
        if (premiere !== undefined) {
          ajouterErreur(
            ligne,
            `${libelle} déjà présent à la ligne ${premiere} du fichier.`,
          );
        } else {
          registre.set(cle, ligne);
        }
      }
    }
  }

  private async detecterDoublonsEnBase(
    etablissementId: string,
    valides: { ligne: number; dto: CreerEleveDto }[],
    ajouterErreur: (ligne: number, message: string) => void,
  ) {
    if (valides.length === 0) return;

    const matricules = valides.flatMap(({ dto }) => dto.matricule ?? []);
    const educMasters = valides.flatMap(
      ({ dto }) => dto.matriculeEducMaster ?? [],
    );
    const dates = [...new Set(valides.map(({ dto }) => dto.dateNaissance))].map(
      dateDepuisTexte,
    );

    const existants = await this.prisma.eleve.findMany({
      where: {
        etablissementId,
        OR: [
          { matricule: { in: matricules } },
          { matriculeEducMaster: { in: educMasters } },
          { dateNaissance: { in: dates } },
        ],
      },
      select: {
        matricule: true,
        matriculeEducMaster: true,
        nom: true,
        prenoms: true,
        dateNaissance: true,
      },
    });

    const matriculesPris = new Set(existants.flatMap((e) => e.matricule ?? []));
    const educMastersPris = new Set(
      existants.flatMap((e) => e.matriculeEducMaster ?? []),
    );
    const identitesPrises = new Set(
      existants.map((e) =>
        cleIdentite(
          e.nom,
          e.prenoms,
          e.dateNaissance.toISOString().slice(0, 10),
        ),
      ),
    );

    for (const { ligne, dto } of valides) {
      if (dto.matricule && matriculesPris.has(dto.matricule)) {
        ajouterErreur(
          ligne,
          'Ce matricule est déjà attribué à un autre élève.',
        );
      }
      if (
        dto.matriculeEducMaster &&
        educMastersPris.has(dto.matriculeEducMaster)
      ) {
        ajouterErreur(
          ligne,
          'Ce matricule EducMaster est déjà attribué à un autre élève.',
        );
      }
      if (
        identitesPrises.has(
          cleIdentite(dto.nom, dto.prenoms, dto.dateNaissance),
        )
      ) {
        ajouterErreur(
          ligne,
          'Un élève avec le même nom, les mêmes prénoms et la même date de naissance existe déjà.',
        );
      }
    }
  }
}
