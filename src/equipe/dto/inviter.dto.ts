import { IsEmail, IsString, MinLength } from 'class-validator';

export class InviterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fonction!: string;
}
