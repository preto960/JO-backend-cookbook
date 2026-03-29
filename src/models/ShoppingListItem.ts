import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { ShoppingList } from './ShoppingList';

@Entity('shopping_list_items')
@Index(['shoppingListId'])
@Index(['shoppingListId', 'displayOrder'])
export class ShoppingListItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shoppingListId: string;

  @ManyToOne(() => ShoppingList, list => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shoppingListId' })
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

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}