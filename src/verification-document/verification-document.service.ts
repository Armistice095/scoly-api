import { Injectable } from '@nestjs/common';
import { FORMAT_TOKEN_QR } from '../documents/qr-token.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CANDIDATS_MAX, type Resultat } from './constantes.js';
import type { VerifierDocumentDto } from './dto/verifier-document.dto.js';
import { JournalVerificationService } from './journal-verification.service.js';
import { lireRequete, type RequeteVerification } from './lire-requete.js';
import {
  correspondEtablissement,
  POUR_VERIFICATION,
  reponseAvecDocument,
  reponseSansDocument,
  type DocumentPourVerification,
  type ReponseVerification,
} from './verification-document.mapper.js';

@Injectable()
export class VerificationDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalVerificationService,
  ) {}

  /**
   * Vérifie un document. Lecture seule, sans authentification.
   *
   * Le statut est lu en base À CHAQUE appel (aucun cache) : un document annulé
   * dans les Archives est donc « Annulé » ici dès la requête suivante.
   */
  async verifier(
    dto: VerifierDocumentDto,
    ip: string | undefined,
  ): Promise<ReponseVerification> {
    const requete = lireRequete(dto); // 400 CHAMP_VIDE / FORMAT_INVALIDE
    const ipHash = this.journal.hacherIp(ip);

    if (requete.canal === 'SAISIE') {
      await this.journal.refuserSiTropDEchecs(ipHash); // 429
    }

    const verifieLe = new Date(); // heure du serveur, jamais celle du client
    const { reponse, documentId } = await this.chercher(requete, verifieLe);

    // Hors du chemin de réponse : le vérificateur n'attend pas le journal.
    void this.journal.enregistrer({
      canal: requete.canal,
      resultat: reponse.resultat,
      ipHash,
      documentId,
    });
    return reponse;
  }

  private async chercher(
    requete: RequeteVerification,
    verifieLe: Date,
  ): Promise<{ reponse: ReponseVerification; documentId: string | null }> {
    const introuvable = (resultat: 'INTROUVABLE' | 'AMBIGU') => ({
      reponse: reponseSansDocument(resultat, verifieLe),
      documentId: null,
    });
    const trouve = (document: DocumentPourVerification) => ({
      reponse: reponseAvecDocument(document, verifieLe),
      documentId: document.id,
    });

    if (requete.canal === 'QR') {
      // Un jeton qui ne peut pas être un des nôtres est « introuvable », comme
      // un jeton inconnu : mal formé et inexistant sont indiscernables.
      if (!FORMAT_TOKEN_QR.test(requete.token))
        return introuvable('INTROUVABLE');
      const document = await this.prisma.document.findUnique({
        where: { qrCodeToken: requete.token },
        ...POUR_VERIFICATION,
      });
      return document ? trouve(document) : introuvable('INTROUVABLE');
    }

    // Saisie : la référence n'est unique que PAR établissement.
    const candidats = await this.prisma.document.findMany({
      where: { referenceNormalisee: requete.reference },
      take: CANDIDATS_MAX,
      orderBy: { id: 'asc' }, // ordre stable
      ...POUR_VERIFICATION,
    });

    const retenus = requete.etablissement
      ? candidats.filter((c) =>
          correspondEtablissement(c, requete.etablissement!),
        )
      : candidats;

    if (retenus.length === 0) return introuvable('INTROUVABLE');
    // Plusieurs écoles (ou formats) pour cette référence : on ne tranche pas,
    // on ne divulgue rien. Le vérificateur scanne le QR ou précise l'école.
    if (retenus.length > 1) return introuvable('AMBIGU');
    return trouve(retenus[0]!);
  }
}

export type { Resultat };
