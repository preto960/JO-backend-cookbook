import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { ShoppingList } from '../models/ShoppingList';
import { ShoppingListItem } from '../models/ShoppingListItem';
import { ShoppingListRecipe } from '../models/ShoppingListRecipe';
import { Recipe } from '../models/Recipe';
import { RecipeIngredient } from '../models/RecipeIngredient';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { In } from 'typeorm';

// Types
interface CreateShoppingListPayload {
  name: string;
  description?: string;
}

interface UpdateShoppingListPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

interface CreateItemPayload {
  name: string;
  quantity: string;
  unit?: string;
  notes?: string;
  category?: string;
  displayOrder?: number;
}

interface UpdateItemPayload {
  name?: string;
  quantity?: string;
  unit?: string;
  notes?: string;
  category?: string;
  isCompleted?: boolean;
  displayOrder?: number;
}

interface GenerateShoppingListPayload {
  name: string;
  recipeIds: string[];
  description?: string;
}

interface ReorderItemsPayload {
  items: Array<{ id: string; displayOrder: number }>;
}

interface GroupedIngredient {
  name: string;
  totalQuantity: string;
  unit?: string;
  category?: string;
  fromRecipes: string[];
}

// Helper functions
function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

function combineQuantities(qty1: string, qty2: string): string {
  // Simple combination - in a real app you'd want more sophisticated quantity parsing
  const num1 = parseFloat(qty1) || 0;
  const num2 = parseFloat(qty2) || 0;
  
  if (num1 > 0 && num2 > 0) {
    return (num1 + num2).toString();
  }
  
  return `${qty1}, ${qty2}`;
}

function groupIngredients(recipes: Recipe[]): GroupedIngredient[] {
  const ingredientMap = new Map<string, GroupedIngredient>();
  
  recipes.forEach(recipe => {
    recipe.ingredients?.forEach(ingredient => {
      const key = normalizeIngredientName(ingredient.name);
      
      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.totalQuantity = combineQuantities(existing.totalQuantity, ingredient.quantity);
        if (!existing.fromRecipes.includes(recipe.title)) {
          existing.fromRecipes.push(recipe.title);
        }
      } else {
        ingredientMap.set(key, {
          name: ingredient.name,
          totalQuantity: ingredient.quantity,
          unit: ingredient.unit,
          category: undefined, // RecipeIngredient doesn't have category
          fromRecipes: [recipe.title]
        });
      }
    });
  });
  
  return Array.from(ingredientMap.values());
}

export class ShoppingListController {
  private shoppingListRepo = AppDataSource.getRepository(ShoppingList);
  private itemRepo = AppDataSource.getRepository(ShoppingListItem);
  private recipeRepo = AppDataSource.getRepository(Recipe);
  private shoppingListRecipeRepo = AppDataSource.getRepository(ShoppingListRecipe);

  // Health check endpoint
  async healthCheck(req: AuthRequest, res: Response) {
    try {
      // Simple query to check database connectivity
      await this.shoppingListRepo.count({ where: { userId: req.user!.id }, take: 1 });
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Shopping lists health check failed:', error);
      res.status(503).json({ status: 'error', message: 'Service unavailable' });
    }
  }

  // GET /api/shopping-lists - List user's shopping lists
  async getShoppingLists(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20); // Reduced max limit
      const skip = (page - 1) * limit;

      // Don't load items in list view to reduce memory usage
      const [lists, total] = await this.shoppingListRepo.findAndCount({
        where: { userId, isActive: true }, // Only active lists
        select: ['id', 'name', 'description', 'isActive', 'userId', 'createdAt', 'updatedAt'],
        order: { updatedAt: 'DESC' },
        skip,
        take: limit
      });

