import { Router } from 'express';
import { ShoppingListController } from '../controllers/shoppingListController';
import { authenticateToken } from '../middleware/auth';
import { requireShoppingListPermission } from '../middleware/shoppingListResourcePermission';
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
router.get(
  '/',
  requireShoppingListPermission('view'),
  shoppingListController.getShoppingLists.bind(shoppingListController),
);
router.post(
  '/',
  requireShoppingListPermission('create'),
  shoppingListController.createShoppingList.bind(shoppingListController),
);
router.get(
  '/:id',
  requireShoppingListPermission('view'),
  shoppingListController.getShoppingListById.bind(shoppingListController),
);
router.put(
  '/:id',
  requireShoppingListPermission('edit'),
  shoppingListController.updateShoppingList.bind(shoppingListController),
);
router.delete(
  '/:id',
  requireShoppingListPermission('delete'),
  shoppingListController.deleteShoppingList.bind(shoppingListController),
);

// Generate from recipes (with stricter rate limiting)
router.post(
  '/generate',
  shoppingListGenerateRateLimit,
  requireShoppingListPermission('create'),
  shoppingListController.generateShoppingListFromRecipes.bind(shoppingListController),
);

// Shopping list utilities
router.post(
  '/:id/duplicate',
  requireShoppingListPermission('create'),
  shoppingListController.duplicateShoppingList.bind(shoppingListController),
);
router.patch(
  '/:id/toggle-all',
  requireShoppingListPermission('edit'),
  shoppingListController.toggleAllItems.bind(shoppingListController),
);
router.delete(
  '/:id/completed',
  requireShoppingListPermission('delete'),
  shoppingListController.clearCompletedItems.bind(shoppingListController),
);

// Items CRUD
router.post(
  '/:id/items',
  requireShoppingListPermission('create'),
  shoppingListController.addItem.bind(shoppingListController),
);
router.put(
  '/:id/items/:itemId',
  requireShoppingListPermission('edit'),
  shoppingListController.updateItem.bind(shoppingListController),
);
router.patch(
  '/:id/items/:itemId/toggle',
  requireShoppingListPermission('edit'),
  shoppingListController.toggleItem.bind(shoppingListController),
);
router.get(
  '/:id/items/:itemId/debug',
  requireShoppingListPermission('view'),
  shoppingListController.debugItem.bind(shoppingListController),
);
router.delete(
  '/:id/items/:itemId',
  requireShoppingListPermission('delete'),
  shoppingListController.deleteItem.bind(shoppingListController),
);
router.put(
  '/:id/items/reorder',
  requireShoppingListPermission('edit'),
  shoppingListController.reorderItems.bind(shoppingListController),
);

// Bulk operations and stats
router.patch(
  '/:id/items/bulk',
  requireShoppingListPermission('edit'),
  shoppingListController.bulkUpdateItems.bind(shoppingListController),
);
router.get(
  '/:id/stats',
  requireShoppingListPermission('view'),
  shoppingListController.getShoppingListStats.bind(shoppingListController),
);

export { router as shoppingListRoutes };
