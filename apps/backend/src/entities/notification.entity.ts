<<<<<<< HEAD
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
=======
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
import { Template } from './template.entity'
import { BakongUser } from './bakong-user.entity'

@Entity({ name: 'notification' })
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string

  @Column({ type: 'varchar', length: 32 })
  accountId: string

  @ManyToOne(() => BakongUser, (bu) => bu.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'accountId', referencedColumnName: 'accountId' })
  bakongUser: BakongUser

  @Column({ type: 'varchar', length: 255 })
  fcmToken: string

  @Column()
  templateId: number

  @ManyToOne(() => Template, (t) => t.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: Template

  @Column({ type: 'bigint', nullable: true })
  firebaseMessageId: string | null

  @Column({ type: 'int', default: 1 })
  sendCount: number

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date
}
