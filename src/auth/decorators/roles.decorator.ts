import { SetMetadata } from '@nestjs/common';
import { UserType } from '../types/auth.types';

export const Roles = (...roles: UserType[]) => SetMetadata('roles', roles);
