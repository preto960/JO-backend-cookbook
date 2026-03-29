import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm';
import { ShoppingList } from './ShoppingList';
import { Recipe } from './Recipe';

@Entity('shopping_list_recipes')
export class ShoppingListRecipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId: string;

  @ManyToOne(() => ShoppingList, list => list.recipes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList: ShoppingList;

  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId: string;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}