import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Language } from '@bakong/shared'
import { Template } from './template.entity'
import { Image } from './image.entity'

@Entity({ name: 'template_translation' })
export class TemplateTranslation {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  templateId: number

  @ManyToOne(() => Template, (t) => t.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: Template

  @Column({
    type: 'enum',
    enum: Language,
    enumName: 'template_translation_language_enum',
  })
  language: Language

  @Column({ type: 'varchar', length: 1024, default: '' })
  title: string

  @Column({ type: 'text', default: '' })
  content: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageId: string | null

  @ManyToOne(() => Image, (img) => img.templateTranslations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'imageId', referencedColumnName: 'fileId' })
  image: Image | null

  @Column({ type: 'text', nullable: true })
  linkPreview: string | null

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'now()' })
  updatedAt: Date
}
