import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { SendType, NotificationType, BakongApp } from '@bakong/shared'
import { CategoryTypeV2 } from './category-type-v2.entity'
import { TemplateTranslationV2 } from './template-translation.v2.entity'
import { NotificationV2 } from './notification.v2.entity'

export type SendIntervalData = { cron: string; startAt: Date; endAt: Date }

// ✅ IMPORTANT: use V1 table name
@Entity({ name: 'template' })
export class TemplateV2 {
  @PrimaryGeneratedColumn()
  id: number

  // ✅ relation only (NOT a column)
  @OneToMany(() => TemplateTranslationV2, (t) => t.template, {
    eager: false, // ✅ do NOT auto load (you can load in query)
  })
  translations?: TemplateTranslationV2[]

  // Optional: if you want back-reference
  @OneToMany(() => NotificationV2, (n) => n.template)
  notifications?: NotificationV2[]

  @Column('text', { array: true, nullable: false })
  platforms?: string[]

  @Column({
    type: 'enum', enum: BakongApp, nullable: false, default: BakongApp.BAKONG,
  })
  bakongPlatform: BakongApp

  @Column({ nullable: false, type: 'enum', enum: SendType, default: SendType.SEND_SCHEDULE })
  sendType?: SendType

  @Column({
    nullable: false,
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.FLASH_NOTIFICATION,
  })
  notificationType?: NotificationType

  @Column({ name: 'categoryTypeId', nullable: true, type: 'integer' })
  categoryTypeId?: number

  @ManyToOne(() => CategoryTypeV2, { nullable: true })
  @JoinColumn({ name: 'categoryTypeId' })
  categoryTypeEntity?: CategoryTypeV2

  @Column({ nullable: false, type: 'integer', default: 0 })
  priority?: number

  @Column({ type: 'json', nullable: true })
  sendInterval?: SendIntervalData

  @Column({ type: 'boolean', default: false })
  isSent?: boolean

  @Column({ type: 'timestamptz', nullable: true })
  sendSchedule?: Date

  @Column({ nullable: true })
  createdBy?: string

  @Column({ nullable: true })
  updatedBy?: string

  @Column({ nullable: true })
  publishedBy?: string

  @Column({ type: 'integer', nullable: true, default: 1 })
  showPerDay?: number

  @Column({ type: 'integer', nullable: true, default: 1 })
  maxDayShowing?: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt?: Date

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date
}
