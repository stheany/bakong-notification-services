import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { BaseResponseDto } from 'src/common/base-response.dto';
import { ErrorCode, ResponseMessage } from '@bakong/shared';
import { AuthService } from './auth.service';
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    if (!email || email.trim() === '') {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage:
          'Email is required. Please provide an email field in the request body.',
      });
    }
    if (!password || password.trim() === '') {
      throw new BaseResponseDto({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage:
          'Password is required. Please provide a password field in the request body.',
      });
    }
    const user = await this.authService.validateUserLogin(email, password);
    return user;
  }
}
