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

  /**
   * Upload and return the object's PATH inside the bucket — deliberately not a
   * public URL.
   *
   * This used to return `getPublicUrl(...)`, which was then stored on the
   * document row. In a public bucket that hands every employment contract,
   * payslip and ID proof a permanent, unauthenticated link: anyone with the URL
   * reads it, no login, forever. Callers now persist the path and mint a
   * short-lived signed URL at read time (see `getSignedUrl`), so access stays
   * tied to being logged in and expires on its own.
   */
  async uploadFile(path: string, file: Buffer, mimeType: string): Promise<string> {
    const { data, error } = await this.client()
      .storage.from(this.bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });

    if (error) throw this.describe(error, 'Upload');
    return data.path;
  }

  /**
   * Turn a storage failure into something the caller can act on.
   *
   * supabase-js collapses every transport problem into the single string
   * "fetch failed", which surfaced as an opaque 500. The most common causes are
   * environmental, not code: a TLS-intercepting corporate proxy whose root CA
   * Node doesn't trust, or a missing bucket. Name them.
   */
  private describe(error: { message?: string }, action: string): Error {
    const raw = error?.message ?? 'unknown error';

    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|certificate|self.signed/i.test(raw)) {
      this.logger.error(
        `${action} could not reach Supabase Storage (${raw}). If this network intercepts TLS, ` +
          'point NODE_EXTRA_CA_CERTS at the proxy root CA so Node trusts the chain.',
      );
      return new ServiceUnavailableException(
        'Could not reach file storage. The server could not establish a secure connection to Supabase.',
      );
    }

    if (/bucket not found|not found/i.test(raw)) {
      this.logger.error(`${action} failed: bucket "${this.bucket}" not found`);
      return new ServiceUnavailableException(`Storage bucket "${this.bucket}" does not exist.`);
    }

    this.logger.error(`${action} failed: ${raw}`);
    return new Error(`${action} failed: ${raw}`);
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

    if (error) throw this.describe(error, 'Signed URL');
    return data.signedUrl;
  }

  /**
   * Signed URLs for many objects at once, keyed by path. Used when listing a
   * document set so one screen doesn't cost one round trip per file. Never
   * throws: a file that can't be signed simply has no link, which is better
   * than failing the whole list.
   */
  async getSignedUrls(paths: string[], expiresInSeconds = 3600): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const unique = [...new Set(paths.filter(Boolean))];
    if (!unique.length || !this.supabase) return out;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrls(unique, expiresInSeconds);
      if (error) {
        this.logger.error(`Batch signed URLs failed: ${error.message}`);
        return out;
      }
      for (const row of data ?? []) {
        if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
      }
    } catch (err: any) {
      this.logger.error(`Batch signed URLs failed: ${err?.message}`);
    }
    return out;
  }
}
