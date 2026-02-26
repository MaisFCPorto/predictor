-- Add test category
INSERT INTO shop_categories (id, name, description)
VALUES ('cat_test1', 'Equipamentos', 'Equipamentos oficiais do FC Porto');

-- Add test products
INSERT INTO shop_products (id, category_id, name, description, price, stock, image_url)
VALUES 
  ('prod_test1', 'cat_test1', 'Camisola Principal 23/24', 'Camisola principal do FC Porto para a época 2023/24', 8990, 50, '/images/products/camisola.jpg'),
  ('prod_test2', 'cat_test1', 'Cachecol Clássico', 'Cachecol oficial do FC Porto', 1990, 100, '/images/products/cachecol.jpg');
