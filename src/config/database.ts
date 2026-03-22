import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { InstalledPlugin } from '../models/InstalledPlugin';
import { Permission } from '../models/Permission';
import { Setting } from '../models/Setting';
import { DashboardCard } from '../models/DashboardCard';
import { DashboardBlock } from '../models/DashboardBlock';
import { Translation } from '../models/Translation';
import { ExternalApiConnection } from '../models/ExternalApiConnection';
import { Tenant } from '../models/Tenant';

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
  entities: [
    User, Role, InstalledPlugin, Permission, Setting,
    DashboardCard, DashboardBlock, Translation,
    ExternalApiConnection, Tenant
  ],
  migrations: [],
  subscribers: [],
});

// Singleton para evitar múltiples inicializaciones simultáneas
let initializationPromise: Promise<void> | null = null;

export const initializeDatabase = async (): Promise<void> => {
  // Si ya está inicializada, no hacer nada
  if (AppDataSource.isInitialized) return;

  // Si hay una inicialización en progreso, esperar a que termine
  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  // Iniciar nueva inicialización
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