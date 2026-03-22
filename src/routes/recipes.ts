import { Router }                  from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { requireRecipePermission } from '../middleware/recipePermission';
import { RecipeController }        from '../controllers/recipeController';

const router     = Router();
const controller = new RecipeController();

// ─── PUBLIC-ish (any authenticated user with view permission) ────────────────
router.get(
  '/',
  authenticateToken,
  requireRecipePermission('view'),
  controller.listRecipes,
);

router.get(
  '/my',
  authenticateToken,
  requireRecipePermission('view'),
  controller.myRecipes,
);

router.get(
  '/favourites',
  authenticateToken,
  requireRecipePermission('view'),
  controller.myFavourites,
);

router.get(
  '/categories',
  authenticateToken,
  requireRecipePermission('view'),
  controller.listCategories,
);

router.get(
  '/tags',
  authenticateToken,
  requireRecipePermission('view'),
  controller.listTags,
);

router.get(
  '/:id',
  authenticateToken,
  requireRecipePermission('view'),
  controller.getRecipe,
);

// ─── WRITE (requires create permission) ─────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  requireRecipePermission('create'),
  controller.createRecipe,
);

// ─── UPDATE (requires edit permission) ──────────────────────────────────────
router.put(
  '/:id',
  authenticateToken,
  requireRecipePermission('edit'),
  controller.updateRecipe,
);

router.patch(
  '/:id/publish',
  authenticateToken,
  requireRecipePermission('edit'),
  controller.togglePublish,
);

// ─── DELETE (requires delete permission) ────────────────────────────────────
router.delete(
  '/:id',
  authenticateToken,
  requireRecipePermission('delete'),
  controller.deleteRecipe,
);

// ─── RATINGS (any authenticated user with view permission can rate) ──────────
router.post(
  '/:id/ratings',
  authenticateToken,
  requireRecipePermission('view'),
  controller.rateRecipe,
);

router.delete(
  '/:id/ratings',
  authenticateToken,
  requireRecipePermission('view'),
  controller.deleteRating,
);

// ─── FAVOURITES (any authenticated user with view permission) ────────────────
router.post(
  '/:id/favourite',
  authenticateToken,
  requireRecipePermission('view'),
  controller.toggleFavourite,
);

// ─── CATEGORY management (admin / developer only) ───────────────────────────
router.post(
  '/categories',
  authenticateToken,
  requireRecipePermission('create'),
  controller.createCategory,
);

router.put(
  '/categories/:id',
  authenticateToken,
  requireRecipePermission('edit'),
  controller.updateCategory,
);

router.delete(
  '/categories/:id',
  authenticateToken,
  requireRecipePermission('delete'),
  controller.deleteCategory,
);

// ─── TAG management (admin / developer only) ─────────────────────────────────
router.post(
  '/tags',
  authenticateToken,
  requireRecipePermission('create'),
  controller.createTag,
);

router.delete(
  '/tags/:id',
  authenticateToken,
  requireRecipePermission('delete'),
  controller.deleteTag,
);

export { router as recipeRoutes };
