import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { Request } from './entities/request.entity';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [TypeOrmModule.forFeature([Request]), EmployeesModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
