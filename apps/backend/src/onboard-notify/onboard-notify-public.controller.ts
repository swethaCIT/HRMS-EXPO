import { BadRequestException, Body, Controller, Get, Param, Post, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { OnboardNotifyPublicService } from './onboard-notify-public.service';
import { PublicSubmitFormDto } from './dto/public-submit-form.dto';
import { OnboardingTokenGuard } from './guards/onboarding-token.guard';
import { CurrentOnboardingRecord } from './decorators/current-onboarding-record.decorator';
import { OnboardingRecord } from './entities/onboarding-record.entity';
import { renderOnboardingFormPage } from './onboard-notify-public.page';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * Public, unauthenticated endpoints for the candidate-facing onboarding form.
 * No JwtAuthGuard anywhere here — access is scoped entirely by
 * OnboardingTokenGuard to the single onboarding record the link token
 * resolves to. Rate-limited tighter than the app default against
 * token-guessing attempts.
 */
@ApiExcludeController()
@Controller('onboard-notify/public')
export class OnboardNotifyPublicController {
  constructor(private readonly service: OnboardNotifyPublicService) {}

  /** The page the candidate actually clicks from email. Always 200s — validity is resolved client-side via /data so an expired link renders a friendly message instead of a raw 404. */
  @Get(':token')
  page(@Res() res: Response) {
    res.type('html').send(renderOnboardingFormPage());
  }

  @Get(':token/data')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(OnboardingTokenGuard)
  getData(@CurrentOnboardingRecord() record: OnboardingRecord) {
    return this.service.getData(record);
  }

  @Post(':token/submit')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(OnboardingTokenGuard)
  submit(@CurrentOnboardingRecord() record: OnboardingRecord, @Body() dto: PublicSubmitFormDto) {
    return this.service.submit(record, dto);
  }

  @Post(':token/documents')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(OnboardingTokenGuard)
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
}
