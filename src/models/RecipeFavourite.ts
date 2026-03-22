import {
  Entity, PrimaryColumn, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Recipe } from './Recipe';
import { User }   from './User';

@Entity('recipe_favourites')
export class RecipeFavourite {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  recipeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @CreateDateColumn()
  createdAt: Date;
}
