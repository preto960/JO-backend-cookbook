// ─────────────────────────────────────────────────────────────────────────────
// src/models/Recipe.ts
// ─────────────────────────────────────────────────────────────────────────────
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn, Index,
} from 'typeorm';
import { User }             from './User';
import { RecipeCategory }   from './RecipeCategory';
import { RecipeIngredient } from './RecipeIngredient';
import { RecipeTag }        from './RecipeTag';
import { RecipeRating }     from './RecipeRating';

export enum RecipeDifficulty {
  EASY   = 'easy',
  MEDIUM = 'medium',
  HARD   = 'hard',
}

@Entity('recipes')
@Index(['slug'], { unique: true })
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 220, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  instructions: string;

  @Column({ type: 'int', default: 0 })
  prepTimeMin: number;

  @Column({ type: 'int', default: 0 })
  cookTimeMin: number;

  @Column({ type: 'int', default: 1 })
  servings: number;

  @Column({ type: 'enum', enum: RecipeDifficulty, default: RecipeDifficulty.MEDIUM })
  difficulty: RecipeDifficulty;

  @Column({ nullable: true, length: 500 })
  coverImage?: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: true })
  isActive: boolean;

  // ── relations ──────────────────────────────────────────────────────────────
  @Column({ type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => RecipeCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: RecipeCategory;

  @Column({ type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedBy' })
  updater?: User;

  @OneToMany(() => RecipeIngredient, (ing) => ing.recipe, { cascade: true })
  ingredients: RecipeIngredient[];

  @ManyToMany(() => RecipeTag, { cascade: ['insert'] })
  @JoinTable({
    name: 'recipe_tag_map',
    joinColumn:        { name: 'recipeId',  referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId',     referencedColumnName: 'id' },
  })
  tags: RecipeTag[];

  @OneToMany(() => RecipeRating, (r) => r.recipe)
  ratings: RecipeRating[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
