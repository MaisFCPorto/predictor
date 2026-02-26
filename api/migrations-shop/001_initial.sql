-- Create shop_categories table
CREATE TABLE IF NOT EXISTS shop_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_products table
CREATE TABLE IF NOT EXISTS shop_products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES shop_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- in cents
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_orders table
CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  total INTEGER NOT NULL, -- in cents
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'PT',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_order_items table
CREATE TABLE IF NOT EXISTS shop_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES shop_orders(id),
  product_id TEXT NOT NULL REFERENCES shop_products(id),
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL, -- price at time of purchase, in cents
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_payments table for EuPago integration
CREATE TABLE IF NOT EXISTS shop_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES shop_orders(id),
  method TEXT NOT NULL CHECK(method IN ('multibanco', 'mbway', 'credit_card', 'bank_transfer')),
  amount INTEGER NOT NULL, -- in cents
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  eupago_payment_id TEXT, -- EuPago reference
  entity TEXT, -- Multibanco entity
  reference TEXT, -- Multibanco reference or MB WAY phone
  expires_at DATETIME, -- Payment expiration
  paid_at DATETIME, -- When payment was confirmed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
