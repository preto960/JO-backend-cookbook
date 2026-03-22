import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User';

export enum InstallationStatus {
  INSTALLING = 'INSTALLING',
  INSTALLED = 'INSTALLED',
  FAILED = 'FAILED',
  UPDATING = 'UPDATING',
  UNINSTALLING = 'UNINSTALLING'
}

@Entity('installed_plugins')
export class InstalledPlugin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Referencia al plugin en Publisher
  @Column()
  publisherPluginId: string;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column()
  version: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // URL del paquete descargado
  @Column({ nullable: true })
  packageUrl: string;

  // Manifest del plugin (configuración, rutas, componentes, etc.)
  @Column({ type: 'jsonb' })
  manifest: any;

  // Configuración específica del plugin para esta instalación
  @Column({ type: 'jsonb', nullable: true })
  config: any;

  @Column({
    type: 'enum',
    enum: InstallationStatus,
    default: InstallationStatus.INSTALLING
  })
  status: InstallationStatus;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  autoUpdate: boolean;

  @Column({ nullable: true })
  installedBy: string;

  @Column({ nullable: true })
  lastActivatedAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  installedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relación con el usuario que lo instaló
  @ManyToOne(() => User, { nullable: true })
  installer: User;
}

