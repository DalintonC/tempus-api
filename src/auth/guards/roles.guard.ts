import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '../types/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user: { profiles?: { profileType: UserType; isActive: boolean }[] } }>();
    const { user } = request;

    // Check if user has any of the required roles
    return requiredRoles.some((role) =>
      user.profiles?.some((profile) => profile.profileType === role && profile.isActive),
    );
  }
}
