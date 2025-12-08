import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { Template } from './template.entity'

@Entity({ name: 'category_type' })
export class CategoryType {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string

  @Column({ type: 'bytea' })
  icon: Buffer

  @Column({ name: 'mimeType', type: 'varchar', length: 255, nullable: true })
  mimeType?: string

  @Column({ name: 'originalFileName', type: 'varchar', length: 255, nullable: true })
  originalFileName?: string

  @Column({
    name: 'createdAt',
    type: 'timestamp',
    default: () => 'now()',
  })
  createdAt: Date

  @Column({ name: 'updatedAt', type: 'timestamp', nullable: true })
  updatedAt?: Date

  @Column({ name: 'deletedAt', type: 'timestamp', nullable: true })
  deletedAt?: Date

  @OneToMany(() => Template, (template) => template.categoryType)
  templates: Template[]
}
