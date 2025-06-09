export enum UserType {
  CLIENT = 'client',
  BUSINESS = 'business',
  EMPLOYEE = 'employee',
}

export interface UserProfile {
  id: string;
  userId: string;
  profileType: UserType;
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  profiles: UserProfile[];
  activeProfile?: UserType;
}
