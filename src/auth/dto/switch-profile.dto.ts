import { IsEnum } from 'class-validator';
import { UserType } from '../types/auth.types';

export class SwitchProfileDto {
  @IsEnum(UserType)
  profileType: UserType;
}
