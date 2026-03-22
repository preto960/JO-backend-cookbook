import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Recipe } from './Recipe';

@Entity('recipe_ingredients')
export class RecipeIngredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipeId: string;

  @ManyToOne(() => Recipe, (r) => r.ingredients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 60 })
  quantity: string;  // "2", "1/2", "a pinch"

  @Column({ length: 40, nullable: true })
  unit?: string;     // "cups", "grams", "tbsp"

  @Column({ length: 255, nullable: true })
  notes?: string;    // "finely chopped"

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
