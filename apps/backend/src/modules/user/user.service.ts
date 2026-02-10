import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetUserResponseDto } from './dto/get-user-response.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BaseResponseDto } from 'src/common/base-response.dto';
import {
  ErrorCode,
  PaginationUtils,
  ResponseMessage,
  UserStatus,
  UserRole,
} from '@bakong/shared';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>
  ) {}

  async findByUsername(username: string) {
    try {
      let user = await this.repo
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.username',
          'user.email',
          'user.displayName',
          'user.role',
          'user.phoneNumber',
          'user.imageId',
          'user.mustChangePassword',
          'user.syncStatus',
          'user.createdAt',
          'user.updatedAt',
        ])
        .where('LOWER(user.username) = LOWER(:username)', { username })
        .andWhere('user.deletedAt IS NULL')
        .getOne();
      if (!user && !username.includes('@')) {
        user = await this.repo
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.username',
            'user.email',
            'user.displayName',
            'user.role',
            'user.phoneNumber',
            'user.imageId',
            'user.mustChangePassword',
            'user.syncStatus',
            'user.createdAt',
            'user.updatedAt',
          ])
          .where(
            "LOWER(SPLIT_PART(user.username, '@', 1)) = LOWER(:username)",
            { username }
          )
          .andWhere('user.deletedAt IS NULL')
          .getOne();
      }
      return user;
    } catch (error: any) {
      if (
        error.message?.includes('email') ||
        error.message?.includes('imageId') ||
        error.message?.includes('column')
      ) {
        let user = await this.repo
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.username',
            'user.displayName',
            'user.role',
            'user.phoneNumber',
            'user.mustChangePassword',
            'user.syncStatus',
            'user.createdAt',
            'user.updatedAt',
          ])
          .where('LOWER(user.username) = LOWER(:username)', { username })
          .andWhere('user.deletedAt IS NULL')
          .getOne();
        if (!user && !username.includes('@')) {
          user = await this.repo
            .createQueryBuilder('user')
            .select([
              'user.id',
              'user.username',
              'user.displayName',
              'user.role',
              'user.phoneNumber',
              'user.mustChangePassword',
              'user.syncStatus',
              'user.createdAt',
              'user.updatedAt',
            ])
            .where(
              "LOWER(SPLIT_PART(user.username, '@', 1)) = LOWER(:username)",
              { username }
            )
            .andWhere('user.deletedAt IS NULL')
            .getOne();
        }
        return user;
      }
      throw error;
    }
  }

  async findByUsernameWithPassword(username: string) {
    let user = await this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.mustChangePassword')
      .addSelect('user.syncStatus')
      .addSelect('user.status')
      .where('LOWER(user.username) = LOWER(:username)', { username })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
    if (!user && !username.includes('@')) {
      user = await this.repo
        .createQueryBuilder('user')
        .addSelect('user.password')
        .addSelect('user.mustChangePassword')
        .addSelect('user.syncStatus')
        .addSelect('user.status')
        .where("LOWER(SPLIT_PART(user.username, '@', 1)) = LOWER(:username)", {
          username,
        })
        .andWhere('user.deletedAt IS NULL')
        .getOne();
    }
    return user;
  }

  async findByEmail(email: string) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await this.repo
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.username',
          'user.email',
          'user.displayName',
          'user.role',
          'user.phoneNumber',
          'user.imageId',
          'user.mustChangePassword',
          'user.syncStatus',
          'user.createdAt',
          'user.updatedAt',
        ])
        .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
        .andWhere('user.deletedAt IS NULL')
        .getOne();
      return user;
    } catch (error: any) {
      if (
        error.message?.includes('email') ||
        error.message?.includes('imageId') ||
        error.message?.includes('column')
      ) {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.repo
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.username',
            'user.displayName',
            'user.role',
            'user.phoneNumber',
            'user.mustChangePassword',
            'user.syncStatus',
            'user.createdAt',
            'user.updatedAt',
          ])
          .where('LOWER(user.email) = LOWER(:email)', {
            email: normalizedEmail,
          })
          .andWhere('user.deletedAt IS NULL')
          .getOne();
        return user;
      }
      throw error;
    }
  }

  async findByEmailWithPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.mustChangePassword')
      .addSelect('user.syncStatus')
      .addSelect('user.status')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
    return user;
  }

  /**
   * Create a new user
   * @param dto - User creation data (password is required - Administrator must provide it)
   * @returns Created user entity
   */
  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const normalizedEmail = dto.email.toLowerCase();
    const derivedDisplayName =
      (dto.displayName && dto.displayName.trim()) ||
      (dto.username?.includes('@')
        ? dto.username.split('@')[0]
        : dto.username) ||
      (normalizedEmail.includes('@')
        ? normalizedEmail.split('@')[0]
        : normalizedEmail);
    let user = this.repo.create({
      ...dto,
      displayName: derivedDisplayName,
      email: normalizedEmail, // Normalize email to lowercase
      password: hashedPassword,
      status: UserStatus.ACTIVE, // ACTIVE so user can login immediately
      mustChangePassword: true, // User must change password on first login
    });
    user = await this.repo.save(user);
    return user;
  }

  /**
   * Helper method to safely update syncStatus JSONB field
   * Handles missing syncStatus by initializing with defaults
   */
  async updateSyncStatus(
    id: number,
    updates: {
      failLoginAttempt?: number;
      login_at?: string | null;
      changePassword_count?: number;
      tempPasswordLoginAttempts?: number;
    }
  ) {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'syncStatus'],
    });
    const currentSyncStatus = user?.syncStatus || {
      failLoginAttempt: 0,
      login_at: null,
      changePassword_count: 0,
      tempPasswordLoginAttempts: 0,
    };
    const updatedSyncStatus = {
      failLoginAttempt:
        updates.failLoginAttempt !== undefined
          ? updates.failLoginAttempt
          : currentSyncStatus.failLoginAttempt ?? 0,
      login_at:
        updates.login_at !== undefined
          ? updates.login_at
          : currentSyncStatus.login_at ?? null,
      changePassword_count:
        updates.changePassword_count !== undefined
          ? updates.changePassword_count
          : currentSyncStatus.changePassword_count ?? 0,
      tempPasswordLoginAttempts:
        updates.tempPasswordLoginAttempts !== undefined
          ? updates.tempPasswordLoginAttempts
          : currentSyncStatus.tempPasswordLoginAttempts ?? 0,
    };
    if (user) {
      user.syncStatus = updatedSyncStatus;
      await this.repo.save(user);
      return { affected: 1 };
    }
    return { affected: 0 };
  }

  increementFailLoginAttempt(id: number) {
    return this.repo
      .createQueryBuilder()
      .update(User)
      .set({
        syncStatus: () =>
          `jsonb_set(
            COALESCE("syncStatus", '{"failLoginAttempt": 0, "login_at": null, "changePassword_count": 0}'::jsonb),
            '{failLoginAttempt}',
            to_jsonb(COALESCE(("syncStatus"->>'failLoginAttempt')::int, 0) + 1)
          )`,
      })
      .where('id = :id', { id })
      .execute();
  }

  resetFailLoginAttempt(id: number) {
    return this.repo
      .createQueryBuilder()
      .update(User)
      .set({
        syncStatus: () =>
          `jsonb_set(
            COALESCE("syncStatus", '{"failLoginAttempt": 0, "login_at": null, "changePassword_count": 0}'::jsonb),
            '{failLoginAttempt}',
            '0'::jsonb
          )`,
      })
      .where('id = :id', { id })
      .execute();
  }

  async findAll() {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.username',
          'user.email',
          'user.displayName',
          'user.role',
          'user.phoneNumber',
          'user.imageId',
          'user.mustChangePassword',
          'user.syncStatus',
          'user.createdAt',
          'user.updatedAt',
        ])
        .where('user.deletedAt IS NULL')
        .getMany();
    } catch (error: any) {
      if (
        error.message?.includes('imageId') ||
        error.message?.includes('column')
      ) {
        return await this.repo
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.username',
            'user.displayName',
            'user.role',
            'user.phoneNumber',
            'user.mustChangePassword',
            'user.syncStatus',
            'user.createdAt',
            'user.updatedAt',
          ])
          .where('user.deletedAt IS NULL')
          .getMany();
      }
      throw error;
    }
  }

  async findAllPaginated(
    query: GetUsersQueryDto
  ): Promise<{ users: GetUserResponseDto[]; totalCount: number }> {
    try {
      const {
        page = 1,
        size = 10,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        search,
        status,
        role,
      } = query;
      const { skip, take } = PaginationUtils.normalizePagination(page, size);
      const queryBuilder = this.repo
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.username',
          'user.email',
          'user.displayName',
          'user.role',
          'user.phoneNumber',
          'user.status',
          'user.mustChangePassword',
          'user.imageId',
          'user.createdAt',
          'user.updatedAt',
        ])
        .where('user.deletedAt IS NULL');
      if (search) {
        const searchLower = search.toLowerCase();
        if (searchLower.includes('@')) {
          queryBuilder.andWhere(
            '(LOWER(user.username) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
            { search: `%${search}%` }
          );
        } else {
          queryBuilder.andWhere(
            "(LOWER(user.username) LIKE LOWER(:search) OR LOWER(SPLIT_PART(user.username, '@', 1)) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))",
            { search: `%${search}%` }
          );
        }
      }
      if (status) {
        queryBuilder.andWhere('user.status = :status', { status });
      }
      if (role) {
        queryBuilder.andWhere('user.role = :role', { role });
      }
      const sortColumnMap: Record<string, string> = {
        name: 'user.displayName',
        email: 'user.email',
        status: 'user.status',
        role: 'user.role',
        createdAt: 'user.createdAt',
      };
      const sortColumn = sortColumnMap[sortBy] || 'user.createdAt';
      queryBuilder.orderBy(sortColumn, sortOrder);
      queryBuilder.skip(skip).take(take);
      const [users, totalCount] = await queryBuilder.getManyAndCount();
      const userResponses: GetUserResponseDto[] = users.map((user) => ({
        id: user.id,
        role: user.role,
        name: user.displayName || user.username || '',
        email: user.email || user.username,
        phoneNumber: user.phoneNumber,
        status: user.status,
        imageId: user.imageId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
      return {
        users: userResponses,
        totalCount,
      };
    } catch (error: any) {
      if (
        error.message?.includes('imageId') ||
        error.message?.includes('column')
      ) {
        const {
          page = 1,
          size = 10,
          sortBy = 'createdAt',
          sortOrder = 'DESC',
          search,
          status,
          role,
        } = query;
        const { skip, take } = PaginationUtils.normalizePagination(page, size);
        const queryBuilder = this.repo
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.username',
            'user.email',
            'user.displayName',
            'user.role',
            'user.phoneNumber',
            'user.status',
            'user.mustChangePassword',
            'user.createdAt',
            'user.updatedAt',
          ])
          .where('user.deletedAt IS NULL');
        if (search) {
          const searchLower = search.toLowerCase();
          if (searchLower.includes('@')) {
            queryBuilder.andWhere(
              '(LOWER(user.username) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
              { search: `%${search}%` }
            );
          } else {
            queryBuilder.andWhere(
              "(LOWER(user.username) LIKE LOWER(:search) OR LOWER(SPLIT_PART(user.username, '@', 1)) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))",
              { search: `%${search}%` }
            );
          }
        }
        if (status) {
          queryBuilder.andWhere('user.status = :status', { status });
        }
        if (role) {
          queryBuilder.andWhere('user.role = :role', { role });
        }
        const sortColumnMap: Record<string, string> = {
          name: 'user.displayName',
          email: 'user.email',
          status: 'user.status',
          role: 'user.role',
          createdAt: 'user.createdAt',
        };
        const sortColumn = sortColumnMap[sortBy] || 'user.createdAt';
        queryBuilder.orderBy(sortColumn, sortOrder);
        queryBuilder.skip(skip).take(take);
        const [users, totalCount] = await queryBuilder.getManyAndCount();
        const userResponses: GetUserResponseDto[] = users.map((user) => ({
          id: user.id,
          role: user.role,
          name: user.displayName || user.username || '',
          email: user.email || user.username,
          phoneNumber: user.phoneNumber,
          status: user.status,
          imageId: undefined,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }));
        return {
          users: userResponses,
          totalCount,
        };
      }
      throw error;
    }
  }

  async findById(id: number) {
    try {
      const user = await this.repo
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.username',
          'user.email',
          'user.displayName',
          'user.role',
          'user.phoneNumber',
          'user.status',
          'user.mustChangePassword',
          'user.imageId',
          'user.syncStatus',
          'user.createdAt',
          'user.updatedAt',
        ])
        .where('user.id = :id', { id })
        .andWhere('user.deletedAt IS NULL')
        .getOne();
      return user;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('imageId') ||
        errorMessage.includes('column') ||
        errorMessage.includes('does not exist')
      ) {
        console.warn(
          'imageId column issue detected, querying without it:',
          errorMessage
        );
        return await this.repo
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.username',
            'user.email',
            'user.displayName',
            'user.role',
            'user.phoneNumber',
            'user.status',
            'user.mustChangePassword',
            'user.syncStatus',
            'user.createdAt',
            'user.updatedAt',
          ])
          .where('user.id = :id', { id })
          .andWhere('user.deletedAt IS NULL')
          .getOne();
      }
      console.error('Error in findById:', error);
      throw error;
    }
  }

  async updateImageId(id: number, imageId: string) {
    await this.repo.update({ id }, { imageId });
    return this.findById(id);
  }

  async findByIdWithPassword(id: number) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.mustChangePassword')
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async updatePassword(id: number, newPassword: string) {
    const updatedUser = await this.repo.manager.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'user')
        .addSelect('user.password')
        .where('user.id = :id', { id })
        .andWhere('user.deletedAt IS NULL')
        .getOne();
      if (!user) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.USER_NOT_FOUND,
          responseMessage: 'User not found',
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      const savedUser = await manager.save(User, user);
      if (!savedUser) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: 'Failed to update password. Save operation failed.',
        });
      }
      const reloaded = await manager
        .createQueryBuilder(User, 'user')
        .addSelect('user.password')
        .where('user.id = :id', { id })
        .andWhere('user.deletedAt IS NULL')
        .getOne();
      if (!reloaded) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.USER_NOT_FOUND,
          responseMessage:
            'Failed to verify password update. User not found after update.',
        });
      }
      return reloaded;
    });
    return updatedUser;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: 'User not found',
      });
    }
    if (
      dto.status === UserStatus.DEACTIVATED &&
      user.role === UserRole.ADMINISTRATOR
    ) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.NO_PERMISSION,
        responseMessage:
          'Cannot deactivate ADMINISTRATOR account. Please change role first if needed.',
      });
    }
    if (dto.username !== undefined) {
      user.username = dto.username;
      if (dto.displayName === undefined) {
        user.displayName = dto.username;
      }
    }
    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName;
    }
    if (dto.phoneNumber !== undefined) {
      user.phoneNumber = dto.phoneNumber;
    }
    if (dto.status !== undefined) {
      user.status = dto.status;
    }
    if (dto.role !== undefined) {
      if (
        dto.role !== UserRole.ADMINISTRATOR &&
        user.role === UserRole.ADMINISTRATOR &&
        dto.status === UserStatus.DEACTIVATED
      ) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.NO_PERMISSION,
          responseMessage:
            'Cannot change ADMINISTRATOR role and deactivate in the same operation.',
        });
      }
      user.role = dto.role;
    }
    const updated = await this.repo.save(user);
    return updated;
  }

  async updateMustChangePassword(
    id: number,
    mustChangePassword: boolean
  ): Promise<void> {
    await this.repo.update({ id }, { mustChangePassword });
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: ResponseMessage.USER_NOT_FOUND,
      });
    }
    await this.repo.softRemove(user);
  }
}
