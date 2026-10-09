import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { InscriptionDto } from './dto/inscription.dto.js';
import { ConnexionDto } from './dto/connexion.dto.js';
import { EmailDto } from './dto/email.dto.js';
import { VerifierCodeDto } from './dto/verifier-code.dto.js';
import { ReinitialiserMotDePasseDto } from './dto/reinitialiser-mot-de-passe.dto.js';
import { RafraichirTokenDto } from './dto/rafraichir-token.dto.js';
import { MettreAJourProfilDto } from './dto/mettre-a-jour-profil.dto.js';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto.js';
import { MettreAJourNotificationsDto } from './dto/mettre-a-jour-notifications.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import type { JwtPayloadAcces } from './interfaces/jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('inscription')
  inscrire(@Body() dto: InscriptionDto) {
    return this.authService.inscrire(dto);
  }

  @Post('activation/verifier')
  @HttpCode(HttpStatus.OK)
  verifierActivation(@Body() dto: VerifierCodeDto) {
    return this.authService.verifierActivation(dto.email, dto.code);
  }

  @Post('activation/renvoyer')
  @HttpCode(HttpStatus.OK)
  renvoyerCodeActivation(@Body() dto: EmailDto) {
    return this.authService.renvoyerCodeActivation(dto.email);
  }

  @Post('connexion')
  @HttpCode(HttpStatus.OK)
  connecter(@Body() dto: ConnexionDto) {
    return this.authService.connecter(dto);
  }

  @Post('mot-de-passe-oublie')
  @HttpCode(HttpStatus.OK)
  demanderResetMotDePasse(@Body() dto: EmailDto) {
    return this.authService.demanderResetMotDePasse(dto.email);
  }

  @Post('mot-de-passe-oublie/verifier')
  @HttpCode(HttpStatus.OK)
  verifierCodeResetMotDePasse(@Body() dto: VerifierCodeDto) {
    return this.authService.verifierCodeResetMotDePasse(dto.email, dto.code);
  }

  @Post('mot-de-passe-oublie/reinitialiser')
  @HttpCode(HttpStatus.OK)
  reinitialiserMotDePasse(@Body() dto: ReinitialiserMotDePasseDto) {
    return this.authService.reinitialiserMotDePasse(dto);
  }

  @Post('rafraichir')
  @HttpCode(HttpStatus.OK)
  rafraichir(@Body() dto: RafraichirTokenDto) {
    return this.authService.rafraichir(dto.refreshToken);
  }

  @Patch('profil')
  @UseGuards(JwtAuthGuard)
  mettreAJourProfil(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: MettreAJourProfilDto,
  ) {
    return this.authService.mettreAJourProfil(utilisateur.sub, dto);
  }

  @Patch('mot-de-passe')
  @UseGuards(JwtAuthGuard)
  changerMotDePasse(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: ChangerMotDePasseDto,
  ) {
    return this.authService.changerMotDePasse(utilisateur.sub, dto);
  }

  @Patch('notifications')
  @UseGuards(JwtAuthGuard)
  mettreAJourNotifications(
    @UtilisateurCourant() utilisateur: JwtPayloadAcces,
    @Body() dto: MettreAJourNotificationsDto,
  ) {
    return this.authService.mettreAJourNotifications(utilisateur.sub, dto);
  }
}
