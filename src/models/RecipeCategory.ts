import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './User';

@Entity('recipe_categories')
@Index(['slug'], { unique: true })
export class RecipeCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 120, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true, length: 7 })
  color?: string;   // hex e.g. #FF5733

  @Column({ nullable: true, length: 60 })
  icon?: string;    // lucide icon name

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  creator?: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
