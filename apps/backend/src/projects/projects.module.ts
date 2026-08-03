import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectTeam, ProjectTeamMember } from './entities/project-team.entity';
import { Sprint } from './entities/sprint.entity';
import { WorkItem } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { Employee } from '../employees/entities/employee.entity';
import { ProjectsService } from './projects.service';
import { SprintsService } from './sprints.service';
import { WorkItemsService } from './work-items.service';
import { ReportsService } from './reports.service';
import { ProjectsController } from './projects.controller';
import { SprintsController } from './sprints.controller';
import { WorkItemsController } from './work-items.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectTeam, ProjectTeamMember, Sprint, WorkItem, WorkLog, Employee]),
    NotificationsModule,
    MailModule,
  ],
  controllers: [ProjectsController, SprintsController, WorkItemsController],
  providers: [ProjectsService, SprintsService, WorkItemsService, ReportsService],
  exports: [ProjectsService, WorkItemsService],
})
export class ProjectsModule {}
