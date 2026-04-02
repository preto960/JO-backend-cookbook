import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ResourceType {
  DASHBOARD = 'DASHBOARD',
  USERS = 'USERS',
  ROLES = 'ROLES',
  PERMISSIONS = 'PERMISSIONS',
  SETTINGS = 'SETTINGS',
  PROFILE = 'PROFILE',
  TRANSLATIONS = 'TRANSLATIONS',
  RECIPE_BOOK = 'RECIPE_BOOK',
  SHOPPING_LISTS = 'SHOPPING_LISTS',
}

export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete'
}

@Entity('permissions')
@Index(['role', 'resource', 'pluginId'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ type: 'varchar', length: 255 })
  resource: string;

  @Column({ type: 'varchar', nullable: true })
  pluginId: string | null;

  @Column({ default: false })
  isDynamic: boolean;

  @Column({ type: 'varchar', nullable: true })
  resourceLabel: string | null;

  @Column({ type: 'text', nullable: true })
  resourceDescription: string | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  displayOrder: number;

  @Column({ default: true })
  canInMenu: boolean;

  @Column({ default: false })
  canView: boolean;

  @Column({ default: false })
  canCreate: boolean;

  @Column({ default: false })
  canEdit: boolean;

  @Column({ default: false })
  canDelete: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
