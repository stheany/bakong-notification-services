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
import { TemplateTranslation } from './template-translation.entity';
import { Notification } from './notification.entity';
import { CategoryType } from './category-type.entity';
export type SendIntervalData = { cron: string; startAt: Date; endAt: Date }

// ✅ IMPORTANT: use V1 table name
@Entity({ name: 'template' })
export class Template {
  @PrimaryGeneratedColumn()
  id: number

  // ✅ relation only (NOT a column)
  @OneToMany(() => TemplateTranslation, (t) => t.template, {
    eager: false, // ✅ do NOT auto load (you can load in query)
  })
  translations?: TemplateTranslation[]

  // Optional: if you want back-reference
  @OneToMany(() => Notification, (n) => n.template)
  notifications?: Notification[]

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

  @ManyToOne(() => CategoryType, { nullable: true })
  @JoinColumn({ name: 'categoryTypeId' })
  categoryTypeEntity?: CategoryType

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

  @Column('text', { array: true, default: () => "'{}'", nullable: false })
  accountId?: string | string[]
}
