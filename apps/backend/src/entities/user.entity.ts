import { Exclude } from 'class-transformer'
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { UserRole } from '@bakong/shared'
import { VerificationToken } from './verification-token.entity'

@Entity({ name: 'user' })
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  password: string

  @Column({ type: 'varchar', length: 255 })
  displayName: string

  @Column({ type: 'int', default: 0 })
  failLoginAttempt: number

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.NORMAL_USER,
  })
  role: UserRole

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'now()' })
  updatedAt: Date

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null

  // Relations
  @OneToMany(() => VerificationToken, (vt) => vt.user)
  verificationTokens: VerificationToken[]
}
