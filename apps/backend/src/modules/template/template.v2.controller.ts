import { Body, Controller, Get, Param, Post, Query, Req, Version } from '@nestjs/common'
import { UserRole } from '@bakong/shared'
import { Roles } from 'src/common/middleware/roles.guard'
import { BaseResponseDto } from 'src/common/base-response.dto'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { TemplateService } from './template.service'

@Controller('template')
export class TemplateV2Controller {
  constructor(private readonly templateService: TemplateService) {}

  @Roles(UserRole.ADMIN_USER)
  @Post('create')
  @Version('2')
  async create(@Body() dto: CreateTemplateDto, @Req() req: any) {
    console.log('🎯 [V2][CONTROLLER] /template/create endpoint called')
    try {
      const currentUser = req.user
      const template = await this.templateService.create(dto, currentUser, req)
      return new BaseResponseDto({
        responseCode: 0,
        responseMessage: `Create ${template.notificationType} successfully`,
        errorCode: 0,
        data: template,
      })
    } catch (error: any) {
      console.error('🎯 [V2][CONTROLLER] ❌ ERROR in create endpoint:', error?.message)
      throw error
    }
  }

  @Roles(UserRole.ADMIN_USER)
  @Post(':id/update')
  @Version('2')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateTemplateDto, @Req() req: any) {
    console.log('🎯 [V2][CONTROLLER] /template/:id/update endpoint called for template:', id)
    const currentUser = req.user
    const template = await this.templateService.update(+id, updateUserDto, currentUser, req)
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: `Update ${template.notificationType} successfully`,
      errorCode: 0,
      data: template,
    })
  }

  @Roles(UserRole.ADMIN_USER)
  @Post(':id/remove')
  @Version('2')
  async remove(@Param('id') id: string, @Req() req: any) {
    const template = await this.templateService.remove(+id, req)
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Template removed successfully',
      errorCode: 0,
      data: template,
    })
  }

  @Get('cron')
  getCronJobs() {
    return this.templateService.getCronJob()
  }

  @Roles(UserRole.ADMIN_USER)
  @Get('all')
  @Version('2')
  async getAll(@Query('language') language?: string, @Req() req?: any) {
    return this.templateService.all(language, req)
  }

  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER, UserRole.API_USER)
  @Get(':id')
  @Version('2')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const template = await this.templateService.findOne(+id, req)
    return new BaseResponseDto({
      responseCode: 0,
      responseMessage: 'Template retrieved successfully',
      errorCode: 0,
      data: template,
    })
  }

  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER, UserRole.API_USER)
  @Get()
  @Version('2')
  async findTemplates(
    @Query() query: any,
    @Query('language') language?: string,
    @Query('format') format?: string,
    @Req() req?: any,
  ) {
    const page = query.page ? parseInt(query.page, 10) : undefined
    const size = query.size ? parseInt(query.size, 10) : undefined
    const isAscending =
      query.isAscending !== undefined
        ? query.isAscending === 'true' || query.isAscending === true
        : undefined

    if (format === 'notification') {
      return await this.templateService.findTemplatesAsNotifications(
        page,
        size,
        isAscending,
        language,
        req,
      )
    }
    return this.templateService.findTemplates(page, size, isAscending, language, req)
  }
}

