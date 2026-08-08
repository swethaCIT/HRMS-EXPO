import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Storage for employee documents.
 *
 * The client is only created when BOTH the URL and a key are present.
 * `createClient` throws "supabaseKey is required" when the key is empty, and
 * because that happened in the constructor it took down the entire API at
 * boot — every unrelated module included — the moment SUPABASE_URL was set
 * without a key. File storage is an optional integration; it now degrades the
 * way Mail and Firebase already do: log once at startup, and fail only the
 * requests that actually need it.
 */
@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient | null = null;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    // Service role is required: the anon/publishable key is blocked by RLS for
    // server-side writes, so accepting it would fail confusingly at upload time.
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = this.config.get<string>('SUPABASE_BUCKET', 'hrms-files');

    if (url && key) {
      this.supabase = createClient(url, key);
      this.logger.log(`Supabase Storage ready (bucket: ${this.bucket})`);
    } else if (url && !key) {
      this.logger.warn(
        'SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing — file uploads are disabled. ' +
          'Add the service role key from Dashboard → Settings → API.',
      );
    } else {
      this.logger.warn('Supabase Storage not configured — file uploads are disabled');
    }
  }

  /** True when uploads can actually be performed. */
  get enabled(): boolean {
    return !!this.supabase;
  }

  private client(): SupabaseClient {
    if (!this.supabase) {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    return this.supabase;
  }

  async uploadFile(path: string, file: Buffer, mimeType: string): Promise<string> {
    const supabase = this.client();
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage.from(this.bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.supabase) return; // nothing was ever uploaded
    const { error } = await this.supabase.storage.from(this.bucket).remove([path]);
    if (error) this.logger.error(`Delete failed: ${error.message}`);
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client()
      .storage.from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) throw new Error(`Signed URL failed: ${error.message}`);
    return data.signedUrl;
  }
}
