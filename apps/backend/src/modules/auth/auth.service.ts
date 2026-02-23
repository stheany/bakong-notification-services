import {
  ErrorCode,
  ResponseMessage,
  UserRole,
  ValidationUtils,
  UserStatus,
} from '@bakong/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ImageService } from '../image/image.service';
import { OtpService } from './otp.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/entities/user.entity';
import k from 'src/constant';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import moment from 'moment';
import { BaseResponseDto } from 'src/common/base-response.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly imageService: ImageService,
    private readonly otpService: OtpService
  ) {}

  async onModuleInit() {
    const admin = await this.userService.findByUsername(k.API_ADMIN_USERNAME);
    if (!admin) {
      const createdAdmin = await this.userService.create({
        username: k.API_ADMIN_USERNAME,
        email: `${k.API_ADMIN_USERNAME}@bakong.local`,
        password: k.API_ADMIN_PASSWORD,
        displayName: k.API_ADMIN_USERNAME,
        role: UserRole.ADMINISTRATOR,
        phoneNumber: '+855 00 000 000',
      });
      if (createdAdmin.status !== UserStatus.ACTIVE) {
        await this.userService.update(createdAdmin.id, {
          status: UserStatus.ACTIVE,
          phoneNumber: createdAdmin.phoneNumber,
        });
      }
    } else {
      if (
        admin.status !== UserStatus.ACTIVE ||
        admin.role !== UserRole.ADMINISTRATOR
      ) {
        await this.userService.update(admin.id, {
          status: UserStatus.ACTIVE,
          role: UserRole.ADMINISTRATOR,
          phoneNumber: admin.phoneNumber,
        });
      }
    }
  }

  async login(user: User, req?: unknown) {
    try {
      if (user.mustChangePassword) {
        const tempPasswordAttempts =
          user.syncStatus?.tempPasswordLoginAttempts ?? 0;

        if (tempPasswordAttempts >= 3) {
          throw new BaseResponseDto({
            responseCode: 1,
            errorCode: ErrorCode.ACCOUNT_TIMEOUT,
            responseMessage:
              'You have exceeded the maximum number of login attempts with the temporary password. Your account has been locked. Please contact an administrator to reset your password.',
            data: null,
          });
        }

        await this.userService.updateSyncStatus(user.id, {
          tempPasswordLoginAttempts: tempPasswordAttempts + 1,
        });
      }

      await this.userService.resetFailLoginAttempt(user.id);
      await this.userService.updateSyncStatus(user.id, {
        login_at: new Date().toISOString(),
      });
      let userWithImage = null;
      try {
        userWithImage = await this.userService.findById(user.id);
      } catch (error: unknown) {
        console.warn(
          'Failed to fetch user with imageId, using basic user data:',
          (error as { message?: string }).message
        );
        userWithImage = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          phoneNumber: user.phoneNumber,
          imageId: null,
        };
      }
      const expireAt = moment().add(24, 'hours').valueOf();
      const payload = {
        username: user.username,
        role: user.role,
        sub: user.id,
        exp: Math.floor(expireAt / 1000),
        mustChangePassword: user.mustChangePassword || false,
      };
      const image = userWithImage?.imageId
        ? `/api/v1/image/${userWithImage.imageId}`
        : null;
      return new BaseResponseDto({
        responseCode: 0,
        responseMessage: 'Login successful',
        errorCode: 0,
        data: {
          accessToken: this.jwtService.sign(payload),
          expireAt: expireAt,
          mustChangePassword: user.mustChangePassword || false,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.displayName,
            image: image, // Use the computed image path instead of hardcoded null
            mustChangePassword: user.mustChangePassword || false,
          },
        },
      });
    } catch (error: unknown) {
      console.error('Login error:', error);
      if (error instanceof BaseResponseDto) {
        throw error;
      }
      throw new BaseResponseDto({
        responseCode: 1,
        responseMessage:
          (error as { message?: string }).message || 'Login failed',
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        data: null,
      });
    }
  }

  async validateUserLogin(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: 'Email is required.',
        data: null,
      });
    }
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(normalizedEmail)) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: 'Please enter a valid email address.',
        data: null,
      });
    }
    const user =
      await this.userService.findByEmailWithPassword(normalizedEmail);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.INVALID_USERNAME_OR_PASSWORD,
        responseMessage:
          'Invalid email or password. Please check your credentials and try again.',
        data: null,
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.NO_PERMISSION,
        responseMessage:
          'Your account has been deactivated. Please contact administrator to reactivate your account.',
        data: null,
      });
    }
    const failLoginAttempt = user.syncStatus?.failLoginAttempt ?? 0;
    if (failLoginAttempt >= 6) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.ACCOUNT_TIMEOUT,
        responseMessage: `Account locked due to ${failLoginAttempt} failed login attempts. Please contact administrator to unlock your account.`,
        data: null,
      });
    }
    if (await bcrypt.compare(password, user.password)) {
      const currentFailAttempts = user.syncStatus?.failLoginAttempt ?? 0;
      if (currentFailAttempts > 0) {
        await this.userService.resetFailLoginAttempt(user.id);
      }
      return user;
    }
    await this.userService.increementFailLoginAttempt(user.id);
    const updatedUser = await this.userService.findByEmail(normalizedEmail);
    const updatedFailAttempts = updatedUser?.syncStatus?.failLoginAttempt ?? 0;
    const remainingAttempts = 6 - updatedFailAttempts;
    if (remainingAttempts <= 0) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.ACCOUNT_TIMEOUT,
        responseMessage: `Account locked due to ${updatedFailAttempts} failed login attempts. Please contact administrator to unlock your account.`,
        data: null,
      });
    }
    throw new BaseResponseDto({
      responseCode: 1,
      errorCode: ErrorCode.INVALID_USERNAME_OR_PASSWORD,
      responseMessage: `Invalid password. ${remainingAttempts} attempt${
        remainingAttempts > 1 ? 's' : ''
      } remaining before account lockout.`,
      data: null,
    });
  }

  async register(dto: CreateUserDto) {
    const user = await this.userService.create(dto);
    return this.login(user);
  }

  async getAllUsers(page = 1, pageSize = 10, search?: string, role?: string) {
    try {
      const users = await this.userService.findAll();
      let filteredUsers = users;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredUsers = filteredUsers.filter(
          (user) =>
            user.username.toLowerCase().includes(searchLower) ||
            user.displayName.toLowerCase().includes(searchLower) ||
            user.role.toLowerCase().includes(searchLower)
        );
      }
      if (role) {
        filteredUsers = filteredUsers.filter((user) => user.role === role);
      }
      filteredUsers.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredUsers.slice(startIndex, endIndex);
      return {
        data: paginatedData,
        total: filteredUsers.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredUsers.length / pageSize),
      };
    } catch (error) {
      throw error;
    }
  }

  async getUserById(id: number) {
    try {
      const user = await this.userService.findById(id);
      if (!user) {
        return { message: 'User not found' };
      }
      return { data: user };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Changes user password with comprehensive security validation
   *
   * Security Steps:
   * 1. Verify user exists
   * 2. Validate current password against database hash
   * 3. Ensure new password is different from current
   * 4. Validate new password strength (handled by DTO decorators)
   * 5. Hash new password with bcrypt (cost factor 10)
   * 6. Update database within transaction
   * 7. Verify password was successfully updated
   * 8. Reset failed login attempts (proves user knows current password)
   *
   * @param userId - The ID of the user changing their password
   * @param dto - Contains currentPassword and newPassword
   * @returns Success response with message
   * @throws BaseResponseDto with appropriate error codes
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userService.findByIdWithPassword(userId);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: 'User not found',
      });
    }
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: 'Current password is incorrect',
      });
    }
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: 'New password must be different from current password',
      });
    }
    const updatedUser = await this.userService.updatePassword(
      userId,
      dto.newPassword
    );
    if (!updatedUser) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage:
          'Failed to update password. User not found after update.',
      });
    }
    const verifyNewPassword = await bcrypt.compare(
      dto.newPassword,
      updatedUser.password
    );
    if (!verifyNewPassword) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: 'Password update failed. Please try again.',
      });
    }
    await this.userService.resetFailLoginAttempt(userId);
    const currentUser = await this.userService.findById(userId);
    const currentCount = currentUser?.syncStatus?.changePassword_count ?? 0;
    await this.userService.updateSyncStatus(userId, {
      changePassword_count: currentCount + 1,
    });
    return BaseResponseDto.success({
      message: 'Password changed successfully',
    });
  }

  async uploadAndUpdateAvatar(
    userId: number,
    imageData: {
      file: Buffer;
      mimeType: string;
      originalFileName?: string | null;
    },
    req?: unknown
  ) {
    const imageResult = await this.imageService.create({
      file: imageData.file,
      mimeType: imageData.mimeType,
      originalFileName: imageData.originalFileName,
    });
    const imageId = imageResult.fileId;
    const updatedUser = await this.userService.updateImageId(userId, imageId);
    if (!updatedUser) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: 'User not found',
      });
    }
    return {
      imageId,
    };
  }

  /**
   * Verify account using token from email link
   * Activates the account when verification link is clicked
   */
  async verifyAccount(token: string) {
    const result = await this.otpService.verifyToken(token);
    if (!result.valid) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage:
          result.reason === 'EXPIRED'
            ? 'Verification link has expired. Please contact administrator for a new link.'
            : 'Invalid or expired verification link.',
      });
    }
    const user = await this.userService.findById(result.userId!);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: 'User not found',
      });
    }
    await this.userService.update(result.userId!, {
      status: UserStatus.ACTIVE,
    } as any);
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage:
        'Account verified successfully. You can now set your password.',
      data: {
        verified: true,
        userId: result.userId,
        message: 'Please set your password to complete account setup.',
      },
    });
  }

  /**
   * Setup password for verified users
   * Can be used after account verification or by active users
   */
  async setupPassword(userId: number, newPassword: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: 'User not found',
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage:
          'Please verify your account first before setting a password.',
      });
    }
    await this.userService.updatePassword(userId, newPassword);
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Password set successfully.',
      data: { passwordSet: true },
    });
  }

  /**
   * Setup initial password for users with default password
   * This is called when user logs in with default password and must change it
   * No current password required - only userId and newPassword
   */
  async setupInitialPassword(userId: number, newPassword: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.USER_NOT_FOUND,
        responseMessage: 'User not found',
      });
    }
    if (!user.mustChangePassword) {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage:
          'Password has already been changed. Use change-password endpoint instead.',
      });
    }
    await this.userService.updatePassword(userId, newPassword);
    await this.userService.updateMustChangePassword(userId, false);

    await this.userService.updateSyncStatus(userId, {
      tempPasswordLoginAttempts: 0,
    });
    const updatedUser = await this.userService.findById(userId);
    const expireAt = moment().add(24, 'hours').valueOf();
    const payload = {
      username: updatedUser.username,
      role: updatedUser.role,
      sub: updatedUser.id,
      exp: Math.floor(expireAt / 1000),
      mustChangePassword: false,
    };
    const accessToken = this.jwtService.sign(payload);
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage:
        'Password changed successfully. You can now access the system.',
      data: {
        passwordChanged: true,
        accessToken,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          displayName: updatedUser.displayName,
          mustChangePassword: false,
          image: null,
        },
      },
    });
  }
}
