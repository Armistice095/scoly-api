import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MailModule } from '../mail/mail.module.js';
import { VerificationModule } from '../verification/verification.module.js';

@Module({
  imports: [
    // Pas de secret/expiration par défaut ici : chaque signAsync/verifyAsync
    // dans AuthService et JwtAuthGuard précise explicitement quel secret
    // utiliser (accès vs refresh), pour ne jamais mélanger les deux.
    JwtModule.register({}),
    MailModule,
    VerificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
