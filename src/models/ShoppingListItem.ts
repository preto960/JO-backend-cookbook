import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { ShoppingList } from './ShoppingList';

@Entity('shopping_list_items')
@Index(['shopping_list_id'])
@Index(['shopping_list_id', 'display_order'])
export class ShoppingListItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shopping_list_id', type: 'uuid' })
  shoppingListId: string;

  @ManyToOne(() => ShoppingList, list => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList: ShoppingList;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  quantity: string;

  @Column({ length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ length: 100, nullable: true })
  category?: string;

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}