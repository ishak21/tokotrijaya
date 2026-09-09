-- Toko Tri Jaya: schema tambahan Kasir & Pelanggan
-- server.js menjalankan skema yang sama otomatis saat aplikasi start.

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  province TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cashier_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_name TEXT DEFAULT 'Shift Kasir',
  opening_balance REAL NOT NULL DEFAULT 0,
  closing_balance REAL,
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  status TEXT NOT NULL DEFAULT 'open',
  opened_by INTEGER,
  closed_by INTEGER,
  notes TEXT DEFAULT '',
  FOREIGN KEY (opened_by) REFERENCES admin(id),
  FOREIGN KEY (closed_by) REFERENCES admin(id)
);

CREATE TABLE IF NOT EXISTS cashier_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice TEXT UNIQUE NOT NULL,
  shift_id INTEGER,
  customer_id INTEGER,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  ppn_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  amount_paid REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid',
  cashier_id INTEGER,
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES cashier_shifts(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (cashier_id) REFERENCES admin(id)
);

CREATE TABLE IF NOT EXISTS cashier_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES cashier_sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_cashier_sales_created ON cashier_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_cashier_sales_shift ON cashier_sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sale_items_sale ON cashier_sale_items(sale_id);
