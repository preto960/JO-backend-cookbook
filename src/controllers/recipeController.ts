import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Recipe, RecipeDifficulty } from '../models/Recipe';
import { RecipeCategory }   from '../models/RecipeCategory';
import { RecipeIngredient } from '../models/RecipeIngredient';
import { RecipeTag }        from '../models/RecipeTag';
import { RecipeRating }     from '../models/RecipeRating';
import { RecipeFavourite }  from '../models/RecipeFavourite';
import { AuthRequest }      from '../middleware/auth';
import { createError }      from '../middleware/errorHandler';
import { ILike, IsNull, Not } from 'typeorm';

// ── helpers ───────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureUniqueSlug(
  repo: ReturnType<typeof AppDataSource.getRepository>,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug   = baseSlug;
  let suffix = 1;

  while (true) {
    const where: any = { slug };
    if (excludeId) where.id = Not(excludeId);
    const exists = await (repo as any).findOne({ where });
    if (!exists) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIPE CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
export class RecipeController {
  private recipeRepo     = AppDataSource.getRepository(Recipe);
  private categoryRepo   = AppDataSource.getRepository(RecipeCategory);
  private ingredientRepo = AppDataSource.getRepository(RecipeIngredient);
  private tagRepo        = AppDataSource.getRepository(RecipeTag);
  private ratingRepo     = AppDataSource.getRepository(RecipeRating);
  private favouriteRepo  = AppDataSource.getRepository(RecipeFavourite);

  // ── LIST (paginated, filtered) ─────────────────────────────────────────────
  listRecipes = async (req: AuthRequest, res: Response) => {
    try {
      const {
        page      = '1',
        limit     = '20',
        search,
        categoryId,
        difficulty,
        published,
        sortBy    = 'createdAt',
        sortOrder = 'DESC',
      } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset   = (pageNum - 1) * limitNum;

      const qb = this.recipeRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.category',    'category')
        .leftJoinAndSelect('r.tags',        'tags')
        .leftJoinAndSelect('r.creator',     'creator')
        .leftJoinAndSelect('r.ratings',     'ratings')
        .loadRelationCountAndMap('r.ratingCount', 'r.ratings')
        .where('r.isActive = true');

      // Non-admin users can only see published recipes that are not their own
      const isAdmin = ['ADMIN', 'DEVELOPER'].includes(req.user?.role || '');
      if (!isAdmin) {
        qb.andWhere('(r.isPublished = true OR r.createdBy = :uid)', { uid: req.user?.id });
      }

      if (search)     qb.andWhere('(r.title ILIKE :s OR r.description ILIKE :s)', { s: `%${search}%` });
      if (categoryId) qb.andWhere('r.categoryId = :categoryId', { categoryId });
      if (difficulty) qb.andWhere('r.difficulty = :difficulty', { difficulty });
      if (published !== undefined) qb.andWhere('r.isPublished = :pub', { pub: published === 'true' });

      const validSort = ['createdAt', 'updatedAt', 'title', 'prepTimeMin', 'cookTimeMin', 'servings'];
      const sortField = validSort.includes(sortBy) ? `r.${sortBy}` : 'r.createdAt';
      const order     = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      qb.orderBy(sortField, order).skip(offset).take(limitNum);

      const [recipes, total] = await qb.getManyAndCount();

      // Calculate average rating for each recipe
      const recipesWithAverage = recipes.map(recipe => {
        const averageRating = recipe.ratings && recipe.ratings.length > 0
          ? recipe.ratings.reduce((sum, r) => sum + r.score, 0) / recipe.ratings.length
          : null;
        
        // Remove ratings array from response to keep it clean
        const { ratings, ...recipeWithoutRatings } = recipe;
        
        return {
          ...recipeWithoutRatings,
          averageRating
        };
      });

      res.json({
        recipes: recipesWithAverage,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error('Error listing recipes:', error);
      res.status(500).json({ message: 'Failed to list recipes' });
    }
  };

  // ── GET ONE ────────────────────────────────────────────────────────────────
  getRecipe = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const recipe = await this.recipeRepo.findOne({
        where: { id, isActive: true },
        relations: ['category', 'tags', 'creator', 'ingredients', 'ratings', 'ratings.user'],
      });

      if (!recipe) throw createError('Recipe not found', 404);

      // Non-admin users cannot see unpublished recipes from others
      const isAdmin    = ['ADMIN', 'DEVELOPER'].includes(req.user?.role || '');
      const isOwner    = recipe.createdBy === req.user?.id;
      if (!recipe.isPublished && !isAdmin && !isOwner) {
        throw createError('Recipe not found', 404);
      }

      // Average rating
      const avg = recipe.ratings.length
        ? recipe.ratings.reduce((sum, r) => sum + r.score, 0) / recipe.ratings.length
        : null;

      // Is favourited by current user?
      let isFavourited = false;
      if (req.user) {
        const fav = await this.favouriteRepo.findOne({
          where: { userId: req.user.id, recipeId: recipe.id },
        });
        isFavourited = !!fav;
      }

      res.json({ recipe: { ...recipe, averageRating: avg, isFavourited } });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to get recipe' });
    }
  };

  // ── CREATE ─────────────────────────────────────────────────────────────────
  createRecipe = async (req: AuthRequest, res: Response) => {
    try {
      const {
        title, description, instructions,
        prepTimeMin = 0, cookTimeMin = 0, servings = 1,
        difficulty = RecipeDifficulty.MEDIUM,
        coverImage, isPublished = false,
        categoryId, ingredients = [], tags = [],
      } = req.body;

      if (!title || !instructions) {
        throw createError('Title and instructions are required', 400);
      }

      const baseSlug = slugify(title);
      const slug     = await ensureUniqueSlug(this.recipeRepo, baseSlug);

      const recipe = this.recipeRepo.create({
        title,
        slug,
        description,
        instructions,
        prepTimeMin: Number(prepTimeMin),
        cookTimeMin: Number(cookTimeMin),
        servings:    Number(servings),
        difficulty,
        coverImage,
        isPublished: Boolean(isPublished),
        categoryId:  categoryId || null,
        createdBy:   req.user!.id,
      });

      // Handle tags (find or create)
      if (tags.length) {
        recipe.tags = await this.resolveOrCreateTags(tags);
      }

      const saved = await this.recipeRepo.save(recipe);

      // Persist ingredients
      if (ingredients.length) {
        const ingEntities = ingredients.map((ing: any, idx: number) =>
          this.ingredientRepo.create({
            recipeId:  saved.id,
            name:      ing.name,
            quantity:  ing.quantity,
            unit:      ing.unit || null,
            notes:     ing.notes || null,
            sortOrder: ing.sortOrder ?? idx,
          }),
        );
        await this.ingredientRepo.save(ingEntities);
      }

      const full = await this.recipeRepo.findOne({
        where: { id: saved.id },
        relations: ['category', 'tags', 'creator', 'ingredients'],
      });

      res.status(201).json({ message: 'Recipe created successfully', recipe: full });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to create recipe' });
    }
  };

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  updateRecipe = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const recipe = await this.recipeRepo.findOne({
        where: { id, isActive: true },
        relations: ['tags', 'ingredients'],
      });
      if (!recipe) throw createError('Recipe not found', 404);

      // Only owner or admin can update
      const isAdmin = ['ADMIN', 'DEVELOPER'].includes(req.user?.role || '');
      if (!isAdmin && recipe.createdBy !== req.user?.id) {
        throw createError('You are not allowed to edit this recipe', 403);
      }

      const {
        title, description, instructions,
        prepTimeMin, cookTimeMin, servings, difficulty,
        coverImage, isPublished, categoryId,
        ingredients, tags,
      } = req.body;

      if (title !== undefined)        { recipe.title = title; }
      if (description !== undefined)  { recipe.description = description; }
      if (instructions !== undefined) { recipe.instructions = instructions; }
      if (prepTimeMin !== undefined)  { recipe.prepTimeMin = Number(prepTimeMin); }
      if (cookTimeMin !== undefined)  { recipe.cookTimeMin = Number(cookTimeMin); }
      if (servings !== undefined)     { recipe.servings = Number(servings); }
      if (difficulty !== undefined)   { recipe.difficulty = difficulty; }
      if (coverImage !== undefined)   { recipe.coverImage = coverImage; }
      if (isPublished !== undefined)  { recipe.isPublished = Boolean(isPublished); }
      if (categoryId !== undefined)   { recipe.categoryId = categoryId || null; }

      recipe.updatedBy = req.user!.id;

      // Re-slug if title changed
      if (title && title !== recipe.title) {
        recipe.slug = await ensureUniqueSlug(this.recipeRepo, slugify(title), id);
      }

      // Update tags
      if (tags !== undefined) {
        recipe.tags = await this.resolveOrCreateTags(tags);
      }

      await this.recipeRepo.save(recipe);

      // Replace ingredients
      if (ingredients !== undefined) {
        await this.ingredientRepo.delete({ recipeId: id });
        if (ingredients.length) {
          const ingEntities = ingredients.map((ing: any, idx: number) =>
            this.ingredientRepo.create({
              recipeId:  id,
              name:      ing.name,
              quantity:  ing.quantity,
              unit:      ing.unit || null,
              notes:     ing.notes || null,
              sortOrder: ing.sortOrder ?? idx,
            }),
          );
          await this.ingredientRepo.save(ingEntities);
        }
      }

      const full = await this.recipeRepo.findOne({
        where: { id },
        relations: ['category', 'tags', 'creator', 'ingredients'],
      });

      res.json({ message: 'Recipe updated successfully', recipe: full });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to update recipe' });
    }
  };

  // ── DELETE (soft) ─────────────────────────────────────────────────────────
  deleteRecipe = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const recipe = await this.recipeRepo.findOne({ where: { id, isActive: true } });
      if (!recipe) throw createError('Recipe not found', 404);

      const isAdmin = ['ADMIN'].includes(req.user?.role || '');
      if (!isAdmin && recipe.createdBy !== req.user?.id) {
        throw createError('You are not allowed to delete this recipe', 403);
      }

      recipe.isActive    = false;
      recipe.isPublished = false;
      recipe.updatedBy   = req.user!.id;
      await this.recipeRepo.save(recipe);

      res.json({ message: 'Recipe deleted successfully' });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to delete recipe' });
    }
  };

  // ── TOGGLE PUBLISH ─────────────────────────────────────────────────────────
  togglePublish = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const recipe = await this.recipeRepo.findOne({ where: { id, isActive: true } });
      if (!recipe) throw createError('Recipe not found', 404);

      const isAdmin = ['ADMIN', 'DEVELOPER'].includes(req.user?.role || '');
      if (!isAdmin && recipe.createdBy !== req.user?.id) {
        throw createError('You are not allowed to publish/unpublish this recipe', 403);
      }

      recipe.isPublished = !recipe.isPublished;
      recipe.updatedBy   = req.user!.id;
      await this.recipeRepo.save(recipe);

      res.json({
        message:     `Recipe ${recipe.isPublished ? 'published' : 'unpublished'} successfully`,
        isPublished: recipe.isPublished,
      });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to toggle publish' });
    }
  };

  // ── MY RECIPES ─────────────────────────────────────────────────────────────
  myRecipes = async (req: AuthRequest, res: Response) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, parseInt(limit));

      const [recipes, total] = await this.recipeRepo.findAndCount({
        where:    { createdBy: req.user!.id, isActive: true },
        relations: ['category', 'tags', 'ratings'],
        order:    { createdAt: 'DESC' },
        skip:     (pageNum - 1) * limitNum,
        take:     limitNum,
      });

      // Calculate average rating for each recipe
      const recipesWithAverage = recipes.map(recipe => {
        const averageRating = recipe.ratings && recipe.ratings.length > 0
          ? recipe.ratings.reduce((sum, r) => sum + r.score, 0) / recipe.ratings.length
          : null;
        
        // Remove ratings array from response to keep it clean
        const { ratings, ...recipeWithoutRatings } = recipe;
        
        return {
          ...recipeWithoutRatings,
          averageRating
        };
      });

      res.json({
        recipes: recipesWithAverage,
        pagination: {
          page: pageNum, limit: limitNum, total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch your recipes' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RATINGS
  // ─────────────────────────────────────────────────────────────────────────
  rateRecipe = async (req: AuthRequest, res: Response) => {
    try {
      const { id: recipeId } = req.params;
      const { score, comment } = req.body;

      if (!score || score < 1 || score > 5) {
        throw createError('Score must be between 1 and 5', 400);
      }

      const recipe = await this.recipeRepo.findOne({ where: { id: recipeId, isActive: true } });
      if (!recipe) throw createError('Recipe not found', 404);

      let rating = await this.ratingRepo.findOne({
        where: { recipeId, userId: req.user!.id },
      });

      if (rating) {
        rating.score   = score;
        rating.comment = comment || null;
      } else {
        rating = this.ratingRepo.create({
          recipeId,
          userId:  req.user!.id,
          score,
          comment: comment || null,
        });
      }

      await this.ratingRepo.save(rating);
      res.json({ message: 'Rating saved', rating });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to rate recipe' });
    }
  };

  deleteRating = async (req: AuthRequest, res: Response) => {
    try {
      const { id: recipeId } = req.params;

      const rating = await this.ratingRepo.findOne({
        where: { recipeId, userId: req.user!.id },
      });
      if (!rating) throw createError('Rating not found', 404);

      await this.ratingRepo.remove(rating);
      res.json({ message: 'Rating removed' });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to remove rating' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FAVOURITES
  // ─────────────────────────────────────────────────────────────────────────
  toggleFavourite = async (req: AuthRequest, res: Response) => {
    try {
      const { id: recipeId } = req.params;

      const recipe = await this.recipeRepo.findOne({ where: { id: recipeId, isActive: true } });
      if (!recipe) throw createError('Recipe not found', 404);

      const existing = await this.favouriteRepo.findOne({
        where: { userId: req.user!.id, recipeId },
      });

      if (existing) {
        await this.favouriteRepo.remove(existing);
        return res.json({ message: 'Removed from favourites', isFavourited: false });
      }

      const fav = this.favouriteRepo.create({ userId: req.user!.id, recipeId });
      await this.favouriteRepo.save(fav);
      res.json({ message: 'Added to favourites', isFavourited: true });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to toggle favourite' });
    }
  };

  myFavourites = async (req: AuthRequest, res: Response) => {
    try {
      const favs = await this.favouriteRepo.find({
        where:    { userId: req.user!.id },
        relations: ['recipe', 'recipe.category', 'recipe.tags', 'recipe.ratings'],
        order:    { createdAt: 'DESC' },
      });

      const recipes = favs
        .map((f) => f.recipe)
        .filter((r) => r?.isActive && r?.isPublished)
        .map(recipe => {
          const averageRating = recipe.ratings && recipe.ratings.length > 0
            ? recipe.ratings.reduce((sum, r) => sum + r.score, 0) / recipe.ratings.length
            : null;
          
          // Remove ratings array from response to keep it clean
          const { ratings, ...recipeWithoutRatings } = recipe;
          
          return {
            ...recipeWithoutRatings,
            averageRating
          };
        });

      res.json({ recipes });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch favourites' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORIES (admin)
  // ─────────────────────────────────────────────────────────────────────────
  listCategories = async (_req: AuthRequest, res: Response) => {
    try {
      const categories = await this.categoryRepo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      });
      res.json({ categories });
    } catch {
      res.status(500).json({ message: 'Failed to list categories' });
    }
  };

  createCategory = async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, color, icon } = req.body;
      if (!name) throw createError('Name is required', 400);

      const slug = await ensureUniqueSlug(this.categoryRepo, slugify(name));

      const cat = this.categoryRepo.create({
        name, slug, description, color, icon,
        createdBy: req.user!.id,
      });

      await this.categoryRepo.save(cat);
      res.status(201).json({ message: 'Category created', category: cat });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to create category' });
    }
  };

  updateCategory = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const cat = await this.categoryRepo.findOne({ where: { id } });
      if (!cat) throw createError('Category not found', 404);

      const { name, description, color, icon, isActive } = req.body;
      if (name !== undefined)        cat.name        = name;
      if (description !== undefined) cat.description = description;
      if (color !== undefined)       cat.color       = color;
      if (icon !== undefined)        cat.icon        = icon;
      if (isActive !== undefined)    cat.isActive    = Boolean(isActive);

      await this.categoryRepo.save(cat);
      res.json({ message: 'Category updated', category: cat });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to update category' });
    }
  };

  deleteCategory = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const cat = await this.categoryRepo.findOne({ where: { id } });
      if (!cat) throw createError('Category not found', 404);

      cat.isActive = false;
      await this.categoryRepo.save(cat);
      res.json({ message: 'Category deleted' });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to delete category' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TAGS (admin)
  // ─────────────────────────────────────────────────────────────────────────
  listTags = async (_req: AuthRequest, res: Response) => {
    try {
      const tags = await this.tagRepo.find({ order: { name: 'ASC' } });
      res.json({ tags });
    } catch {
      res.status(500).json({ message: 'Failed to list tags' });
    }
  };

  createTag = async (req: AuthRequest, res: Response) => {
    try {
      const { name } = req.body;
      if (!name) throw createError('Name is required', 400);

      const slug = slugify(name);
      const existing = await this.tagRepo.findOne({ where: { slug } });
      if (existing) return res.json({ message: 'Tag already exists', tag: existing });

      const tag = this.tagRepo.create({ name, slug });
      await this.tagRepo.save(tag);
      res.status(201).json({ message: 'Tag created', tag });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to create tag' });
    }
  };

  deleteTag = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const tag = await this.tagRepo.findOne({ where: { id } });
      if (!tag) throw createError('Tag not found', 404);

      await this.tagRepo.remove(tag);
      res.json({ message: 'Tag deleted' });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to delete tag' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  private async resolveOrCreateTags(tags: Array<{ id?: string; name: string }>): Promise<RecipeTag[]> {
    const result: RecipeTag[] = [];

    for (const t of tags) {
      if (t.id) {
        const existing = await this.tagRepo.findOne({ where: { id: t.id } });
        if (existing) { result.push(existing); continue; }
      }
      const slug     = slugify(t.name);
      let   existing = await this.tagRepo.findOne({ where: { slug } });
      if (!existing) {
        existing = await this.tagRepo.save(this.tagRepo.create({ name: t.name, slug }));
      }
      result.push(existing);
    }

    return result;
  }
}
