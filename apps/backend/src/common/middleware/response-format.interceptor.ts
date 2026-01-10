import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common'
import { instanceToPlain } from 'class-transformer'
import { map, Observable } from 'rxjs'
import { BaseResponseDto } from '../base-response.dto'
import { Readable } from 'stream'

function isNonJsonResponse(data: any): boolean {
  if (!data) return false
  if (data instanceof StreamableFile) return true
  if (Buffer.isBuffer(data)) return true
  if (data instanceof Readable) return true
  return false
}

@Injectable()
export class ResponseFormatInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse()

    return next.handle().pipe(
      map((data) => {
        if (isNonJsonResponse(data)) {
          return data
        }
        response.status(200)

        if (data instanceof BaseResponseDto) {
          return instanceToPlain(data)
        }

        if (data && typeof data === 'object' && 'responseCode' in data && 'data' in data) {
          return instanceToPlain(data)
        }

        return instanceToPlain(new BaseResponseDto({ data }))
      }),
    )
  }
}
