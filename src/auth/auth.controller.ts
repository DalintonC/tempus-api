import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthResponse, AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AddProfileDto, RegisterDto, RequestOtpDto, SwitchProfileDto, VerifyOtpDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserProfile, UserType } from './types/auth.types';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start registration process',
    description: 'Initiates user registration and sends OTP via email',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Verification code sent to john@example.com' },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: RegisterDto })
  async startRegistration(@Body() registerDto: RegisterDto) {
    return this.authService.startRegistration(registerDto);
  }

  @Post('register/complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete registration with OTP',
    description: 'Verifies OTP and completes user registration',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration completed successfully',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        token: { type: 'string' },
        supabaseSession: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
  @ApiBody({ type: VerifyOtpDto })
  async completeRegistration(@Body() verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    return this.authService.completeRegistration(verifyOtpDto);
  }

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request login OTP',
    description: 'Sends login verification code via email',
  })
  @ApiResponse({
    status: 200,
    description: 'Login OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login code sent to john@example.com' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'User not found' })
  @ApiBody({ type: RequestOtpDto })
  async requestLoginOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestLoginOtp(requestOtpDto);
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with OTP',
    description: 'Verifies login OTP and returns authentication tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        token: { type: 'string' },
        supabaseSession: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyLoginOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<any> {
    return this.authService.verifyLoginOtp(verifyOtpDto);
  }

  @Post('profile/switch')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Switch active profile',
    description: 'Switches between available user profiles (client/business/employee)',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile switched successfully',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'New JWT token with switched profile' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Profile not found or unauthorized' })
  @ApiBody({ type: SwitchProfileDto })
  async switchProfile(
    @CurrentUser() user: { id: string },
    @Body() switchProfileDto: SwitchProfileDto,
  ) {
    return this.authService.switchProfile(user.id, switchProfileDto);
  }

  @Post('profile/add')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add new profile type',
    description: 'Adds a new profile type to existing user (e.g., client becomes employee)',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile added successfully',
    schema: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          description: 'Newly created profile data',
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Profile type already exists' })
  @ApiBody({ type: AddProfileDto })
  async addProfile(@CurrentUser() user: { id: string }, @Body() addProfileDto: AddProfileDto) {
    return this.authService.addProfile(user.id, addProfileDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns current user information and available profiles',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object', description: 'User data' },
        activeProfile: { type: 'string', enum: Object.values(UserType) },
        availableProfiles: {
          type: 'array',
          items: { type: 'object' },
          description: 'List of available user profiles',
        },
      },
    },
  })
  getProfile(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      email_confirmed_at: string | null;
      created_at: string;
      activeProfile: UserType;
      profiles?: UserProfile[];
    },
  ) {
    return {
      user: {
        id: user.id,
        email: user.email,
        emailConfirmedAt: user.email_confirmed_at,
        createdAt: user.created_at,
      },
      activeProfile: user.activeProfile,
      availableProfiles: user.profiles || [],
    };
  }
}
