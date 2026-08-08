import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipAudit } from '../audit/skip-audit.decorator';
import { User, UserRole } from './entities/user.entity';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // user management is admin-only
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @SkipAudit() // UsersService records these with the subject and field diffs
  create(@Body() dto: CreateUserDto, @CurrentUser() me: User) {
    return this.usersService.create(dto, actorOf(me));
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @SkipAudit() // UsersService records these with the subject and field diffs
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: User) {
    return this.usersService.update(id, dto, actorOf(me));
  }

  @Delete(':id')
  @SkipAudit() // UsersService records these with the subject and field diffs
  remove(@Param('id') id: string, @CurrentUser() me: User) {
    return this.usersService.remove(id, actorOf(me));
  }
}

/** The signed-in user, in the shape the audit log wants. */
function actorOf(u?: User) {
  return { id: u?.id, name: u?.email?.split('@')[0], role: u?.role };
}
