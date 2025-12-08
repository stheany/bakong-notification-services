import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
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

  @OneToMany(() => TemplateTranslation, (tt) => tt.image)
  templateTranslations: TemplateTranslation[]
}
