import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SupportedLanguage {
  EN = 'en',
  ES = 'es'
}

@Entity('translations')
@Index(['key', 'language'], { unique: true })
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255
  })
  key: string; // e.g., 'common.save', 'dashboard.title', 'settings.general'

  @Column({
    type: 'enum',
    enum: SupportedLanguage
  })
  language: SupportedLanguage;

  @Column({
    type: 'text'
  })
  value: string; // The translated text

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  category: string | null; // e.g., 'common', 'dashboard', 'settings', etc.

  @Column({
    type: 'text',
    nullable: true
  })
  description: string | null; // Context description for translators

  @Column({ default: false })
  isSystem: boolean; // true = system translation, false = user-defined

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
