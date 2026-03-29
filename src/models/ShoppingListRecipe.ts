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

  @Column({ type: 'uuid' })
  shoppingListId: string;

  @ManyToOne(() => ShoppingList, list => list.recipes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shoppingListId' })
  shoppingList: ShoppingList;

  @Column({ type: 'uuid' })
  recipeId: string;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @CreateDateColumn()
  createdAt: Date;
}