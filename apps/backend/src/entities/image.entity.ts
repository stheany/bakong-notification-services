<<<<<<< HEAD
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm'
=======
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
import { Exclude } from 'class-transformer'
import { TemplateTranslation } from './template-translation.entity'

@Entity({ name: 'image' })
export class Image {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string

  @Column({ type: 'varchar', length: 255, unique: true })
  fileId: string

  @Column({ type: 'bytea' })
  @Exclude()
  file: Buffer

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName: string | null

  @Column({ type: 'varchar', length: 255 })
  mimeType: string

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date

<<<<<<< HEAD
  @OneToMany(
    () => TemplateTranslation,
    (tt) => tt.image,
  )
=======
  @OneToMany(() => TemplateTranslation, (tt) => tt.image)
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
  templateTranslations: TemplateTranslation[]
}
