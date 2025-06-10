export enum UserType {
  CLIENT = 'client',
  BUSINESS = 'business',
  EMPLOYEE = 'employee',
}

export interface UserProfile {
  id: string;
  user_id: string;
  profile_type: UserType;
  full_name: string;
  phone: string;
  profile_picture_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  profiles: UserProfile[];
  activeProfile?: UserType;
  iat?: number;
  exp?: number;
}

export interface SupabaseUser {
  id: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  user_metadata?: any;
}
