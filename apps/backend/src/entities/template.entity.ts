import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
import { BakongApp, SendType } from '@bakong/shared'
import { CategoryType } from './category-type.entity'
import { TemplateTranslation } from './template-translation.entity'
import { Notification } from './notification.entity'

@Entity({ name: 'template' })
export class Template {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number

  @Column({
    name: 'bakongPlatform',
    type: 'enum',
    enum: BakongApp,
    nullable: true,
  })
  bakongPlatform?: BakongApp

  @Column({
    name: 'sendType',
    type: 'enum',
    enum: SendType,
    default: SendType.SEND_SCHEDULE,
  })
  sendType: SendType

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority: number

  @Column({ name: 'isSent', type: 'boolean', default: false })
  isSent: boolean

  @Column({ name: 'sendSchedule', type: 'timestamptz', nullable: true })
  sendSchedule?: Date

  @Column({
    name: 'createdAt',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date

  @Column({
    name: 'updatedAt',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt: Date

  @Column({ name: 'deletedAt', type: 'timestamptz', nullable: true })
  deletedAt?: Date

  // ⚠️ platforms is text[][] in DB
  // TypeORM does not support 2D array nicely.
  // If you already mapped this, keep your version.
  @Column({
    name: 'platforms',
    type: 'text',
    array: true,
  })
  platforms: string[]

  @Column({ name: 'sendInterval', type: 'json', nullable: true })
  sendInterval?: any

  @Column({ name: 'createdBy', type: 'varchar', nullable: true })
  createdBy?: string

  @Column({ name: 'updatedBy', type: 'varchar', nullable: true })
  updatedBy?: string

  @Column({ name: 'publishedBy', type: 'varchar', nullable: true })
  publishedBy?: string

  // 🔹 FK column
  @Column({ name: 'categoryTypeId', type: 'int', nullable: true })
  categoryTypeId?: number

  // 🔹 Relation to CategoryType
  @ManyToOne(() => CategoryType, (category) => category.templates, {
    nullable: true,
  })
  @JoinColumn({ name: 'categoryTypeId' })
  categoryType?: CategoryType

  // 🔹 Relation to TemplateTranslations
  @OneToMany(() => TemplateTranslation, (translation) => translation.template)
  translations?: TemplateTranslation[]

  // 🔹 Relation to Notifications
  @OneToMany(() => Notification, (notification) => notification.template)
  notifications?: Notification[]

  // 🔹 NEW: showPerDay
  @Column({ name: 'showPerDay', type: 'int', default: 1 })
  showPerDay: number

  // 🔹 NEW: maxDayShowing
  @Column({ name: 'maxDayShowing', type: 'int', default: 1 })
  maxDayShowing: number
}
