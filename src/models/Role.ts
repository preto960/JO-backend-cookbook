import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // USER, DEVELOPER, ADMIN, etc.

  @Column()
  displayName: string; // "Usuario", "Desarrollador", "Administrador"

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isSystem: boolean; // Los roles del sistema no se pueden eliminar

  @Column({ default: false })
  isDefault: boolean; // Rol por defecto para nuevos usuarios

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Para datos adicionales como colores, iconos, etc.

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

