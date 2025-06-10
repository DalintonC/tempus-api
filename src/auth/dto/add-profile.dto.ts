import { IsEnum, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { UserType } from '../types/auth.types';

export class AddProfileDto {
  @IsEnum(UserType)
  profileType: UserType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;
}
