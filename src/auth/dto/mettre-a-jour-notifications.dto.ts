import { IsBoolean, IsOptional } from 'class-validator';

export class MettreAJourNotificationsDto {
  @IsOptional()
  @IsBoolean()
  notifDocumentGenere?: boolean;

  @IsOptional()
  @IsBoolean()
  notifInvitationAcceptee?: boolean;
}
