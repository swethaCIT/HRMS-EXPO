import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { OnboardNotifyPortalService } from './onboard-notify-portal.service';
import { OnboardingAuthService } from './onboarding-auth.service';
import { OnboardingLoginDto } from './dto/onboarding-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SaveSectionDto } from './dto/save-section.dto';
import { OnboardingSessionGuard } from './guards/onboarding-session.guard';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { CurrentOnboardingRecord } from './decorators/current-onboarding-record.decorator';
import { OnboardingRecord } from './entities/onboarding-record.entity';
import { renderOnboardingPortalPage } from './onboard-notify-portal.page';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * The candidate-facing onboarding portal. No JwtAuthGuard — access is a
 * completely separate, scoped identity (see OnboardingAuthService). Only
 * `login` runs with no guard at all; everything else requires a valid
 * session, and `change-password` is the one session-guarded route that must
 * still work while a temporary password is pending.
 */
@ApiExcludeController()
@Controller('onboard-notify/portal')
export class OnboardNotifyPortalController {
  constructor(
    private readonly service: OnboardNotifyPortalService,
    private readonly auth: OnboardingAuthService,
  ) {}

  /** The page the candidate opens from the invitation email — a static shell, login/session handled client-side via the JSON endpoints below. */
  @Get()
  page(@Res() res: Response) {
    // Set by the CSP-nonce middleware in main.ts — must match the nonce the
    // Content-Security-Policy header allows, or the page's own inline
    // <script> gets blocked by the browser.
    res.type('html').send(renderOnboardingPortalPage(res.locals.cspNonce));
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: OnboardingLoginDto) {
    const { record, token } = await this.auth.login(dto.loginId, dto.password);
    return { token, mustChangePassword: record.mustChangePassword };
  }

  @Post('change-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(OnboardingSessionGuard)
  @AllowPendingPasswordChange()
  async changePassword(@CurrentOnboardingRecord() record: OnboardingRecord, @Body() dto: ChangePasswordDto) {
    const token = await this.auth.changePassword(record, dto.currentPassword, dto.newPassword);
    return { token };
  }

  @Get('me')
  @UseGuards(OnboardingSessionGuard)
  dashboard(@CurrentOnboardingRecord() record: OnboardingRecord) {
    return this.service.dashboard(record);
  }

  @Put('sections/:key')
  @UseGuards(OnboardingSessionGuard)
  saveSection(@CurrentOnboardingRecord() record: OnboardingRecord, @Param('key') key: string, @Body() dto: SaveSectionDto) {
    return this.service.saveSection(record, key, dto.data);
  }

  @Post('submit')
  @UseGuards(OnboardingSessionGuard)
  submit(@CurrentOnboardingRecord() record: OnboardingRecord) {
    return this.service.submit(record);
  }

  @Post('documents')
  @UseGuards(OnboardingSessionGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Only JPEG, PNG, WEBP or PDF files are accepted'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadDocument(
    @CurrentOnboardingRecord() record: OnboardingRecord,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.uploadDocument(record, file, category);
  }

  @Delete('documents/:documentId')
  @UseGuards(OnboardingSessionGuard)
  removeDocument(@CurrentOnboardingRecord() record: OnboardingRecord, @Param('documentId') documentId: string) {
    return this.service.removeDocument(record, documentId);
  }
}
