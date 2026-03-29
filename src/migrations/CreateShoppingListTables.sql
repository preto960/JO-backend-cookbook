-- ─────────────────────────────────────────────────────────────────────────────
-- Shopping Lists Migration
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: This migration is NOT executed automatically. 
-- Run manually when ready to deploy shopping lists feature.

-- Tabla de Shopping Lists
CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Items de Shopping Lists
CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity VARCHAR(100) NOT NULL,
    unit VARCHAR(50),
    notes TEXT,
    category VARCHAR(100),
    is_completed BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de relación Shopping Lists <-> Recetas (opcional, para tracking)
CREATE TABLE shopping_list_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_shopping_lists_user_id ON shopping_lists(user_id);
CREATE INDEX idx_shopping_list_items_list_id ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_order ON shopping_list_items(shopping_list_id, display_order);

-- Comentarios para documentación
COMMENT ON TABLE shopping_lists IS 'Listas de compras de los usuarios';
COMMENT ON TABLE shopping_list_items IS 'Items individuales de las listas de compras';
COMMENT ON TABLE shopping_list_recipes IS 'Relación entre listas de compras y recetas que las generaron';

COMMENT ON COLUMN shopping_lists.name IS 'Nombre de la lista de compras';
COMMENT ON COLUMN shopping_lists.description IS 'Descripción opcional de la lista';
COMMENT ON COLUMN shopping_lists.is_active IS 'Si la lista está activa o archivada';

COMMENT ON COLUMN shopping_list_items.name IS 'Nombre del ingrediente/item';
COMMENT ON COLUMN shopping_list_items.quantity IS 'Cantidad como string (ej: "2", "1/2 taza")';
COMMENT ON COLUMN shopping_list_items.unit IS 'Unidad de medida (ej: "kg", "litros")';
COMMENT ON COLUMN shopping_list_items.category IS 'Categoría del item (ej: "Dairy", "Vegetables")';
COMMENT ON COLUMN shopping_list_items.is_completed IS 'Si el item ya fue comprado/completado';
COMMENT ON COLUMN shopping_list_items.display_order IS 'Orden de visualización en la lista';