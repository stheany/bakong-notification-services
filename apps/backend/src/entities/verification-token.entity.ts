import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { User } from './user.entity'

@Entity({ name: 'verification_token' })
export class VerificationToken {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  userId: number

  @ManyToOne(() => User, (user) => user.verificationTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string

  @Column({ type: 'timestamp' })
  expiresAt: Date

  @Column({ type: 'boolean', default: false })
  used: boolean

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date
}
