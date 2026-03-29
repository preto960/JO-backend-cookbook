import { Router } from 'express';
import { ShoppingListController } from '../controllers/shoppingListController';
import { authenticateToken } from '../middleware/auth';
import { checkShoppingListOwnership } from '../middleware/shoppingListPermission';
import { shoppingListRateLimit, shoppingListGenerateRateLimit } from '../middleware/rateLimitShoppingLists';

const router = Router();
const shoppingListController = new ShoppingListController();

// Health check (no auth required)
router.get('/health', shoppingListController.healthCheck.bind(shoppingListController));

// All other routes require authentication
router.use(authenticateToken);

// Apply rate limiting to all shopping list routes
router.use(shoppingListRateLimit);

// Shopping Lists CRUD
router.get('/', shoppingListController.getShoppingLists.bind(shoppingListController));
router.post('/', shoppingListController.createShoppingList.bind(shoppingListController));
router.get('/:id', shoppingListController.getShoppingListById.bind(shoppingListController));
router.put('/:id', shoppingListController.updateShoppingList.bind(shoppingListController));
router.delete('/:id', shoppingListController.deleteShoppingList.bind(shoppingListController));

// Generate from recipes (with stricter rate limiting)
router.post('/generate', shoppingListGenerateRateLimit, shoppingListController.generateShoppingListFromRecipes.bind(shoppingListController));

// Shopping list utilities
router.post('/:id/duplicate', shoppingListController.duplicateShoppingList.bind(shoppingListController));
router.patch('/:id/toggle-all', shoppingListController.toggleAllItems.bind(shoppingListController));
router.delete('/:id/completed', shoppingListController.clearCompletedItems.bind(shoppingListController));

// Items CRUD
router.post('/:id/items', shoppingListController.addItem.bind(shoppingListController));
router.put('/:id/items/:itemId', shoppingListController.updateItem.bind(shoppingListController));
router.patch('/:id/items/:itemId/toggle', shoppingListController.toggleItem.bind(shoppingListController));
router.delete('/:id/items/:itemId', shoppingListController.deleteItem.bind(shoppingListController));
router.put('/:id/items/reorder', shoppingListController.reorderItems.bind(shoppingListController));

// Bulk operations and stats
router.patch('/:id/items/bulk', shoppingListController.bulkUpdateItems.bind(shoppingListController));
router.get('/:id/stats', shoppingListController.getShoppingListStats.bind(shoppingListController));

export { router as shoppingListRoutes };