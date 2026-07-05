import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidaysService } from './holidays.service';
import { HolidaysController } from './holidays.controller';
import { Holiday } from './entities/holiday.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Holiday])],
  controllers: [HolidaysController],
  providers: [HolidaysService],
  exports: [HolidaysService],
})
export class HolidaysModule {}
