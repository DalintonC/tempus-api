import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
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

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { profiles?: { profile_type: UserType; is_active: boolean }[] } }>();
    const { user } = request;

    if (!user?.profiles?.length) {
      throw new ForbiddenException('No user profiles found');
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      user.profiles?.some((profile) => profile.profile_type === role && profile.is_active),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(`Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
