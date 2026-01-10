import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UserRole, ErrorCode, ResponseMessage } from '@bakong/shared'
import { Public } from '../../common/middleware/jwt-auth.guard'
import { Roles } from '../../common/middleware/roles.guard'
import { BaseResponseDto } from '../../common/base-response.dto'
import { CategoryTypeServiceV2 } from './category-type-v2.service'
import { CreateCategoryTypeDto } from './dto/create-category-type-v2.dto'
import { UpdateCategoryTypeDto } from './dto/update-category-type-v2.dto'

@Controller('category-type')
export class CategoryTypeControllerV2 {
  constructor(private readonly categoryTypeService: CategoryTypeServiceV2) { }

  @Public()
  @Get()
  async findAll() {
    const categoryTypes = await this.categoryTypeService.findAll()
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Success',
      errorCode: 0,
      data: categoryTypes,
    })
  }

  /**
   * ✅ File response (DO NOT wrap with BaseResponseDto)
   * ✅ Works with global wrapper interceptor because it now skips StreamableFile
   */
  @Public()
  @Get(':id/icon')
  @Header('Cache-Control', 'public, max-age=86400') // optional
  async getIcon(@Param('id', ParseIntPipe) id: number) {
    const iconData = await this.categoryTypeService.getIconById(id)

    if (!iconData?.icon) {
      throw new NotFoundException(`Icon not found for category type ${id}`)
    }

    return new StreamableFile(iconData.icon, {
      type: iconData.mimeType || 'image/png',
      disposition: 'inline',
    })
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const categoryType = await this.categoryTypeService.findOneResponse(id)
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Success',
      errorCode: 0,
      data: categoryType,
    })
  }

  @Roles(UserRole.ADMIN_USER)
  @Post()
  @UseInterceptors(FileInterceptor('icon'))
  async create(@Body('name') name: string, @UploadedFile() file?: Express.Multer.File) {
    if (!name?.trim()) {
      throw new BadRequestException({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: ResponseMessage.VALIDATION_FAILED,
        data: { validations: ['Name is required'] },
      })
    }

    if (!file?.buffer) {
      throw new BadRequestException({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: ResponseMessage.VALIDATION_FAILED,
        data: { validations: ['Icon file is required'] },
      })
    }

    const dto: CreateCategoryTypeDto = {
      name: name.trim(),
      icon: file.buffer,
      mimeType: file.mimetype,
      originalFileName: file.originalname,
    }

    const categoryType = await this.categoryTypeService.create(dto)

    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Category type created successfully',
      errorCode: 0,
      data: categoryType,
    })
  }

  @Roles(UserRole.ADMIN_USER)
  @Put(':id')
  @UseInterceptors(FileInterceptor('icon'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto: UpdateCategoryTypeDto = {}

    const name = body?.name
    if (typeof name === 'string' && name.trim()) {
      dto.name = name.trim()
    }

    if (file?.buffer) {
      dto.icon = file.buffer
      dto.mimeType = file.mimetype
      dto.originalFileName = file.originalname
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: ResponseMessage.VALIDATION_FAILED,
        data: { validations: ['At least one field (name or icon) must be provided'] },
      })
    }

    const categoryType = await this.categoryTypeService.update(id, dto)

    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Category type updated successfully',
      errorCode: 0,
      data: categoryType,
    })
  }

  @Roles(UserRole.ADMIN_USER)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categoryTypeService.remove(id)
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Category type deleted successfully',
      errorCode: 0,
    })
  }
}
