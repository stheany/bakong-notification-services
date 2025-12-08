import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm'
import { BakongApp, Platform } from '@bakong/shared'
import { Notification } from './notification.entity'

@Entity({ name: 'bakong_user' })
export class BakongUser {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string

  @Column({ type: 'varchar', length: 32, unique: true })
  accountId: string

  @Column({ type: 'varchar', length: 255 })
  fcmToken: string

  @Column({
    type: 'enum',
    enum: BakongApp,
    enumName: 'bakong_user_bakongplatform_enum',
    nullable: true,
  })
  bakongPlatform: BakongApp | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  platform: Platform | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  participantCode: string | null

  @Column({ type: 'varchar', length: 2, nullable: true })
  language: string | null

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'now()' })
  updatedAt: Date

  @OneToMany(() => Notification, (n) => n.bakongUser)
  notifications: Notification[]
}
