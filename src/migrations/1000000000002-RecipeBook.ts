import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipeBook1000000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🍽️  Creating recipe book schema...');

    // ─── 1. CATEGORIES ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipe_categories (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        varchar(120) NOT NULL,
        slug        varchar(120) NOT NULL,
        description text,
        color       varchar(7),          -- hex color, e.g. #FF5733
        icon        varchar(60),         -- lucide icon name
        "isActive"  boolean NOT NULL DEFAULT true,
        "createdBy" uuid        REFERENCES users(id) ON DELETE SET NULL,
        "createdAt" timestamp   NOT NULL DEFAULT now(),
        "updatedAt" timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT uq_recipe_categories_slug UNIQUE (slug)
      )
    `);

    // ─── 2. TAGS ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipe_tags (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        varchar(80) NOT NULL,
        slug        varchar(80) NOT NULL,
        "createdAt" timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT uq_recipe_tags_slug UNIQUE (slug)
      )
    `);

    // ─── 3. RECIPES ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE recipe_difficulty AS ENUM ('easy', 'medium', 'hard')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
        title           varchar(200)     NOT NULL,
        slug            varchar(220)     NOT NULL,
        description     text,
        instructions    text             NOT NULL,
        "prepTimeMin"   integer          NOT NULL DEFAULT 0,  -- preparation time in minutes
        "cookTimeMin"   integer          NOT NULL DEFAULT 0,  -- cook time in minutes
        servings        integer          NOT NULL DEFAULT 1,
        difficulty      recipe_difficulty NOT NULL DEFAULT 'medium',
        "coverImage"    varchar(500),                         -- URL
        "isPublished"   boolean          NOT NULL DEFAULT false,
        "isActive"      boolean          NOT NULL DEFAULT true,
        "categoryId"    uuid             REFERENCES recipe_categories(id) ON DELETE SET NULL,
        "createdBy"     uuid             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "updatedBy"     uuid             REFERENCES users(id) ON DELETE SET NULL,
        "createdAt"     timestamp        NOT NULL DEFAULT now(),
        "updatedAt"     timestamp        NOT NULL DEFAULT now(),
        CONSTRAINT uq_recipes_slug UNIQUE (slug)
      )
    `);

    // ─── 4. INGREDIENTS ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "recipeId"   uuid         NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        name         varchar(150) NOT NULL,
        quantity     varchar(60)  NOT NULL,   -- e.g. "2", "1/2", "a pinch"
        unit         varchar(40),             -- e.g. "cups", "grams", "tbsp"
        notes        varchar(255),            -- e.g. "finely chopped"
        "sortOrder"  integer      NOT NULL DEFAULT 0,
        "createdAt"  timestamp    NOT NULL DEFAULT now()
      )
    `);

    // ─── 5. RECIPE ↔ TAGS (many-to-many) ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipe_tag_map (
        "recipeId"  uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        "tagId"     uuid NOT NULL REFERENCES recipe_tags(id) ON DELETE CASCADE,
        PRIMARY KEY ("recipeId", "tagId")
      )
    `);

    // ─── 6. RATINGS ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipe_ratings (
        id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
        "recipeId"  uuid      NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        "userId"    uuid      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score       smallint  NOT NULL CHECK (score BETWEEN 1 AND 5),
        comment     text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT uq_recipe_ratings_user_recipe UNIQUE ("recipeId", "userId")
      )
    `);

    // ─── 7. FAVOURITES ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recipe_favourites (
        "userId"    uuid      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "recipeId"  uuid      NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY ("userId", "recipeId")
      )
    `);

    // ─── 8. INDEXES ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipes_slug         ON recipes ("slug")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipes_category     ON recipes ("categoryId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipes_created_by   ON recipes ("createdBy")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipes_published    ON recipes ("isPublished")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipe_ingr_recipe   ON recipe_ingredients ("recipeId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipe_ratings_rec   ON recipe_ratings ("recipeId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_recipe_favs_user     ON recipe_favourites ("userId")`);

    // ─── 9. PERMISSIONS for RECIPE_BOOK resource ─────────────────────────────
    await queryRunner.query(`
      INSERT INTO permissions (role, resource, "canInMenu", "canView", "canCreate", "canEdit", "canDelete", "pluginId", "isDynamic")
      VALUES
        ('ADMIN',     'RECIPE_BOOK', true,  true,  true,  true,  true,  null, false),
        ('DEVELOPER', 'RECIPE_BOOK', true,  true,  true,  true,  false, null, false),
        ('USER',      'RECIPE_BOOK', true,  true,  false, false, false, null, false)
      ON CONFLICT (role, resource, "pluginId") DO NOTHING
    `);

    // ─── 10. SEED a few default categories ───────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recipe_categories (name, slug, description, color, icon)
      VALUES
        ('Breakfast',  'breakfast',  'Morning meals and brunch ideas',   '#F59E0B', 'coffee'),
        ('Lunch',      'lunch',      'Midday meals',                     '#10B981', 'salad'),
        ('Dinner',     'dinner',     'Evening and main course recipes',  '#6366F1', 'utensils'),
        ('Desserts',   'desserts',   'Sweet treats and baked goods',     '#EC4899', 'cake'),
        ('Snacks',     'snacks',     'Quick bites and appetizers',       '#F97316', 'cookie'),
        ('Beverages',  'beverages',  'Drinks, smoothies and cocktails',  '#0EA5E9', 'glass-water'),
        ('Vegetarian', 'vegetarian', 'Meat-free recipes',                '#84CC16', 'leaf'),
        ('Quick',      'quick',      'Under 30 minutes',                 '#8B5CF6', 'timer')
      ON CONFLICT (slug) DO NOTHING
    `);

    console.log('✅ Recipe book schema created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🗑️  Dropping recipe book schema...');

    await queryRunner.query(`DELETE FROM permissions WHERE resource = 'RECIPE_BOOK'`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_favourites  CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_ratings     CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_tag_map     CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_ingredients CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipes            CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_tags        CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_categories  CASCADE`);
    await queryRunner.query(`DROP TYPE  IF EXISTS recipe_difficulty`);

    console.log('✅ Recipe book schema dropped');
  }
}
