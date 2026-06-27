import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
    this.bucket = this.config.get<string>('SUPABASE_BUCKET', 'hrms-files');
  }

  async uploadFile(path: string, file: Buffer, mimeType: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucket).remove([path]);
    if (error) this.logger.error(`Delete failed: ${error.message}`);
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) throw new Error(`Signed URL failed: ${error.message}`);
    return data.signedUrl;
  }
}
