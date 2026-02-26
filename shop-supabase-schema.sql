-- Shop Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shop_categories table
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shop_products table
CREATE TABLE IF NOT EXISTS shop_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- in cents
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shop_orders table
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Reference to user ID from main database
  status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  total INTEGER NOT NULL, -- in cents
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'PT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shop_order_items table
CREATE TABLE IF NOT EXISTS shop_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id),
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL, -- price at time of purchase, in cents
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shop_payments table for EuPago integration
CREATE TABLE IF NOT EXISTS shop_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK(method IN ('multibanco', 'mbway', 'credit_card', 'bank_transfer')),
  amount INTEGER NOT NULL, -- in cents
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  eupago_payment_id TEXT, -- EuPago reference
  entity TEXT, -- Multibanco entity
  reference TEXT, -- Multibanco reference or MB WAY phone
  expires_at TIMESTAMPTZ, -- Payment expiration
  paid_at TIMESTAMPTZ, -- When payment was confirmed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_product ON shop_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_payments_order ON shop_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_payments_eupago ON shop_payments(eupago_payment_id);
CREATE INDEX IF NOT EXISTS idx_shop_payments_status ON shop_payments(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_shop_categories_updated_at BEFORE UPDATE ON shop_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_products_updated_at BEFORE UPDATE ON shop_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_orders_updated_at BEFORE UPDATE ON shop_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_payments_updated_at BEFORE UPDATE ON shop_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert test data
INSERT INTO shop_categories (name, description)
VALUES 
  ('Equipamentos', 'Equipamentos oficiais do FC Porto'),
  ('Acessórios', 'Acessórios e merchandising')
ON CONFLICT DO NOTHING;

INSERT INTO shop_products (category_id, name, description, price, stock, image_url)
VALUES 
  ((SELECT id FROM shop_categories WHERE name = 'Equipamentos' LIMIT 1), 'Camisola Principal 23/24', 'Camisola principal do FC Porto para a época 2023/24', 8990, 50, '/images/products/camisola.jpg'),
  ((SELECT id FROM shop_categories WHERE name = 'Equipamentos' LIMIT 1), 'Cachecol Clássico', 'Cachecol oficial do FC Porto', 1990, 100, '/images/products/cachecol.jpg'),
  ((SELECT id FROM shop_categories WHERE name = 'Acessórios' LIMIT 1), 'Pack Sócio Premium', 'Acesso exclusivo a conteúdos premium e descontos especiais', 2999, 100, '/images/products/pack.jpg')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Categories and Products: Public read access
CREATE POLICY "Categories are viewable by everyone" ON shop_categories
    FOR SELECT USING (true);

CREATE POLICY "Products are viewable by everyone" ON shop_products
    FOR SELECT USING (true);

-- Orders: Users can only see their own orders, service role can see all
CREATE POLICY "Users can view own orders" ON shop_orders
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can view all orders" ON shop_orders
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert orders" ON shop_orders
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Order Items: Read access through orders
CREATE POLICY "Order items viewable through orders" ON shop_order_items
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM shop_orders 
        WHERE shop_orders.id = shop_order_items.order_id 
        AND (auth.uid()::text = shop_orders.user_id OR auth.role() = 'service_role')
      )
    );

CREATE POLICY "Service role can insert order items" ON shop_order_items
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Payments: Similar to orders
CREATE POLICY "Users can view own payments" ON shop_payments
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM shop_orders 
        WHERE shop_orders.id = shop_payments.order_id 
        AND (auth.uid()::text = shop_orders.user_id OR auth.role() = 'service_role')
      )
    );

CREATE POLICY "Service role can manage payments" ON shop_payments
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
