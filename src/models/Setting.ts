import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SettingCategory {
  GENERAL = 'general',
  PLUGINS = 'plugins',
  SECURITY = 'security',
  NOTIFICATIONS = 'notifications',
  ADVANCED = 'advanced',
  DASHBOARD = 'dashboard',
  EXTERNAL_APIS = 'external_apis'
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
  isPublic: boolean; // Si es público, se puede acceder sin autenticación

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

