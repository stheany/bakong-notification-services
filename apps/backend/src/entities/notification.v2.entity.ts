import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { TemplateV2 } from './template.v2.entity'

@Entity({ name: 'notification' }) // ✅ SAME table as V1
export class NotificationV2 {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number

  @Column({ nullable: false, length: 32 })
  @Index()
  accountId: string

  @Column({ nullable: false, length: 255 })
  fcmToken: string

  @Column({ nullable: false, type: 'bigint' })
  templateId: number

  // ✅ Join to TemplateV2 (which maps to V1 "template" table)
  @ManyToOne(() => TemplateV2, (t) => t.notifications, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template?: TemplateV2

  @CreateDateColumn({ nullable: false, type: 'timestamp' })
  createdAt: Date

  @Column({ nullable: true, type: 'bigint' })
  firebaseMessageId?: number

  @Column({ nullable: false, type: 'int', default: 1 })
  sendCount: number
}
