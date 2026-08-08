import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProjectStatus } from '../entities/project.entity';
import { TeamAccessLevel } from '../entities/project-team.entity';
import { SprintStatus } from '../entities/sprint.entity';
import { WorkItemState, WorkItemType } from '../entities/work-item.entity';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Short code, e.g. ATLAS. Derived from the name when omitted.' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class CreateTeamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerName?: string;
}

export class AddTeamMemberDto {
  @ApiProperty({ description: 'Employee id (from GET /employees)' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Display name, denormalised so rosters render without a join' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Squad role, e.g. Developer / QA / Tech Lead' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    enum: TeamAccessLevel,
    description: 'What this member may do. Defaults to `contribute`.',
  })
  @IsOptional()
  @IsEnum(TeamAccessLevel)
  accessLevel?: TeamAccessLevel;

  @ApiPropertyOptional({ description: 'Planning capacity, hours per day', default: 8 })
  @IsOptional()
  @IsNumber()
  capacityHoursPerDay?: number;
}

/** Adds several people to a team in one call (the mobile picker sends a batch). */
export class AddTeamMembersDto {
  @ApiProperty({ type: [AddTeamMemberDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddTeamMemberDto)
  members: AddTeamMemberDto[];
}

export class UpdateTeamMemberDto {
  @ApiPropertyOptional({ enum: TeamAccessLevel })
  @IsOptional()
  @IsEnum(TeamAccessLevel)
  accessLevel?: TeamAccessLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacityHoursPerDay?: number;
}

export class CreateSprintDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: SprintStatus })
  @IsOptional()
  @IsEnum(SprintStatus)
  status?: SprintStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;
}

export class UpdateSprintDto extends PartialType(CreateSprintDto) {}

export class CreateWorkItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ enum: WorkItemType })
  @IsEnum(WorkItemType)
  type: WorkItemType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: WorkItemState })
  @IsOptional()
  @IsEnum(WorkItemState)
  state?: WorkItemState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sprintId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeName?: string;

  @ApiPropertyOptional({ description: '1 (highest) … 4 (lowest)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  storyPoints?: number;

  @ApiPropertyOptional({ description: 'Hours' })
  @IsOptional()
  @IsNumber()
  originalEstimate?: number;

  @ApiPropertyOptional({ description: 'Hours' })
  @IsOptional()
  @IsNumber()
  remainingWork?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class UpdateWorkItemDto extends PartialType(CreateWorkItemDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  completedWork?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetStateDto {
  @ApiProperty({ enum: WorkItemState })
  @IsEnum(WorkItemState)
  state: WorkItemState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class LogWorkDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.25)
  hours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Defaults to the caller when omitted.' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeName?: string;

  @ApiPropertyOptional({ description: 'Remaining hours after this entry.' })
  @IsOptional()
  @IsNumber()
  remainingWork?: number;
}
