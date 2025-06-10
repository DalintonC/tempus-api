import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private serviceClient: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('database.supabaseUrl');
    const supabaseKey = this.configService.get<string>('database.supabaseKey');
    const serviceKey = this.configService.get<string>('database.supabaseServiceKey');

    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    this.serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase clients initialized successfully');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getServiceClient(): SupabaseClient {
    return this.serviceClient;
  }

  setUserContext(token: string): SupabaseClient {
    const contextClient = createClient(
      this.configService.get<string>('database.supabaseUrl')!,
      this.configService.get<string>('database.supabaseKey')!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    );
    return contextClient;
  }
}
