import { CreateUserDto } from './dto/create-user.dto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from 'src/entities/user.entity'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { BaseResponseDto } from 'src/common/base-response.dto'
import { ErrorCode } from '@bakong/shared'

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async findByUsername(username: string) {
    return this.repo.findOne({
      where: { username },
      withDeleted: false, // Explicitly exclude soft-deleted users
    })
  }

  async findByUsernameWithPassword(username: string) {
    // Explicitly fetch user with password field for authentication
    // This ensures we get fresh data from database, not cached
    return this.repo
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .andWhere('user.deletedAt IS NULL')
      .getOne()
  }

  async create(dto: CreateUserDto) {
    const { password } = dto
    let user = this.repo.create({ ...dto, password: await bcrypt.hash(password, 10) })
    user = await this.repo.save(user)
    return user
  }

  increementFailLoginAttempt(id: number) {
    return this.repo.increment({ id }, 'failLoginAttempt', 1)
  }

  resetFailLoginAttempt(id: number) {
    return this.repo.update({ id }, { failLoginAttempt: 0 })
  }

  async findAll() {
    return this.repo.find({
      select: [
        'id',
        'username',
        'displayName',
        'role',
        'failLoginAttempt',
        'createdAt',
        'updatedAt',
      ],
    })
  }

  async findById(id: number) {
    return this.repo.findOne({
      where: { id },
      select: [
        'id',
        'username',
        'displayName',
        'role',
        'failLoginAttempt',
        'createdAt',
        'updatedAt',
      ],
    })
  }

  async findByIdWithPassword(id: number) {
    // Explicitly exclude soft-deleted users to be consistent with other queries
    return this.repo
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne()
  }

  async updatePassword(id: number, newPassword: string) {
    // Use a transaction to ensure the update and verification are consistent
    const updatedUser = await this.repo.manager.transaction(async (manager) => {
      // Find user explicitly excluding soft-deleted records
      const user = await manager
        .createQueryBuilder(User, 'user')
        .where('user.id = :id', { id })
        .andWhere('user.deletedAt IS NULL')
        .getOne()

      if (!user) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.USER_NOT_FOUND,
          responseMessage: 'User not found',
        })
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      // Update password using save() method which is more reliable than update()
      user.password = hashedPassword
      const savedUser = await manager.save(User, user)

      if (!savedUser) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: 'Failed to update password. Save operation failed.',
        })
      }

      // Reload the user using the transactional manager to get the fresh password
      const reloaded = await manager
        .createQueryBuilder(User, 'user')
        .where('user.id = :id', { id })
        .andWhere('user.deletedAt IS NULL')
        .getOne()

      if (!reloaded) {
        throw new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.USER_NOT_FOUND,
          responseMessage: 'Failed to verify password update. User not found after update.',
        })
      }

      return reloaded
    })

    return updatedUser
  }
}
