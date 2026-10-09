import { IsString } from 'class-validator';

export class RafraichirTokenDto {
  @IsString()
  refreshToken!: string;
}
