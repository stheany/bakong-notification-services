<<<<<<< HEAD
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Template } from './template.entity';
=======
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { Template } from './template.entity'
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3

@Entity({ name: 'category_type' })
export class CategoryType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
<<<<<<< HEAD
  name: string;

  @Column({ type: 'bytea' })
  icon: Buffer;

  @Column({ name: 'mimeType', type: 'varchar', length: 255, nullable: true })
  mimeType?: string;

  @Column({ name: 'originalFileName', type: 'varchar', length: 255, nullable: true })
  originalFileName?: string;
=======
  name: string

  @Column({ type: 'bytea' })
  icon: Buffer

  @Column({ name: 'mimeType', type: 'varchar', length: 255, nullable: true })
  mimeType?: string

  @Column({ name: 'originalFileName', type: 'varchar', length: 255, nullable: true })
  originalFileName?: string
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3

  @Column({
    name: 'createdAt',
    type: 'timestamp',
    default: () => 'now()',
  })
<<<<<<< HEAD
  createdAt: Date;

  @Column({ name: 'updatedAt', type: 'timestamp', nullable: true })
  updatedAt?: Date;

  @Column({ name: 'deletedAt', type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => Template, (template) => template.categoryType)
  templates: Template[];
=======
  createdAt: Date

  @Column({ name: 'updatedAt', type: 'timestamp', nullable: true })
  updatedAt?: Date

  @Column({ name: 'deletedAt', type: 'timestamp', nullable: true })
  deletedAt?: Date

  @OneToMany(() => Template, (template) => template.categoryType)
  templates: Template[]
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
}
