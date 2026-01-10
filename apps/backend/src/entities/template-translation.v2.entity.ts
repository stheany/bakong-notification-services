import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Language } from '@bakong/shared'
import { TemplateV2 } from './template.v2.entity'

@Entity({ name: 'template_translation' })
export class TemplateTranslationV2 {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ nullable: false, type: 'integer' })
  templateId: number

  @ManyToOne(() => TemplateV2, (t) => t.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: TemplateV2

  @Column({ nullable: false, type: 'enum', enum: Language })
  language: Language

  @Column({ type: 'text', nullable: true })
  title?: string

  @Column({ type: 'text', nullable: true })
  content?: string

  @Column({ nullable: true, type: 'uuid' })
  imageId?: string

  @Column({ type: 'text', nullable: true })
  linkPreview?: string

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt?: Date
}
