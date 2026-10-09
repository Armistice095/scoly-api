import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Etablissement, Prisma, Utilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { VerificationService } from '../verification/verification.service.js';
import type { InscriptionDto } from './dto/inscription.dto.js';
import type { ConnexionDto } from './dto/connexion.dto.js';
import type { ReinitialiserMotDePasseDto } from './dto/reinitialiser-mot-de-passe.dto.js';
import type { MettreAJourProfilDto } from './dto/mettre-a-jour-profil.dto.js';
import type { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto.js';
import type { MettreAJourNotificationsDto } from './dto/mettre-a-jour-notifications.dto.js';
import type {
  JwtPayloadAcces,
  JwtPayloadReset,
} from './interfaces/jwt-payload.interface.js';

const TOURS_BCRYPT = 10;
/** Durée du refresh token quand "Rester connecté" n'est pas coché. */
const DUREE_REFRESH_SESSION_COURTE = '1d';
/** Durée du jeton de réinitialisation de mot de passe, doit rester courte. */
const DUREE_RESET_TOKEN = '10m';

/** Champs sûrs à renvoyer au front — jamais motDePasseHash. */
function versUtilisateurPublic(utilisateur: Utilisateur) {
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    nomComplet: utilisateur.nomComplet,
    fonction: utilisateur.fonction,
    telephone: utilisateur.telephone,
    role: utilisateur.role,
    emailVerifie: utilisateur.emailVerifieLe !== null,
    actif: utilisateur.actif,
    notifDocumentGenere: utilisateur.notifDocumentGenere,
    notifInvitationAcceptee: utilisateur.notifInvitationAcceptee,
  };
}

/**
 * @nestjs/jwt type `expiresIn` en `number | StringValue` (gabarit du genre
 * "15m"/"7d"), pas en `string` générique. Comme la durée vient d'une
 * variable d'environnement (donc typée `string` par ConfigService), on
 * l'affirme explicitement ici plutôt que de désactiver le typage partout.
 * La vraie validation du format ("15m", "7d", ...) se fait au runtime par
 * la librairie elle-même, qui lève une erreur claire si le format est invalide.
 */
function dureeJwt(valeur: string): JwtSignOptions['expiresIn'] {
  return valeur as JwtSignOptions['expiresIn'];
}

