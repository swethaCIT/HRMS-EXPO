import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { clampPaging, MAX_LIMIT } from '../common/utils/pagination';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const employee = this.employeeRepo.create({
      ...dto,
      user: { id: dto.userId },
    });
    return this.employeeRepo.save(employee);
  }

  // The directory is identical for every viewer and changes rarely, so a short
  // cache absorbs the read-heavy list traffic instead of round-tripping the DB
  // on every request. Bounded 15s TTL keeps it fresh enough for a headcount list.
  async findAll(limit?: number, offset?: number): Promise<Employee[]> {
    const { take, skip } = clampPaging(limit, offset);
    const key = `employees:list:${take}:${skip}`;
    const cached = await this.cache.get<Employee[]>(key);
    if (cached) return cached;
    const rows = await this.employeeRepo.find({
      relations: { user: true },
      order: { employeeId: 'ASC' },
      take,
      skip,
    });
    await this.cache.set(key, rows, 15_000);
    return rows;
  }

  /**
   * Resolve many employees in ONE query, keyed by id.
   *
   * The calendar previously called `findOne` per participant: rendering a
   * 50-person meeting cost ~51 round trips on a screen that polls every 20s,
   * and the per-minute reminder cron did events x participants lookups on every
   * tick against a 20-connection pool.
   */
  async findManyByIds(ids: string[]): Promise<Map<string, Employee>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const rows = await this.employeeRepo.find({
      where: { id: In(unique) },
      relations: { user: true },
    });
    return new Map(rows.map((e) => [e.id, e]));
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepo.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
  }

  /** True only if every id in `ids` maps to an existing employee — used to validate meeting participant lists. */
  async existsAll(ids: string[]): Promise<boolean> {
    if (!ids.length) return true;
    const count = await this.employeeRepo.count({ where: { id: In(ids) } });
    return count === ids.length;
  }

  /**
   * Typeahead search across name/employee code/department, paginated by
   * page+limit (unlike `findAll`'s limit/offset) to match a picker UI that
   * shows page numbers rather than infinite scroll.
   */
  async search(
    q?: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: Employee[]; total: number; page: number; limit: number }> {
    const take = Math.min(
      Math.max(1, limit && limit > 0 ? limit : 20),
      MAX_LIMIT,
    );
    const currentPage = Math.max(1, page && page > 0 ? page : 1);
    const skip = (currentPage - 1) * take;

    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user');
    const term = q?.trim();
    if (term) {
      qb.where(
        'e.firstName ILIKE :q OR e.lastName ILIKE :q OR e.employeeId ILIKE :q OR e.department ILIKE :q',
        {
          q: `%${term}%`,
        },
      );
    }
    qb.orderBy('e.firstName', 'ASC').skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: currentPage, limit: take };
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    await this.findOne(id);
    await this.employeeRepo.update(id, dto);
    return this.findOne(id);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<void> {
    await this.employeeRepo.update(id, { avatarUrl });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.employeeRepo.delete(id);
  }
}
