import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';

export const ensureDbConnected = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!AppDataSource.isInitialized) {
      console.log('🔌 Connecting to database...');
      await AppDataSource.initialize();
      console.log('✅ Database connected');
    }
    next();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    res.status(500).json({ message: 'Database connection failed' });
  }
};