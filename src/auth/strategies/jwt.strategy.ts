/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('app.jwtSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    console.log('JWT Payload received:', payload);
    try {
      const user = await this.authService.validateUser(payload);
      console.log('Validated user:', user);
      return user;
    } catch (error) {
      console.log('JWT validation error:', error);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
