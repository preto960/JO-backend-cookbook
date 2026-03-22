import { Request, Response, NextFunction } from 'express';
import { AppDataSource, initializeDatabase } from '../config/database';
 
export const ensureDbConnected = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!AppDataSource.isInitialized) {
      await initializeDatabase();
    }
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ message: 'Database connection failed' });
  }
};