import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SettingCategory {
  GENERAL = 'general',
  SECURITY = 'security',
  NOTIFICATIONS = 'notifications',
  ADVANCED = 'advanced',
}

@Entity('settings')
@Index(['key'], { unique: true })
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({
    type: 'enum',
    enum: SettingCategory
  })
  category: SettingCategory;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: false })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
