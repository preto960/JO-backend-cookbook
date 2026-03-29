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
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
      const search = req.query.search as string;
      const isActive = req.query.isActive as string;
      const offset = (page - 1) * limit;

      // Build the query with proper joins and counts
      let queryBuilder = this.shoppingListRepo
        .createQueryBuilder('sl')
        .leftJoin('sl.items', 'sli')
        .select([
          'sl.id as id',
          'sl.name as name', 
          'sl.description as description',
          'sl.isActive as "isActive"',
          'sl.userId as "userId"',
          'sl.createdAt as "createdAt"',
          'sl.updatedAt as "updatedAt"',
          'COUNT(sli.id) as "itemCount"',
          'COUNT(CASE WHEN sli.isCompleted = true THEN 1 END) as "completedCount"'
        ])
        .where('sl.userId = :userId', { userId })
        .groupBy('sl.id, sl.name, sl.description, sl.isActive, sl.userId, sl.createdAt, sl.updatedAt')
        .orderBy('sl.isActive', 'DESC') // Show active lists first
        .addOrderBy('sl.updatedAt', 'DESC') // Then by update date
        .limit(limit)
        .offset(offset);

      // Add search filter
      if (search && search.trim()) {
        queryBuilder = queryBuilder.andWhere('sl.name ILIKE :search', { 
          search: `%${search.trim()}%` 
        });
      }

      // Add active filter (only when explicitly specified)
      if (isActive !== undefined) {
        queryBuilder = queryBuilder.andWhere('sl.isActive = :isActive', { 
          isActive: isActive === 'true' 
        });
      }
      // If no filter specified, show all lists (active and inactive)

      // Execute the main query
      const rawResults = await queryBuilder.getRawMany();

      // Count total records (separate query for accuracy)
      let countBuilder = this.shoppingListRepo
        .createQueryBuilder('sl')
        .where('sl.userId = :userId', { userId });

      if (search && search.trim()) {
        countBuilder = countBuilder.andWhere('sl.name ILIKE :search', { 
          search: `%${search.trim()}%` 
        });
      }

      if (isActive !== undefined) {
        countBuilder = countBuilder.andWhere('sl.isActive = :isActive', { 
          isActive: isActive === 'true' 
        });
      }

      const total = await countBuilder.getCount();

      // Format the response
      const shoppingLists = rawResults.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: row.isActive,
        userId: row.userId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        itemCount: parseInt(row.itemCount) || 0,
        completedCount: parseInt(row.completedCount) || 0
      }));

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=60',
        'ETag': `"${userId}-${total}-${shoppingLists[0]?.updatedAt?.getTime() || 0}"`
      });

      res.json({
        shoppingLists,
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

      // Use raw SQL to ensure we get the most up-to-date data
      const listQuery = `
        SELECT 
          sl.id,
          sl.name,
          sl.description,
          sl.is_active,
          sl.user_id,
          sl.created_at,
          sl.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', sli.id,
                'name', sli.name,
                'quantity', sli.quantity,
                'unit', sli.unit,
                'notes', sli.notes,
                'isCompleted', sli.is_completed,  -- ← Ensure this is correct
                'category', sli.category,
                'displayOrder', sli.display_order,
                'createdAt', sli.created_at,
                'updatedAt', sli.updated_at
              ) ORDER BY sli.display_order ASC, sli.created_at ASC
            ) FILTER (WHERE sli.id IS NOT NULL), 
            '[]'::json
          ) as items
        FROM shopping_lists sl
        LEFT JOIN shopping_list_items sli ON sl.id = sli.shopping_list_id
        WHERE sl.id = $1 AND sl.user_id = $2
        GROUP BY sl.id, sl.name, sl.description, sl.is_active, sl.user_id, sl.created_at, sl.updated_at
      `;

      const result = await this.shoppingListRepo.query(listQuery, [id, userId]);

      if (result.length === 0) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      const listData = result[0];
      const items = listData.items || [];

      // Get linked recipes (optional)
      const recipesQuery = `
        SELECT 
          slr.id,
          slr.recipe_id,
          slr.created_at,
          r.id as recipe_id,
          r.title as recipe_title,
          r.slug as recipe_slug
        FROM shopping_list_recipes slr
        INNER JOIN recipes r ON slr.recipe_id = r.id
        WHERE slr.shopping_list_id = $1
      `;

      const recipesResult = await this.shoppingListRecipeRepo.query(recipesQuery, [id]);

      // Format the response
      const shoppingList = {
        id: listData.id,
        name: listData.name,
        description: listData.description,
        isActive: listData.is_active,
        userId: listData.user_id,
        createdAt: listData.created_at,
        updatedAt: listData.updated_at,
        items: items,
        recipes: recipesResult.map((r: any) => ({
          id: r.id,
          recipeId: r.recipe_id,
          recipe: {
            id: r.recipe_id,
            title: r.recipe_title,
            slug: r.recipe_slug
          },
          createdAt: r.created_at
        })),
        itemCount: items.length,
        completedCount: items.filter((item: any) => item.isCompleted === true).length
      };

      // Set cache headers (shorter cache since data changes frequently)
      res.set({
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'ETag': `"${id}-${listData.updated_at}"`
      });

      res.json({ shoppingList });

    } catch (error) {
      console.error('Failed to fetch shopping list:', error);
      res.status(500).json({ error: 'Failed to fetch shopping list' });
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

      // Validation
      if (!payload.name?.trim()) {
        return res.status(400).json({ error: 'Item name is required' });
      }

      if (!payload.quantity?.trim()) {
        return res.status(400).json({ error: 'Quantity is required' });
      }

      // Verify list ownership
      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId },
        select: ['id']
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      // Get max display order efficiently
      const maxOrderResult = await this.itemRepo
        .createQueryBuilder('item')
        .select('COALESCE(MAX(item.displayOrder), -1)', 'maxOrder')
        .where('item.shoppingListId = :id', { id })
        .getRawOne();

      const nextOrder = (parseInt(maxOrderResult.maxOrder) || -1) + 1;

      // Create and save item
      const item = this.itemRepo.create({
        shoppingListId: id,
        name: payload.name.trim(),
        quantity: payload.quantity.trim(),
        unit: payload.unit?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        category: payload.category?.trim() || undefined,
        displayOrder: payload.displayOrder ?? nextOrder,
        isCompleted: false
      });

      const saved = await this.itemRepo.save(item);
      
      res.status(201).json({ 
        item: saved,
        message: 'Item added successfully'
      });
    } catch (error) {
      console.error('Failed to add item:', error);
      res.status(500).json({ error: 'Failed to add item' });
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

      // 1. Verify ownership and get current item state with raw SQL
      const currentItemQuery = `
        SELECT sli.*, sl.user_id 
        FROM shopping_list_items sli
        INNER JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
        WHERE sli.id = $1 AND sli.shopping_list_id = $2 AND sl.user_id = $3
      `;
      
      const currentItemResult = await this.itemRepo.query(currentItemQuery, [itemId, id, userId]);

      if (currentItemResult.length === 0) {
        return res.status(404).json({ error: 'Item not found or access denied' });
      }

      const currentItem = currentItemResult[0];
      const newCompletedState = !currentItem.is_completed;

      // 2. CRITICAL: Update in database with raw SQL and return updated data
      const updateQuery = `
        UPDATE shopping_list_items 
        SET is_completed = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING *
      `;

      const updatedResult = await this.itemRepo.query(updateQuery, [newCompletedState, itemId]);

      if (updatedResult.length === 0) {
        return res.status(500).json({ error: 'Failed to update item' });
      }

      // 3. Format the response with the updated data
      const result = updatedResult[0];
      const formattedItem = {
        id: result.id,
        shoppingListId: result.shopping_list_id,
        name: result.name,
        quantity: result.quantity,
        unit: result.unit,
        notes: result.notes,
        isCompleted: result.is_completed, // ← This must be the new value
        category: result.category,
        displayOrder: result.display_order,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };

      res.json({
        item: formattedItem,
        message: `Item marked as ${newCompletedState ? 'completed' : 'pending'}`,
        debug: {
          previousState: currentItem.is_completed,
          newState: newCompletedState,
          actualDatabaseValue: result.is_completed
        }
      });

    } catch (error) {
      console.error('Failed to toggle item:', error);
      console.error('Error details:', error);
      res.status(500).json({ error: 'Failed to toggle item', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // DELETE /api/shopping-lists/:id/items/:itemId - Delete item
  async deleteItem(req: AuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.id;

      // Verify ownership and delete in one operation
      const deleteResult = await this.itemRepo
        .createQueryBuilder('item')
        .delete()
        .where('item.id = :itemId', { itemId })
        .andWhere('item.shoppingListId = :listId', { listId: id })
        .andWhere('EXISTS (SELECT 1 FROM shopping_lists sl WHERE sl.id = :listId AND sl.userId = :userId)', { 
          listId: id, 
          userId 
        })
        .execute();

      if (deleteResult.affected === 0) {
        return res.status(404).json({ error: 'Item not found or access denied' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete item:', error);
      res.status(500).json({ error: 'Failed to delete item' });
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

      // Verify list ownership
      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId },
        select: ['id']
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      // Batch update display orders efficiently
      const updatePromises = payload.items.map(item =>
        this.itemRepo.update(
          { id: item.id, shoppingListId: id },
          { displayOrder: item.displayOrder }
        )
      );

      await Promise.all(updatePromises);

      res.json({ 
        message: 'Items reordered successfully',
        updatedCount: payload.items.length
      });
    } catch (error) {
      console.error('Failed to reorder items:', error);
      res.status(500).json({ error: 'Failed to reorder items' });
    }
  }

  // PATCH /api/shopping-lists/:id/items/bulk - Bulk operations on items
  async bulkUpdateItems(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { action, itemIds } = req.body;

      if (!action || !itemIds?.length) {
        return res.status(400).json({ error: 'Action and itemIds are required' });
      }

      // Verify list ownership
      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId },
        select: ['id']
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      let updateResult;
      let message;

      switch (action) {
        case 'complete':
          updateResult = await this.itemRepo.update(
            { id: In(itemIds), shoppingListId: id },
            { isCompleted: true }
          );
          message = `${updateResult.affected} items marked as completed`;
          break;

        case 'uncomplete':
          updateResult = await this.itemRepo.update(
            { id: In(itemIds), shoppingListId: id },
            { isCompleted: false }
          );
          message = `${updateResult.affected} items marked as pending`;
          break;

        case 'delete':
          updateResult = await this.itemRepo.delete({
            id: In(itemIds),
            shoppingListId: id
          });
          message = `${updateResult.affected} items deleted`;
          break;

        default:
          return res.status(400).json({ error: 'Invalid action. Use: complete, uncomplete, or delete' });
      }

      res.json({
        message,
        affectedCount: updateResult.affected || 0
      });
    } catch (error) {
      console.error('Failed to perform bulk operation:', error);
      res.status(500).json({ error: 'Failed to perform bulk operation' });
    }
  }

  // GET /api/shopping-lists/:id/items/:itemId/debug - Debug item state
  async debugItem(req: AuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const userId = req.user!.id;

      // Verify list ownership
      const shoppingList = await this.shoppingListRepo.findOne({
        where: { id, userId },
        select: ['id']
      });

      if (!shoppingList) {
        return res.status(404).json({ error: 'Shopping list not found' });
      }

      // Get item with all fields
      const item = await this.itemRepo.findOne({
        where: { id: itemId, shoppingListId: id }
      });

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Also get raw SQL result to compare
      const rawResult = await this.itemRepo.query(
        'SELECT id, name, is_completed, shopping_list_id FROM shopping_list_items WHERE id = $1',
        [itemId]
      );

      res.json({
        typeormResult: item,
        rawSqlResult: rawResult[0] || null,
        columnMapping: {
          isCompleted: item.isCompleted,
          is_completed_raw: rawResult[0]?.is_completed
        }
      });
    } catch (error) {
      console.error('Failed to debug item:', error);
      res.status(500).json({ error: 'Failed to debug item' });
    }
  }

  // GET /api/shopping-lists/:id/stats - Get shopping list statistics
  async getShoppingListStats(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify ownership and get stats in one query
      const stats = await this.itemRepo
        .createQueryBuilder('item')
        .innerJoin('item.shoppingList', 'list')
        .select([
          'COUNT(item.id) as totalItems',
          'COUNT(CASE WHEN item.isCompleted = true THEN 1 END) as completedItems',
          'COUNT(CASE WHEN item.isCompleted = false THEN 1 END) as pendingItems',
          'COUNT(DISTINCT item.category) as categoriesCount'
        ])
        .where('list.id = :listId', { listId: id })
        .andWhere('list.userId = :userId', { userId })
        .getRawOne();

      if (!stats || parseInt(stats.totalitems) === 0) {
        // Check if list exists
        const listExists = await this.shoppingListRepo.findOne({
          where: { id, userId },
          select: ['id']
        });

        if (!listExists) {
          return res.status(404).json({ error: 'Shopping list not found' });
        }
      }

      const totalItems = parseInt(stats.totalitems) || 0;
      const completedItems = parseInt(stats.completeditems) || 0;
      const pendingItems = parseInt(stats.pendingitems) || 0;
      const categoriesCount = parseInt(stats.categoriescount) || 0;

      res.json({
        stats: {
          totalItems,
          completedItems,
          pendingItems,
          categoriesCount,
          completionPercentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
        }
      });
    } catch (error) {
      console.error('Failed to get shopping list stats:', error);
      res.status(500).json({ error: 'Failed to get shopping list stats' });
    }
  }
}