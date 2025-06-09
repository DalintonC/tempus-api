import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserType } from '../types/auth.types';

export const ActiveProfile = createParamDecorator((data: UserType, ctx: ExecutionContext) => {
  interface Profile {
    profileType: UserType;
    isActive: boolean;
  }

  interface User {
    profiles?: Profile[];
    activeProfile?: UserType;
  }

  const request = ctx.switchToHttp().getRequest<{ user: User }>();
  const user = request.user;

  if (data) {
    return user.profiles?.find((p) => p.profileType === data && p.isActive);
  }

  return user.profiles?.find((p) => p.profileType === user.activeProfile);
});
