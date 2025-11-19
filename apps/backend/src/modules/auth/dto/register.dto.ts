import { IsEnum, IsNotEmpty, IsString, Matches, Length } from 'class-validator'
import { UserRole } from '@bakong/shared'

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 255)
  @Matches(/^[a-z0-9_@.]+$/, {
    message: 'Username must be lowercase with no spaces.',
  })
  username: string

  @IsNotEmpty()
  @IsString()
  password: string

  @IsNotEmpty()
  @IsString()
  displayName: string

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole
}
