import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.assetsService.findByEmployee(employeeId);
  }

  @Post()
  create(@Body() body: any) {
    return this.assetsService.create(body);
  }

  @Patch(':id/return')
  returnAsset(@Param('id') id: string) {
    return this.assetsService.returnAsset(id);
  }
}
