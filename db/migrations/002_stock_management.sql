-- Create products table for stock management
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_movements table for tracking inventory changes
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    movement_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT'
    quantity INTEGER NOT NULL,
    reason VARCHAR(255),
    reference_id INTEGER, -- order_id, adjustment_id, etc.
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert existing products into the products table
INSERT INTO products (id, name, description, category, price, original_price, stock_quantity, image_url) VALUES
(1, 'Honey Refractometer', 'Measure honey moisture content accurately. Essential for quality control.', 'Honey Processing', 6200, 6600, 15, NULL),
(2, 'Queen Excluder', 'Prevents queen from entering honey supers while allowing workers through.', 'Hive Components', 900, 1000, 25, NULL),
(3, 'Framewire', 'High-quality wire for reinforcing frames and foundation.', 'Hive Components', 1300, 1400, 50, NULL),
(4, 'Bee Wax', 'Pure natural beeswax for various beekeeping and craft applications.', 'Specialty Items', 1300, 1400, 20, NULL),
(5, 'Bee Gloves', 'Protective leather gloves with extended cuffs for bee handling.', 'Protective Equipment', 800, 900, 30, NULL),
(6, 'Honey Buckets', 'Food-grade buckets for honey storage and transport.', 'Storage & Containers', 1000, 1200, 12, NULL),
(7, 'Comb Foundation', 'Wax foundation sheets for frame construction.', 'Hive Components', 50, 60, 100, NULL),
(8, 'Conical Sieve', 'Stainless steel strainer for filtering honey and removing impurities.', 'Honey Processing', 800, 900, 18, NULL),
(9, 'Uncapping Fork', 'Tool for uncapping honey cells before extraction.', 'Tools & Equipment', 800, 900, 22, NULL),
(10, 'Pollen Collector', 'Device for collecting pollen from returning forager bees.', 'Specialty Items', 3500, 3900, 8, NULL),
(11, 'Double Sieve', 'Two-layer straining system for superior honey filtration.', 'Honey Processing', 3100, 3500, 10, NULL),
(12, '4 Frames Manual Centrifuge Honey Extractor', 'Manual honey extractor for 4 frames. Stainless steel construction.', 'Honey Processing', 44000, 46000, 3, NULL),
(13, '6 Frames Manual Centrifuge Honey Extractor', 'Manual honey extractor for 6 frames. Heavy-duty stainless steel.', 'Honey Processing', 71000, 72000, 2, NULL),
(14, 'Lemon Grass (Bee Lure)', 'Natural lemon grass essential oil for attracting bee swarms.', 'Specialty Items', 1300, 1350, 25, NULL),
(15, 'Plastic Settling Buckets', 'Food-grade plastic buckets for honey settling and storage.', 'Storage & Containers', 1300, 1500, 15, NULL),
(16, 'Stainless Bee Smoker', 'Premium stainless steel smoker with bellows for bee calming.', 'Tools & Equipment', 2800, 3000, 12, NULL),
(17, 'Hive Tool', 'Multi-purpose tool for prying frames and scraping wax.', 'Tools & Equipment', 800, 850, 35, NULL),
(18, 'KTBH Catcher Box', 'Swarm catcher box designed for Kenya Top Bar Hives.', 'Hive Components', 2500, 3000, 6, NULL),
(19, 'Langstroth Catcher Box', 'Swarm catcher box for Langstroth hive systems.', 'Hive Components', 2500, 3000, 6, NULL),
(20, 'Bee Brush', 'Soft bristle brush for gently moving bees during inspections.', 'Tools & Equipment', 800, NULL, 40, NULL),
(21, 'Bee Smoker', 'Standard bee smoker for calming bees during hive inspections.', 'Tools & Equipment', 1800, 2000, 20, NULL),
(22, 'Bee Suit', 'Full protective suit with attached veil for complete protection.', 'Protective Equipment', 4500, 5000, 8, NULL),
(23, 'Honey', 'Pure natural honey from our apiaries. 1lb jar.', 'Specialty Items', 1000, NULL, 50, NULL),
(24, 'Box Hive', 'Traditional wooden box hive for natural beekeeping.', 'Hives & Equipment', 5000, 5500, 5, NULL),
(25, 'Langstroth Shallow Super', 'Shallow super box for honey production in Langstroth hives.', 'Hives & Equipment', 4500, 5000, 7, NULL),
(26, 'Kenya Top Bar Hive (KTBH)', 'Complete Kenya Top Bar Hive system for natural beekeeping.', 'Hives & Equipment', 4000, 4500, 4, 'kenyatopbarhive.jpeg'),
(27, 'Langstroth Deep Super', 'Deep super box for brood rearing in Langstroth hive systems.', 'Hives & Equipment', 5000, 5500, 6, 'langstrothhivedeepsuper.jpeg'),
(28, 'Metalic Stands', 'Durable metal stands for hive support and elevation.', 'Hives & Equipment', 2500, NULL, 10, 'metalicstand1.jpeg');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update stock after movement
CREATE OR REPLACE FUNCTION update_stock_after_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movement_type = 'IN' THEN
        UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.movement_type = 'OUT' THEN
        UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.movement_type = 'ADJUSTMENT' THEN
        UPDATE products SET stock_quantity = NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_trigger AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION update_stock_after_movement();