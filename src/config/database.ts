import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Permission } from '../models/Permission';
import { Setting } from '../models/Setting';
import { Translation } from '../models/Translation';
import { Recipe } from '../models/Recipe';
import { RecipeCategory } from '../models/RecipeCategory';
import { RecipeIngredient } from '../models/RecipeIngredient';
import { RecipeTag } from '../models/RecipeTag';
import { RecipeRating } from '../models/RecipeRating';
import { RecipeFavourite } from '../models/RecipeFavourite';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ||
       process.env.DATABASE_URL?.includes('database:5432')
    ? false
    : { rejectUnauthorized: false },
  synchronize: false,
  migrationsRun: false,
  logging: false,
  connectTimeoutMS: 15000,
  extra: {
    max: 3,
    min: 0,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
  },
  entities: [User, Role, Permission, Setting, Translation, Recipe, RecipeCategory, RecipeIngredient, RecipeTag, RecipeRating, RecipeFavourite],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});

let initializationPromise: Promise<void> | null = null;

export const initializeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) return;

  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = AppDataSource.initialize()
    .then(() => {
      console.log('✅ Database connected');
      initializationPromise = null;
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
      initializationPromise = null;
      throw error;
    });

  await initializationPromise;
};

(global as any).AppDataSource = AppDataSource;
