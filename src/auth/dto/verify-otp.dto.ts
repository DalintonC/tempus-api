import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  token: string;

  @IsEnum(['signup', 'magiclink'])
  type: 'signup' | 'magiclink';
}
