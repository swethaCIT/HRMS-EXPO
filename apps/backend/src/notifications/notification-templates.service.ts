import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplate } from './entities/notification-template.entity';
import { renderTemplate } from './template.util';

@Injectable()
export class NotificationTemplatesService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
  ) {}

  async render(key: string, vars: Record<string, string>): Promise<{ subject: string; body: string }> {
    const template = await this.templateRepo.findOne({ where: { key } });
    if (!template) throw new NotFoundException(`Notification template "${key}" is not configured`);
    return {
      subject: renderTemplate(template.subject, vars),
      body: renderTemplate(template.body, vars),
    };
  }
}
