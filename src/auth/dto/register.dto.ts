import {
  IsEmail,
  IsPhoneNumber,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { UserType } from '../types/auth.types';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsPhoneNumber('US')
  phone: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @IsEnum(UserType)
  profileType: UserType;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;
}
