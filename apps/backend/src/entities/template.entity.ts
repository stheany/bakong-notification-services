import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
<<<<<<< HEAD
import { BakongApp, SendType } from '@bakong/shared'
=======
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
import { CategoryType } from './category-type.entity'
import { TemplateTranslation } from './template-translation.entity'
import { Notification } from './notification.entity'

<<<<<<< HEAD
=======
// TODO: replace these with your real enums
export enum BakongPlatform {
  BAKONG = 'BAKONG',
  // ...
}

export enum SendType {
  SEND_SCHEDULE = 'SEND_SCHEDULE',
  // ...
}

export enum NotificationType {
  FLASH_NOTIFICATION = 'FLASH_NOTIFICATION',
  // ...
}

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
@Entity({ name: 'template' })
export class Template {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number

  @Column({
    name: 'bakongPlatform',
    type: 'enum',
<<<<<<< HEAD
    enum: BakongApp,
    nullable: true,
  })
  bakongPlatform?: BakongApp

  @Column({
    name: 'sendType',
=======
    enum: BakongPlatform,
    nullable: true,
  })
  bakongPlatform?: BakongPlatform

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

  @Column({
    name: 'notificationType',
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
    type: 'enum',
    enum: SendType,
    default: SendType.SEND_SCHEDULE,
  })
<<<<<<< HEAD
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

=======
  notificationType: NotificationType

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

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
  // 🔹 NEW: showPerDay
  @Column({ name: 'showPerDay', type: 'int', default: 1 })
  showPerDay: number

  // 🔹 NEW: maxDayShowing
  @Column({ name: 'maxDayShowing', type: 'int', default: 1 })
  maxDayShowing: number
}
