import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { UserRole } from './User';

export enum ResourceType {
  DASHBOARD = 'DASHBOARD',
  MARKET = 'MARKET',
  PLUGINS = 'PLUGINS',
  USERS = 'USERS',
  ROLES = 'ROLES',
  PERMISSIONS = 'PERMISSIONS',
  SETTINGS = 'SETTINGS',
  PROFILE = 'PROFILE',
  TRANSLATIONS = 'TRANSLATIONS',
  TENANTS = 'TENANTS',
  EXTERNAL_APIS = 'EXTERNAL_APIS'
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

  @Column({
    type: 'varchar',
    length: 50
  })
  role: string;

  @Column({
    type: 'varchar',
    length: 255
  })
  resource: string; // Changed from enum to string to support dynamic plugin resources

  @Column({ type: 'varchar', nullable: true })
  pluginId: string | null; // NULL = base system permission, UUID = plugin permission

  @Column({ default: false })
  isDynamic: boolean; // true = created by plugin, false = base system

  @Column({ type: 'varchar', nullable: true })
  resourceLabel: string | null; // Human-readable label for the resource

  @Column({ type: 'text', nullable: true })
  resourceDescription: string | null; // Description of what this resource controls

  @Column({ type: 'int', nullable: true, default: 0 })
  displayOrder: number; // Order in which to display this permission in the UI

  @Column({ default: true })
  canInMenu: boolean; // Controls if the resource appears in the menu/sidebar

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

