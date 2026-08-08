import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiForbiddenResponse } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../common/access/access-control.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateAssetDto } from './dto/create-asset.dto';

/**
 * The company asset register. Employees see only what is assigned to them;
 * issuing and returning hardware is an HR/Admin action so nobody can quietly
 * mark a laptop returned that is still in their possession.
 */
@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly access: AccessControlService,
  ) {}

  @Get()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Full asset register (HR/Admin)' })
  findAll() {
    return this.assetsService.findAll();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Assets assigned to one employee', description: 'Your own, or anyone’s if you are HR/Admin.' })
  @ApiParam({ name: 'employeeId' })
  @ApiForbiddenResponse({ description: 'Not your assets' })
  async findByEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: User) {
    await this.access.assertSelfOr(user, employeeId, AccessControlService.ORG_WIDE, 'assets');
    return this.assetsService.findByEmployee(employeeId);
  }

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add an asset to the register (HR/Admin)' })
  create(@Body() dto: CreateAssetDto) {
    // The DTO carries an ISO date string; the column is a Date.
    return this.assetsService.create({
      ...dto,
      assignedDate: dto.assignedDate ? new Date(dto.assignedDate) : undefined,
    });
  }

  @Patch(':id/return')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark an asset returned (HR/Admin)' })
  @ApiParam({ name: 'id' })
  returnAsset(@Param('id') id: string) {
    return this.assetsService.returnAsset(id);
  }
}
