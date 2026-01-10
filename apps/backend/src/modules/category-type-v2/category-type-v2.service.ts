// apps/backend/src/modules/category-type-v2/category-type-v2.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { BaseResponseDto } from '../../common/base-response.dto'
import { ErrorCode, ResponseMessage } from '@bakong/shared'
import * as fs from 'fs'
import * as path from 'path'
import { CategoryTypeV2 } from '@/entities/category-type-v2.entity'
import { CreateCategoryTypeDto } from './dto/create-category-type-v2.dto'
import { UpdateCategoryTypeDto } from './dto/update-category-type-v2.dto'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

@Injectable()
export class CategoryTypeServiceV2 implements OnModuleInit {
  private readonly logger = new Logger(CategoryTypeServiceV2.name)

  private readonly CACHE_TTL = 5 * 60 * 1000
  private categoryTypesCache: CacheEntry<any[]> | null = null
  private categoryTypeCache: Map<number, CacheEntry<any>> = new Map()

  constructor(
    @InjectRepository(CategoryTypeV2)
    private readonly repo: Repository<CategoryTypeV2>,
  ) { }

  async onModuleInit() {
    await this.ensureDefaultCategoryTypes()
  }

  private isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
    if (!entry) return false
    return Date.now() - entry.timestamp < this.CACHE_TTL
  }

  clearCache(): void {
    this.categoryTypesCache = null
    this.categoryTypeCache.clear()
    this.logger.debug('Category types cache cleared')
  }

  private iconToBase64(icon: Buffer, mimeType?: string): string {
    const base64 = icon.toString('base64')
    const mime = mimeType || 'image/png'
    return `data:${mime};base64,${base64}`
  }

  private toResponseObject(categoryType: CategoryTypeV2): any {
    return {
      id: categoryType.id,
      name: categoryType.name,
      icon: categoryType.icon ? this.iconToBase64(categoryType.icon, categoryType.mimeType) : undefined,
      mimeType: categoryType.mimeType,
      originalFileName: categoryType.originalFileName,
      createdAt: categoryType.createdAt,
      updatedAt: categoryType.updatedAt,
      deletedAt: categoryType.deletedAt,
    }
  }

  /**
   * ✅ Used by GET /:id/icon (streaming)
   */
  async getIconById(id: number): Promise<{ icon: Buffer | null; mimeType?: string | null }> {
    const row = await this.repo
      .createQueryBuilder('ct')
      .select(['ct.id', 'ct.mimeType'])
      .addSelect('ct.icon') // ✅ ensure icon is selected even if select:false
      .where('ct.id = :id', { id })
      .andWhere('ct.deletedAt IS NULL')
      .getOne()

    return {
      icon: row?.icon ?? null,
      mimeType: row?.mimeType ?? null,
    }
  }

  /**
   * ✅ Used by GET /category-type (returns JSON with base64 icon)
   * Important: use querybuilder to include icon
   */
  async findAll(): Promise<any[]> {
    if (this.isCacheValid(this.categoryTypesCache)) {
      this.logger.debug('Returning category types from cache')
      return this.categoryTypesCache!.data
    }

    const entities = await this.repo
      .createQueryBuilder('ct')
      .addSelect('ct.icon')
      .where('ct.deletedAt IS NULL')
      .orderBy('ct.name', 'ASC')
      .getMany()

    const data = entities.map((ct) => this.toResponseObject(ct))

    this.categoryTypesCache = { data, timestamp: Date.now() }
    this.logger.debug(`Cached ${data.length} category types`)

    return data
  }

  /**
   * ✅ Used by GET /:id (returns JSON with base64 icon)
   */
  async findOneResponse(id: number): Promise<any> {
    const cached = this.categoryTypeCache.get(id)
    if (this.isCacheValid(cached ?? null)) {
      this.logger.debug(`Returning category type ${id} from cache`)
      return cached!.data
    }

    const entity = await this.repo
      .createQueryBuilder('ct')
      .addSelect('ct.icon')
      .where('ct.id = :id', { id })
      .andWhere('ct.deletedAt IS NULL')
      .getOne()

    if (!entity) {
      throw new NotFoundException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: ResponseMessage.RECORD_NOT_FOUND + id,
        }),
      )
    }

    const data = this.toResponseObject(entity)

    this.categoryTypeCache.set(id, { data, timestamp: Date.now() })
    return data
  }

  async create(dto: CreateCategoryTypeDto): Promise<CategoryTypeV2> {
    const categoryType = this.repo.create(dto)
    const saved = await this.repo.save(categoryType)
    this.clearCache()
    this.logger.log(`Category type created: ${saved.name} (ID: ${saved.id})`)
    return saved
  }

  async update(id: number, dto: UpdateCategoryTypeDto): Promise<CategoryTypeV2> {
    // ensure exists (and load icon)
    const entity = await this.repo
      .createQueryBuilder('ct')
      .addSelect('ct.icon')
      .where('ct.id = :id', { id })
      .andWhere('ct.deletedAt IS NULL')
      .getOne()

    if (!entity) {
      throw new NotFoundException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: ResponseMessage.RECORD_NOT_FOUND + id,
        }),
      )
    }

    Object.assign(entity, dto)
    const updated = await this.repo.save(entity)

    this.clearCache()
    this.logger.log(`Category type updated: ${updated.name} (ID: ${updated.id})`)
    return updated
  }

  async remove(id: number): Promise<void> {
    // verify exists
    const exists = await this.repo.findOne({ where: { id } })
    if (!exists) {
      throw new NotFoundException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: ResponseMessage.RECORD_NOT_FOUND + id,
        }),
      )
    }

    try {
      const result = await this.repo.delete(id)
      if (!result.affected) {
        throw new NotFoundException(
          new BaseResponseDto({
            responseCode: 1,
            errorCode: ErrorCode.RECORD_NOT_FOUND,
            responseMessage: ResponseMessage.RECORD_NOT_FOUND + id,
          }),
        )
      }
      this.clearCache()
      this.logger.log(`Category type ${id} deleted successfully`)
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const msg = error.message || String(error)
        if (msg.includes('foreign key') || msg.includes('violates foreign key constraint')) {
          throw new BadRequestException(
            new BaseResponseDto({
              responseCode: 1,
              errorCode: ErrorCode.VALIDATION_FAILED,
              responseMessage:
                `Cannot delete category type. Please ensure FK is ON DELETE SET NULL. Error: ${msg}`,
            }),
          )
        }
      }
      throw error
    }
  }

  /**
   * Your ensureDefaultCategoryTypes() can stay mostly same.
   * (I didn’t change it here to keep your logic, but it’s not related to detachSocket.)
   */
  private async ensureDefaultCategoryTypes(): Promise<void> {
    const possiblePaths = [
      path.join(process.cwd(), 'assets/images'),
      path.join(process.cwd(), 'apps/backend/assets/images'),
      path.join(__dirname, '../../../assets/images'),
      path.join(process.cwd(), 'apps/frontend/src/assets/image'),
      path.join(process.cwd(), '../frontend/src/assets/image'),
      path.join(__dirname, '../../../../frontend/src/assets/image'),
    ]

    let assetsPath: string | null = null
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        assetsPath = testPath
        this.logger.log(`📁 Found category type images directory: ${assetsPath}`)
        break
      }
    }

    if (!assetsPath) {
      this.logger.warn(`⚠️ Category type images directory not found. Tried: ${possiblePaths.join(', ')}`)
      assetsPath = possiblePaths[0]
    }

    const defaultPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )

    const loadIconBuffer = (iconFileName: string): Buffer => {
      const iconPath = path.join(assetsPath!, iconFileName)
      try {
        if (fs.existsSync(iconPath)) return fs.readFileSync(iconPath)
      } catch (e: any) {
        this.logger.error(`❌ Failed to load icon ${iconFileName}: ${e?.message}`)
      }
      return defaultPng
    }

    const defaults = [
      { name: 'News', mimeType: 'image/png', originalFileName: 'News.png', iconFileName: 'News.png' },
      { name: 'Product & Feature', mimeType: 'image/png', originalFileName: 'ProductAndFeature.png', iconFileName: 'ProductAndFeature.png' },
      { name: 'Other', mimeType: 'image/png', originalFileName: 'Other.png', iconFileName: 'Other.png' },
      { name: 'Event', mimeType: 'image/png', originalFileName: 'Event.png', iconFileName: 'Event.png' },
    ]

    for (const ct of defaults) {
      try {
        const existing = await this.repo.findOne({ where: { name: ct.name } })
        if (!existing) {
          await this.repo.save(
            this.repo.create({
              name: ct.name,
              icon: loadIconBuffer(ct.iconFileName),
              mimeType: ct.mimeType,
              originalFileName: ct.originalFileName,
            }),
          )
          this.logger.log(`✅ Created default category type: ${ct.name}`)
        }
      } catch (e: any) {
        this.logger.error(`Failed to ensure category type ${ct.name}: ${e?.message}`, e?.stack)
      }
    }
  }
}
