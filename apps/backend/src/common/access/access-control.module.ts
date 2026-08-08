import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { AccessControlService } from './access-control.service';

/**
 * Global so every feature module can enforce record ownership without each one
 * importing the employees module (and risking a circular dependency).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Employee])],
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
