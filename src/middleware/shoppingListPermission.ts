import { Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { ShoppingList } from '../models/ShoppingList';
import { AuthRequest } from './auth';

export interface ShoppingListRequest extends AuthRequest {
  shoppingList?: ShoppingList;
}

// Middleware to check shopping list ownership
export const checkShoppingListOwnership = async (
  req: ShoppingListRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Shopping list ID is required' });
    }

    const shoppingListRepo = AppDataSource.getRepository(ShoppingList);
    const shoppingList = await shoppingListRepo.findOne({
      where: { id, userId }
    });

    if (!shoppingList) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    req.shoppingList = shoppingList;
    next();
  } catch (error) {
    console.error('Error checking shopping list ownership:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user can access shopping list (for read operations)
export const checkShoppingListAccess = async (
  req: ShoppingListRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Shopping list ID is required' });
    }

    const shoppingListRepo = AppDataSource.getRepository(ShoppingList);
    const shoppingList = await shoppingListRepo.findOne({
      where: { id, userId },
      relations: ['user']
    });

    if (!shoppingList) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    // For now, only the owner can access the list
    // In the future, you might want to add sharing functionality
    if (shoppingList.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.shoppingList = shoppingList;
    next();
  } catch (error) {
    console.error('Error checking shopping list access:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};