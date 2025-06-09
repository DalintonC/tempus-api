import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private serviceClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('database.supabaseUrl');
    const supabaseKey = this.configService.get<string>('database.supabaseKey');
    const serviceKey = this.configService.get<string>('database.supabaseServiceKey');

    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      throw new Error('Supabase configuration is missing required values.');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    this.serviceClient = createClient(supabaseUrl, serviceKey);
  }

  // Client for user-scoped operations (RLS applies)
  getClient(): SupabaseClient {
    return this.client;
  }

  // Service client for admin operations (bypasses RLS)
  getServiceClient(): SupabaseClient {
    return this.serviceClient;
  }

  // Set user context for RLS
  setUser(token: string): SupabaseClient {
    void this.client.auth.setSession({
      access_token: token,
      refresh_token: '',
    });
    return this.client;
  }
}
