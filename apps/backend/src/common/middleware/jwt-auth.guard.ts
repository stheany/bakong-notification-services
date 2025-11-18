import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { API_KEY_REQUIRED_KEY } from './api-key.guard'
import { Request } from 'express'
import k from '../../constant'

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const isApiKeyRequired = this.reflector.getAllAndOverride<boolean>(API_KEY_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    
    // If API key is required and a valid API key is provided, skip JWT validation
    if (isApiKeyRequired) {
      const request = context.switchToHttp().getRequest<Request>()
      const apiKey = request.headers['x-api-key'] as string
      
      // If valid API key is provided, skip JWT validation
      if (apiKey && apiKey === k.API_MOBILE_KEY) {
        console.log('✅ JwtAuthGuard: Valid API key provided, skipping JWT validation')
        return true
      } else {
        console.log('⚠️ JwtAuthGuard: API key required but not provided or invalid. Provided:', apiKey, 'Expected:', k.API_MOBILE_KEY)
      }
    }

    return super.canActivate(context) as Promise<boolean>
  }
}
