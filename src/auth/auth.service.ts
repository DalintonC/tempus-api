import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../database/supabase.service';
import { UserType, JwtPayload, UserProfile, SupabaseUser } from './types/auth.types';
import { RegisterDto, RequestOtpDto, VerifyOtpDto, SwitchProfileDto, AddProfileDto } from './dto';

export interface AuthResponse {
  user: SupabaseUser & { profiles?: UserProfile[] };
  token: string;
  supabaseSession?: any;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private supabaseService: SupabaseService,
  ) {}

  async startRegistration(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, phone, fullName, profileType, profilePictureUrl } = registerDto;

    try {
      // Check if user already exists with this phone
      const { data: existingProfile } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('user_id')
        .eq('phone', phone)
        .single();

      if (existingProfile) {
        throw new ConflictException('User with this phone already exists');
      }

      // Prepare registration metadata
      const registrationData = {
        phone,
        fullName,
        profileType,
        profilePictureUrl: profilePictureUrl || null,
        registrationStep: 'pending_verification',
        registrationTimestamp: new Date().toISOString(),
      };

      // Use Supabase Auth to send OTP via email
      const { error } = await this.supabaseService.getClient().auth.signUp({
        email,
        password: this.generateTemporaryPassword(),
        options: {
          data: registrationData,
          emailRedirectTo: undefined, // We're using OTP, not email links
        },
      });

      if (error) {
        if (error.message.includes('already been registered')) {
          throw new ConflictException('User with this email already exists');
        }
        this.logger.error('Supabase signup error:', error);
        throw new BadRequestException(`Registration failed: ${error.message}`);
      }

      this.logger.log(`Registration OTP sent to ${email}`);
      return {
        message: `Verification code sent to ${email}. Please check your email and verify to complete registration.`,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Registration error:', error);
      throw new InternalServerErrorException('Registration failed');
    }
  }

  async completeRegistration(verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    const { email, token, type } = verifyOtpDto;

    try {
      // Verify OTP with Supabase
      const { data, error } = await this.supabaseService.getClient().auth.verifyOtp({
        email,
        token,
        type: type,
      });

      if (error) {
        this.logger.warn(`OTP verification failed for ${email}: ${error.message}`);
        throw new UnauthorizedException('Invalid or expired verification code');
      }

      const { user: supabaseUser, session } = data;

      if (!supabaseUser) {
        throw new UnauthorizedException('User verification failed');
      }

      // Get registration data from user metadata
      const registrationData = supabaseUser.user_metadata as {
        fullName: string;
        profileType: UserType;
        phone: string;
        profilePictureUrl?: string;
        registrationStep?: string;
        [key: string]: any;
      };

      if (!registrationData?.registrationStep) {
        throw new BadRequestException('Registration data not found or expired');
      }

      // Create user profile in our custom table
      const insertResult = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .insert({
          user_id: supabaseUser.id,
          profile_type: registrationData.profileType,
          full_name: registrationData.fullName,
          phone: registrationData.phone,
          profile_picture_url: registrationData.profilePictureUrl,
          is_active: true,
        })
        .select()
        .single();
      const profileData = insertResult.data as UserProfile;
      const profileError = insertResult.error;

      if (!profileData) {
        this.logger.error('Profile creation error: No data returned');
        throw new InternalServerErrorException('Profile creation failed');
      }
      const profile: UserProfile = profileData;

      if (profileError) {
        this.logger.error('Profile creation error:', profileError);
        throw new InternalServerErrorException('Profile creation failed');
      }

      // Update user metadata to mark registration as complete
      await this.supabaseService.getServiceClient().auth.admin.updateUserById(supabaseUser.id, {
        user_metadata: {
          ...registrationData,
          registrationStep: 'completed',
          completedAt: new Date().toISOString(),
        },
      });

      // Generate custom JWT token
      const customToken = this.generateCustomToken({
        sub: supabaseUser.id,
        email: supabaseUser.email!,
        profiles: [profile],
        activeProfile: profile.profile_type,
      });

      this.logger.log(`Registration completed for user ${supabaseUser.id}`);

      return {
        user: {
          ...supabaseUser,
          email: supabaseUser.email ?? '',
          updated_at: supabaseUser.updated_at ?? '',
          profiles: [profile],
        },
        token: customToken,
        supabaseSession: session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Registration completion error:', error);
      throw new InternalServerErrorException('Registration completion failed');
    }
  }

  async requestLoginOtp(requestOtpDto: RequestOtpDto): Promise<{ message: string }> {
    const { email } = requestOtpDto;

    try {
      // Use Supabase Auth to send magic link/OTP
      const { error } = await this.supabaseService.getClient().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        this.logger.warn(`Login OTP request failed for ${email}: ${error.message}`);
        throw new UnauthorizedException('User not found or error sending login code');
      }

      this.logger.log(`Login OTP sent to ${email}`);
      return {
        message: `Login code sent to ${email}. Please check your email.`,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Login OTP request error:', error);
      throw new InternalServerErrorException('Failed to send login code');
    }
  }

  async verifyLoginOtp(verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    const { email, token, type } = verifyOtpDto;

    try {
      // Verify OTP with Supabase
      const { data, error } = await this.supabaseService.getClient().auth.verifyOtp({
        email,
        token,
        type: type,
      });

      if (error) {
        this.logger.warn(`Login OTP verification failed for ${email}: ${error.message}`);
        throw new UnauthorizedException('Invalid or expired verification code');
      }

      const { user: supabaseUser, session } = data;

      if (!supabaseUser) {
        throw new UnauthorizedException('Login verification failed');
      }

      // Get user profiles from our custom table
      const { data: profiles, error: profileError } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .eq('is_active', true);

      if (profileError) {
        this.logger.error('Profile fetch error during login:', profileError);
        throw new InternalServerErrorException('Failed to load user profiles');
      }

      if (!profiles?.length) {
        throw new UnauthorizedException('No active user profiles found');
      }

      // Generate custom JWT token
      const customToken = this.generateCustomToken({
        sub: supabaseUser.id,
        email: supabaseUser.email!,
        profiles: profiles as UserProfile[],
        activeProfile: (profiles as UserProfile[])[0].profile_type,
      });

      this.logger.log(`Login successful for user ${supabaseUser.id}`);

      return {
        user: {
          ...supabaseUser,
          email: supabaseUser.email ?? '',
          updated_at: supabaseUser.updated_at ?? '',
          profiles,
        },
        token: customToken,
        supabaseSession: session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Login verification error:', error);
      throw new InternalServerErrorException('Login verification failed');
    }
  }

  async switchProfile(
    userId: string,
    switchProfileDto: SwitchProfileDto,
  ): Promise<{ token: string }> {
    const { profileType } = switchProfileDto;

    try {
      // Get all user profiles
      const { data: profilesRaw, error } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      const profiles = profilesRaw as UserProfile[] | null;

      if (error) {
        this.logger.error('Profile fetch error during switch:', error);
        throw new InternalServerErrorException('Failed to load user profiles');
      }

      if (!profiles?.length) {
        throw new UnauthorizedException('No active profiles found');
      }

      const targetProfile = profiles.find((p) => p.profile_type === profileType);
      if (!targetProfile) {
        throw new UnauthorizedException('Requested profile not found or inactive');
      }

      // Get user email for token
      const { data: userData, error: userError } = await this.supabaseService
        .getServiceClient()
        .auth.admin.getUserById(userId);

      if (userError || !userData.user) {
        this.logger.error('User fetch error during profile switch:', userError);
        throw new UnauthorizedException('User not found');
      }

      // Generate new token with switched active profile
      const token = this.generateCustomToken({
        sub: userId,
        email: userData.user.email!,
        profiles,
        activeProfile: profileType,
      });

      this.logger.log(`Profile switched to ${profileType} for user ${userId}`);
      return { token };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Profile switch error:', error);
      throw new InternalServerErrorException('Profile switch failed');
    }
  }

  async addProfile(
    userId: string,
    addProfileDto: AddProfileDto,
  ): Promise<{ profile: UserProfile }> {
    const { profileType, fullName, profilePictureUrl } = addProfileDto;

    try {
      // Check if profile already exists
      const { data: existing } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('profile_type', profileType)
        .single();

      if (existing) {
        throw new ConflictException('Profile type already exists for this user');
      }

      // Get current user data for defaults
      const { data: currentProfile } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('full_name, phone')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .single<{ full_name: string; phone: string }>();

      // Create new profile
      const insertResult = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .insert({
          user_id: userId,
          profile_type: profileType,
          full_name: fullName || currentProfile?.full_name || '',
          phone: currentProfile?.phone || '',
          profile_picture_url: profilePictureUrl,
          is_active: true,
        })
        .select()
        .single();
      const profile = insertResult.data as UserProfile;
      const error = insertResult.error;

      if (error) {
        this.logger.error('Profile creation error:', error);
        throw new InternalServerErrorException('Profile creation failed');
      }

      this.logger.log(`New ${profileType} profile created for user ${userId}`);
      return { profile };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Add profile error:', error);
      throw new InternalServerErrorException('Failed to add profile');
    }
  }

  async validateUser(payload: JwtPayload): Promise<any> {
    try {
      // Get user from Supabase Auth
      const { data: userData, error } = await this.supabaseService
        .getServiceClient()
        .auth.admin.getUserById(payload.sub);

      if (error || !userData.user) {
        throw new UnauthorizedException('User not found');
      }

      // Get current user profiles
      const { data: profiles, error: profileError } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('*')
        .eq('user_id', payload.sub)
        .eq('is_active', true);

      if (profileError) {
        this.logger.error('Profile validation error:', profileError);
        throw new UnauthorizedException('Failed to validate user profiles');
      }

      return {
        ...userData.user,
        profiles: profiles || [],
        activeProfile: payload.activeProfile,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('User validation error:', error);
      throw new UnauthorizedException('User validation failed');
    }
  }

  // Private helper methods
  private generateTemporaryPassword(): string {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + '!A1';
  }

  private generateCustomToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}
