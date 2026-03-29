import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index
} from 'typeorm';
import { User } from './User';
import { ShoppingListItem } from './ShoppingListItem';
import { ShoppingListRecipe } from './ShoppingListRecipe';

@Entity('shopping_lists')
@Index(['user_id'])
export class ShoppingList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => ShoppingListItem, item => item.shoppingList, { cascade: true })
  items: ShoppingListItem[];

  @OneToMany(() => ShoppingListRecipe, recipe => recipe.shoppingList, { cascade: true })
  recipes: ShoppingListRecipe[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}