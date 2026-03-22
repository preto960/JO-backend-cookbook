import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('recipe_tags')
@Index(['slug'], { unique: true })
export class RecipeTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  name: string;

  @Column({ length: 80, unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;
}
