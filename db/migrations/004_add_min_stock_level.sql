    -- Add min_stock_level column to products table
    ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 5;

    -- Update min_stock_level for existing products
    UPDATE products SET min_stock_level = 5 WHERE min_stock_level IS NULL;