      // Add item counts separately if needed
      const listsWithCounts = await Promise.all(
        lists.map(async (list) => {
          const itemCount = await this.itemRepo.count({
            where: { shoppingListId: list.id }
          });
          const completedCount = await this.itemRepo.count({
            where: { shoppingListId: list.id, isCompleted: true }
          });
          
          return {
            ...list,
            itemCount,
            completedCount
          };
        })
      );

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'ETag': `"${userId}-${total}-${lists[0]?.updatedAt?.getTime() || 0}"`
      });

      res.json({
        shoppingLists: listsWithCounts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Failed to fetch shopping lists:', error);
      res.status(500).json({ error: 'Failed to fetch shopping lists' });
    }
  }

  // POST /api/shopping-lists - Create new shopping list
  async createShoppingList(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const payload: CreateShoppingListPayload = req.body;

      if (!payload.name?.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const shoppingList = this.shoppingListRepo.create({
        name: payload.name.trim(),
        description: payload.description?.trim(),
        userId
      });

      const saved = await this.shoppingListRepo.save(shoppingList);
      
      const result = await this.shoppingListRepo.findOne({
        where: { id: saved.id },
        relations: ['items', 'recipes', 'recipes.recipe']
      });

      res.status(201).json({ shoppingList: result });
    } catch (error) {
      console.error('Failed to create shopping list:', error);
      throw createError('Failed to create shopping list', 500);
    }
  }

  // GET /api/shopping-lists/:id - Get shopping list by ID
  async getShoppingListById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId },
        relations: ['items', 'recipes', 'recipes.recipe'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      res.json({ shoppingList });
    } catch (error) {
      console.error('Failed to fetch shopping list:', error);
      throw createError('Failed to fetch shopping list', 500);
    }
  }

  // PUT /api/shopping-lists/:id - Update shopping list
  async updateShoppingList(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const payload: UpdateShoppingListPayload = req.body;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      if (payload.name !== undefined) {
        if (!payload.name.trim()) {
          return res.status(400).json({ error: 'Name cannot be empty' });
        }
        shoppingList.name = payload.name.trim();
      }

      if (payload.description !== undefined) {
        shoppingList.description = payload.description?.trim() || undefined;
      }

      if (payload.isActive !== undefined) {
        shoppingList.isActive = payload.isActive;
      }

      await this.shoppingListRepo.save(shoppingList);

      const updated = await this.shoppingListRepo.findOne({
        where: { id },
        relations: ['items', 'recipes', 'recipes.recipe'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      res.json({ shoppingList: updated });
    } catch (error) {
      console.error('Failed to update shopping list:', error);
      throw createError('Failed to update shopping list', 500);
    }
  }

  // DELETE /api/shopping-lists/:id - Delete shopping list
  async deleteShoppingList(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await this.shoppingListRepo.delete({ id, userId });

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete shopping list:', error);
      throw createError('Failed to delete shopping list', 500);
    }
  }

  // POST /api/shopping-lists/generate - Generate shopping list from recipes
  async generateShoppingListFromRecipes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const payload: GenerateShoppingListPayload = req.body;

      if (!payload.name?.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (!payload.recipeIds?.length) {
        return res.status(400).json({ error: 'At least one recipe ID is required' });
      }

      // Create the shopping list
      const shoppingList = this.shoppingListRepo.create({
        name: payload.name.trim(),
        description: payload.description?.trim(),
        userId
      });

      const savedList = await this.shoppingListRepo.save(shoppingList);

      // Get recipes with ingredients
      const recipes = await this.recipeRepo.find({
        where: { 
          id: In(payload.recipeIds),
          createdBy: userId // Ensure user owns the recipes
        },
        relations: ['ingredients']
      });

      if (recipes.length === 0) {
        return res.status(400).json({ error: 'No valid recipes found' });
      }

      // Group ingredients
      const groupedIngredients = groupIngredients(recipes);

      // Create shopping list items
      const items = groupedIngredients.map((ingredient, index) => 
        this.itemRepo.create({
          shoppingListId: savedList.id,
          name: ingredient.name,
          quantity: ingredient.totalQuantity,
          unit: ingredient.unit,
          category: ingredient.category,
          notes: `From: ${ingredient.fromRecipes.join(', ')}`,
          displayOrder: index
        })
      );

      await this.itemRepo.save(items);

      // Link recipes to shopping list
      const recipeLinks = recipes.map(recipe =>
        this.shoppingListRecipeRepo.create({
          shoppingListId: savedList.id,
          recipeId: recipe.id
        })
      );

      await this.shoppingListRecipeRepo.save(recipeLinks);

      // Return the complete shopping list
      const result = await this.shoppingListRepo.findOne({
        where: { id: savedList.id },
        relations: ['items', 'recipes', 'recipes.recipe'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      res.status(201).json({ shoppingList: result });
    } catch (error) {
      console.error('Failed to generate shopping list:', error);
      throw createError('Failed to generate shopping list', 500);
    }
  }

  // POST /api/shopping-lists/:id/duplicate - Duplicate shopping list
  async duplicateShoppingList(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const original = await this.shoppingListRepo.findOne({
        where: { id, userId },
        relations: ['items', 'recipes']
      });

      if (!original) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      // Create new shopping list
      const duplicate = this.shoppingListRepo.create({
        name: `${original.name} (Copy)`,
        description: original.description,
        userId
      });

      const savedDuplicate = await this.shoppingListRepo.save(duplicate);

      // Copy items
      if (original.items?.length) {
        const duplicateItems = original.items.map(item =>
          this.itemRepo.create({
            shoppingListId: savedDuplicate.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
            category: item.category,
            displayOrder: item.displayOrder,
            isCompleted: false // Reset completion status
          })
        );

        await this.itemRepo.save(duplicateItems);
      }

      // Copy recipe links
      if (original.recipes?.length) {
        const duplicateRecipes = original.recipes.map(recipe =>
          this.shoppingListRecipeRepo.create({
            shoppingListId: savedDuplicate.id,
            recipeId: recipe.recipeId
          })
        );

        await this.shoppingListRecipeRepo.save(duplicateRecipes);
      }

      // Return the complete duplicate
      const result = await this.shoppingListRepo.findOne({
        where: { id: savedDuplicate.id },
        relations: ['items', 'recipes', 'recipes.recipe'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      res.status(201).json({ shoppingList: result });
    } catch (error) {
      console.error('Failed to duplicate shopping list:', error);
      throw createError('Failed to duplicate shopping list', 500);
    }
  }

  // PATCH /api/shopping-lists/:id/toggle-all - Toggle all items completion
  async toggleAllItems(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { completed } = req.body;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      await this.itemRepo.update(
        { shoppingListId: id },
        { isCompleted: completed === true }
      );

      const updated = await this.shoppingListRepo.findOne({
        where: { id },
        relations: ['items'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      res.json({ shoppingList: updated });
    } catch (error) {
      console.error('Failed to toggle all items:', error);
      throw createError('Failed to toggle all items', 500);
    }
  }

  // DELETE /api/shopping-lists/:id/completed - Clear completed items
  async clearCompletedItems(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      await this.itemRepo.delete({
        shoppingListId: id,
        isCompleted: true
      });

      const updated = await this.shoppingListRepo.findOne({
        where: { id },
        relations: ['items'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      res.json({ shoppingList: updated });
    } catch (error) {
      console.error('Failed to clear completed items:', error);
      throw createError('Failed to clear completed items', 500);
    }
  }

  // POST /api/shopping-lists/:id/items - Add item to shopping list
  async addItem(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const payload: CreateItemPayload = req.body;

      if (!payload.name?.trim()) {
        return res.status(400).json({ error: 'Item name is required' });
      }

      if (!payload.quantity?.trim()) {
        return res.status(400).json({ error: 'Quantity is required' });
      }

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      // Get max display order
      const maxOrder = await this.itemRepo
        .createQueryBuilder('item')
        .select('MAX(item.displayOrder)', 'max')
        .where('item.shoppingListId = :id', { id })
        .getRawOne();

      const item = this.itemRepo.create({
        shoppingListId: id,
        name: payload.name.trim(),
        quantity: payload.quantity.trim(),
        unit: payload.unit?.trim(),
        notes: payload.notes?.trim(),
        category: payload.category?.trim(),
        displayOrder: payload.displayOrder ?? ((maxOrder?.max || -1) + 1)
      });

      const saved = await this.itemRepo.save(item);
      res.status(201).json({ item: saved });
    } catch (error) {
      console.error('Failed to add item:', error);
      throw createError('Failed to add item', 500);
    }
  }

  // PUT /api/shopping-lists/:id/items/:itemId - Update item
  async updateItem(req: AuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.id;
      const payload: UpdateItemPayload = req.body;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      const item = await this.itemRepo.findOne({
        where: { id: itemId, shoppingListId: id }
      });

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (payload.name !== undefined) {
        if (!payload.name.trim()) {
          return res.status(400).json({ error: 'Item name cannot be empty' });
        }
        item.name = payload.name.trim();
      }

      if (payload.quantity !== undefined) {
        if (!payload.quantity.trim()) {
          return res.status(400).json({ error: 'Quantity cannot be empty' });
        }
        item.quantity = payload.quantity.trim();
      }

      if (payload.unit !== undefined) {
        item.unit = payload.unit?.trim() || undefined;
      }

      if (payload.notes !== undefined) {
        item.notes = payload.notes?.trim() || undefined;
      }

      if (payload.category !== undefined) {
        item.category = payload.category?.trim() || undefined;
      }

      if (payload.isCompleted !== undefined) {
        item.isCompleted = payload.isCompleted;
      }

      if (payload.displayOrder !== undefined) {
        item.displayOrder = payload.displayOrder;
      }

      const saved = await this.itemRepo.save(item);
      res.json({ item: saved });
    } catch (error) {
      console.error('Failed to update item:', error);
      throw createError('Failed to update item', 500);
    }
  }

  // PATCH /api/shopping-lists/:id/items/:itemId/toggle - Toggle item completion
  async toggleItem(req: AuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.id;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      const item = await this.itemRepo.findOne({
        where: { id: itemId, shoppingListId: id }
      });

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      item.isCompleted = !item.isCompleted;
      const saved = await this.itemRepo.save(item);

      res.json({ item: saved });
    } catch (error) {
      console.error('Failed to toggle item:', error);
      throw createError('Failed to toggle item', 500);
    }
  }

  // DELETE /api/shopping-lists/:id/items/:itemId - Delete item
  async deleteItem(req: AuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.id;

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      const result = await this.itemRepo.delete({
        id: itemId,
        shoppingListId: id
      });

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw createError('Failed to delete item', 500);
    }
  }

  // PUT /api/shopping-lists/:id/items/reorder - Reorder items
  async reorderItems(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const payload: ReorderItemsPayload = req.body;

      if (!payload.items?.length) {
        return res.status(400).json({ error: 'Items array is required' });
      }

      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId }
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      // Update display orders
      await Promise.all(
        payload.items.map(item =>
          this.itemRepo.update(
            { id: item.id, shoppingListId: id },
            { displayOrder: item.displayOrder }
          )
        )
      );

      const updated = await this.shoppingListRepo.findOne({
        where: { id },
        relations: ['items'],
        order: {
          items: { displayOrder: 'ASC' }
        }
      });

      res.json({ shoppingList: updated });
    } catch (error) {
      console.error('Failed to reorder items:', error);
      throw createError('Failed to reorder items', 500);
    }
  }
}