function versEtablissementPublic(etablissement: Etablissement) {
  return {
    id: etablissement.id,
    nom: etablissement.nom,
    ordreEnseignement: etablissement.ordreEnseignement,
    departement: etablissement.departement,
    commune: etablissement.commune,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly verification: VerificationService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Crée l'établissement et son compte administrateur (inactif), puis
   * envoie le code d'activation par e-mail. Ne renvoie pas de tokens :
   * le compte doit d'abord être activé (cf. verifierActivation).
   */
  async inscrire(dto: InscriptionDto): Promise<{ email: string }> {
    if (dto.motDePasse !== dto.confirmationMotDePasse) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    const utilisateurExistant = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    if (utilisateurExistant) {
      if (utilisateurExistant.emailVerifieLe) {
        throw new ConflictException('Un compte existe déjà avec cet e-mail.');
      }
      // Compte déjà créé mais jamais activé (probablement un e-mail perdu ou
      // un abandon en cours de route) : on ne le recrée pas silencieusement
      // (ça permettrait à quelqu'un d'autre d'écraser le mot de passe d'un
      // compte en attente), on oriente vers le renvoi de code.
      throw new ConflictException({
        message:
          "Un compte existe déjà avec cet e-mail mais n'est pas encore activé.",
        code: 'COMPTE_EN_ATTENTE_ACTIVATION',
      });
    }

    const motDePasseHash = await bcrypt.hash(dto.motDePasse, TOURS_BCRYPT);

    const utilisateur = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const etablissement = await tx.etablissement.create({
          data: {
            nom: dto.nomEtablissement,
            ordreEnseignement: dto.ordreEnseignement,
            departement: dto.departement,
            commune: dto.commune,
          },
        });

        return tx.utilisateur.create({
          data: {
            etablissementId: etablissement.id,
            nomComplet: dto.nomComplet,
            fonction: dto.fonction,
            email: dto.email,
            telephone: dto.telephone,
            motDePasseHash,
            // Toujours explicite, jamais le default du schéma (MEMBRE) : la
            // personne qui inscrit l'établissement en devient le Directeur.
            role: 'DIRECTEUR',
          },
        });
      },
    );

    const code = await this.verification.genererCode(
      utilisateur.id,
      'ACTIVATION_COMPTE',
    );
    await this.mail.envoyerCodeVerification(
      utilisateur.email,
      code,
      'activation',
    );

    return { email: utilisateur.email };
  }

  /**
   * Valide le code d'activation et connecte automatiquement l'utilisateur
   * (évite de lui redemander son mot de passe juste après l'inscription).
   */
  async verifierActivation(email: string, code: string) {
    const utilisateur = await this.trouverUtilisateurParEmailOuEchouer(email);

    if (!utilisateur.emailVerifieLe) {
      await this.verification.verifierCode(
        utilisateur.id,
        'ACTIVATION_COMPTE',
        code,
      );
      await this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: { emailVerifieLe: new Date() },
      });
    }

    return this.construireReponseConnexion(utilisateur.id);
  }

  /**
   * Renvoie un nouveau code d'activation. Répond par un message générique
   * même si le compte est introuvable ou déjà activé, pour rester cohérent
   * avec le comportement du reste du flux (aucune info exploitée côté
   * front n'en dépend, le bouton "Renvoyer le code" affiche juste ce
   * message).
   */
  async renvoyerCodeActivation(email: string): Promise<{ message: string }> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    const message =
      "Si ce compte existe et est en attente d'activation, un nouveau code a été envoyé.";

    if (!utilisateur || utilisateur.emailVerifieLe) {
      return { message };
    }

    const code = await this.verification.genererCode(
      utilisateur.id,
      'ACTIVATION_COMPTE',
    );
    await this.mail.envoyerCodeVerification(
      utilisateur.email,
      code,
      'activation',
    );

    return { message };
  }

  async connecter(dto: ConnexionDto) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    const motDePasseValide = utilisateur?.motDePasseHash
      ? await bcrypt.compare(dto.motDePasse, utilisateur.motDePasseHash)
      : false;

    // Même message que l'utilisateur existe ou non / que le mot de passe
    // soit faux : ne pas révéler laquelle des deux infos est incorrecte.
    if (!utilisateur || !motDePasseValide) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }

    if (!utilisateur.emailVerifieLe) {
      throw new ForbiddenException({
        message: "Ce compte n'est pas encore activé. Vérifiez votre e-mail.",
        code: 'COMPTE_NON_ACTIVE',
      });
    }

    if (!utilisateur.actif) {
      throw new ForbiddenException({
        message:
          "Ce compte a été désactivé. Contactez le directeur de l'établissement.",
        code: 'COMPTE_DESACTIVE',
      });
    }

    return this.construireReponseConnexion(
      utilisateur.id,
      dto.resterConnecte ?? false,
    );
  }

  /**
   * Toujours un message générique, que l'e-mail corresponde ou non à un
   * compte : sinon on permet à n'importe qui de découvrir quels e-mails
   * sont enregistrés sur la plateforme.
   */
  async demanderResetMotDePasse(email: string): Promise<{ message: string }> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    const message =
      'Si un compte existe avec cette adresse, un code de vérification a été envoyé.';

    if (!utilisateur) {
      return { message };
    }

    const code = await this.verification.genererCode(
      utilisateur.id,
      'RESET_MOT_DE_PASSE',
    );
    await this.mail.envoyerCodeVerification(
      utilisateur.email,
      code,
      'reset_mot_de_passe',
    );

    return { message };
  }

  /**
   * Valide le code de reset et renvoie un jeton de courte durée à usage
   * fonctionnel unique, à présenter à /mot-de-passe-oublie/reinitialiser.
   * Évite d'avoir à ressaisir/revalider le code à l'étape suivante.
   */
  async verifierCodeResetMotDePasse(
    email: string,
    code: string,
  ): Promise<{ resetToken: string }> {
    const utilisateur = await this.trouverUtilisateurParEmailOuEchouer(email);
    await this.verification.verifierCode(
      utilisateur.id,
      'RESET_MOT_DE_PASSE',
      code,
    );

    const payload: JwtPayloadReset = {
      sub: utilisateur.id,
      but: 'reset_mot_de_passe',
    };
    const resetToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: DUREE_RESET_TOKEN,
    });

    return { resetToken };
  }

  async reinitialiserMotDePasse(
    dto: ReinitialiserMotDePasseDto,
  ): Promise<{ message: string }> {
    if (dto.nouveauMotDePasse !== dto.confirmationMotDePasse) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    let payload: JwtPayloadReset;
    try {
      payload = await this.jwt.verifyAsync<JwtPayloadReset>(dto.resetToken, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException(
        'Ce lien de réinitialisation est invalide ou a expiré.',
      );
    }

    if (payload.but !== 'reset_mot_de_passe') {
      throw new BadRequestException(
        'Ce lien de réinitialisation est invalide ou a expiré.',
      );
    }

    const motDePasseHash = await bcrypt.hash(
      dto.nouveauMotDePasse,
      TOURS_BCRYPT,
    );

    await this.prisma.utilisateur.update({
      where: { id: payload.sub },
      data: { motDePasseHash },
    });

    return { message: 'Mot de passe mis à jour.' };
  }

  async rafraichir(refreshToken: string) {
    let payload: JwtPayloadAcces;
    try {
      payload = await this.jwt.verifyAsync<JwtPayloadAcces>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Session expirée, veuillez vous reconnecter.',
      );
    }

    // On revérifie que le compte existe toujours et est actif (il a pu être
    // désactivé entre-temps) plutôt que de faire confiance aveuglément au token.
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
    });
    if (!utilisateur || !utilisateur.actif) {
      throw new UnauthorizedException(
        'Session expirée, veuillez vous reconnecter.',
      );
    }

    return this.construireReponseConnexion(utilisateur.id);
  }

  async mettreAJourProfil(utilisateurId: string, dto: MettreAJourProfilDto) {
    const utilisateur = await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: dto,
    });

    return versUtilisateurPublic(utilisateur);
  }

  async changerMotDePasse(
    utilisateurId: string,
    dto: ChangerMotDePasseDto,
  ): Promise<{ message: string }> {
    if (dto.nouveauMotDePasse !== dto.confirmationMotDePasse) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
    });

    const motDePasseActuelValide = utilisateur.motDePasseHash
      ? await bcrypt.compare(dto.motDePasseActuel, utilisateur.motDePasseHash)
      : false;

    if (!motDePasseActuelValide) {
      throw new BadRequestException('Mot de passe actuel incorrect.');
    }

    const motDePasseHash = await bcrypt.hash(
      dto.nouveauMotDePasse,
      TOURS_BCRYPT,
    );
    await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: { motDePasseHash },
    });

    return { message: 'Mot de passe mis à jour.' };
  }

  async mettreAJourNotifications(
    utilisateurId: string,
    dto: MettreAJourNotificationsDto,
  ) {
    const utilisateur = await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: dto,
    });

    return versUtilisateurPublic(utilisateur);
  }

  /**
   * Construit une session (tokens) pour un utilisateur déjà authentifié par
   * un autre moyen que email+mot de passe — activation de compte, ou
   * acceptation d'invitation par EquipeService. Le mot de passe n'est
   * jamais revérifié ici : l'appelant garantit déjà l'identité.
   */
  async connecterUtilisateurParId(utilisateurId: string) {
    return this.construireReponseConnexion(utilisateurId);
  }

  private async trouverUtilisateurParEmailOuEchouer(
    email: string,
  ): Promise<Utilisateur> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    if (!utilisateur) {
      // Même message que "code invalide" : un e-mail qui ne correspond à
      // rien ne doit pas se distinguer d'un mauvais code aux yeux du front.
      throw new BadRequestException('Code invalide ou expiré.');
    }
    return utilisateur;
  }

  private async construireReponseConnexion(
    utilisateurId: string,
    resterConnecte = false,
  ) {
    const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      include: { etablissement: true },
    });

    const payload: JwtPayloadAcces = {
      sub: utilisateur.id,
      etablissementId: utilisateur.etablissementId,
      role: utilisateur.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: dureeJwt(
        this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      ),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: dureeJwt(
        resterConnecte
          ? (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d')
          : DUREE_REFRESH_SESSION_COURTE,
      ),
    });

    return {
      utilisateur: versUtilisateurPublic(utilisateur),
      etablissement: versEtablissementPublic(utilisateur.etablissement),
      accessToken,
      refreshToken,
    };
  }
}
