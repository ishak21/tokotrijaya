const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const Database = require('better-sqlite3');

// Load .env file
try { require('dotenv').config(); } catch(e) { /* dotenv optional */ }

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'tokotrijaya-change-this-in-production';

// Warn if using default secret
if (!process.env.SESSION_SECRET) {
  console.warn('\n⚠️  WARNING: SESSION_SECRET tidak diatur! Generate secret baru dengan: openssl rand -hex 32\n');
}

// Ensure directories
['data', 'uploads/products', 'uploads/maps', 'uploads/logo'].forEach(d => {
  fs.mkdirSync(d, { recursive: true });
});

// Database
const db = new Database('data/tokotrijaya.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT DEFAULT 'Admin',
    force_password_change INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    category TEXT DEFAULT '',
    image TEXT DEFAULT '',
    weight REAL DEFAULT 0,
    sku TEXT,
    low_stock_threshold INTEGER DEFAULT 5,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT DEFAULT '',
    customer_address TEXT NOT NULL,
    customer_city TEXT DEFAULT '',
    customer_province TEXT DEFAULT '',
    customer_postal TEXT DEFAULT '',
    payment_method TEXT DEFAULT '',
    payment_detail TEXT DEFAULT '',
    payment_status TEXT DEFAULT 'pending',
    customer_id INTEGER,
    shipping_method TEXT DEFAULT '',
    shipping_cost REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    ppn_amount REAL DEFAULT 0,
    ppn_rate REAL DEFAULT 0.11,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    product_image TEXT DEFAULT '',
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS couriers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT DEFAULT '',
    base_cost REAL DEFAULT 0,
    cost_per_kg REAL DEFAULT 0,
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ewallet_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,
    supplier_name TEXT NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    status TEXT DEFAULT 'draft',
    total_amount REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
  );
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
    cost_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES cashier_sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );
`);

// ===== MIGRASI: tambah kolom baru untuk database lama tanpa hapus data =====
const productCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
if (!productCols.includes('cost_price')) {
  db.exec('ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0');
}
if (!productCols.includes('sku')) {
  db.exec('ALTER TABLE products ADD COLUMN sku TEXT');
}
if (!productCols.includes('low_stock_threshold')) {
  db.exec('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5');
}
const orderItemCols = db.prepare("PRAGMA table_info(order_items)").all().map(c => c.name);
if (!orderItemCols.includes('cost_price')) db.exec('ALTER TABLE order_items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0');
const cashierItemCols = db.prepare("PRAGMA table_info(cashier_sale_items)").all().map(c => c.name);
if (!cashierItemCols.includes('cost_price')) db.exec('ALTER TABLE cashier_sale_items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0');
const poItemCols = db.prepare("PRAGMA table_info(purchase_order_items)").all().map(c => c.name);
if (!poItemCols.includes('product_id')) {
  db.exec('ALTER TABLE purchase_order_items ADD COLUMN product_id INTEGER');
}
const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
if (!orderCols.includes('payment_status')) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'");
}
if (!orderCols.includes('customer_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER');
}

// ===== INDEXES: wajib untuk performa saat produk sudah ribuan =====
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
  CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
`);

// Default admin - only create if no admin exists
if (db.prepare('SELECT COUNT(*) as c FROM admin').get().c === 0) {
  const randomPass = require('crypto').randomBytes(8).toString('hex');
  db.prepare('INSERT INTO admin (username,password,name,force_password_change) VALUES (?,?,?,?)')
    .run('admin', bcrypt.hashSync(randomPass, 10), 'Administrator', 1);
  console.log(`\n🔑 Admin account created:`);
  console.log(`   Username: admin`);
  console.log(`   Password: ${randomPass}`);
  console.log(`   ⚠️  SIMPAN PASSWORD INI! Admin akan diminta ganti password saat login pertama.\n`);
}

// Default settings
const defaults = {
  site_name: 'Toko Tri Jaya',
  site_tagline: 'Belanja Mudah, Aman & Terpercaya',
  site_description: 'Toko Tri Jaya - Toko online terpercaya di Indonesia. Belanja mudah, aman, dan terjangkau dengan berbagai produk berkualitas.',
  site_keywords: 'toko online, belanja online, terpercaya, indonesia, produk berkualitas, harga terjangkau',
  phone: '0812-3456-7890',
  whatsapp: '6281234567890',
  email: 'info@tokotrijaya.com',
  address: 'Jl. Raya Utama No. 123, Kel. Sukamaju, Kec. Cilandak, Jakarta Selatan, DKI Jakarta 12340',
  province: 'DKI Jakarta',
  city: 'Jakarta Selatan',
  postal_code: '12340',
  lat: '-6.2888',
  lng: '106.8056',
  google_maps_embed: '',
  map_image: '',
  logo: '',
  bank_bca: '1234567890 a.n PT Toko Tri Jaya',
  bank_mandiri: '0987654321 a.n PT Toko Tri Jaya',
  bank_bri: '1122334455 a.n PT Toko Tri Jaya',
  bank_bni: '5566778899 a.n PT Toko Tri Jaya',
  bank_btn: '',
  ewallet_dana: '0812-3456-7890',
  ewallet_ovo: '0812-3456-7890',
  ewallet_gopay: '0812-3456-7890',
  ewallet_shopeepay: '0812-3456-7890',
  ppn_enabled: 'true',
  ppn_rate: '11',
  npwp: '00.000.000.0-000.000',
  company_name: 'PT Toko Tri Jaya',
  nib: '',
  footer_text: '© 2025 Toko Tri Jaya. All Rights Reserved.',
  ship_jne: 'true',
  ship_tiki: 'true',
  ship_pos: 'true',
  ship_grab: 'true',
  ship_gosend: 'true',
  ship_flat_rate: '15000'
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
for (const [k, v] of Object.entries(defaults)) insSetting.run(k, v);

// Seed bank_accounts & ewallet_accounts dari settings lama (sekali saja, jika tabel masih kosong)
if (db.prepare('SELECT COUNT(*) as c FROM bank_accounts').get().c === 0) {
  const bankSeed = [
    ['BCA', defaults.bank_bca], ['Mandiri', defaults.bank_mandiri], ['BRI', defaults.bank_bri],
    ['BNI', defaults.bank_bni], ['BTN', defaults.bank_btn]
  ].filter(b => b[1]);
  const insBank = db.prepare('INSERT INTO bank_accounts (bank_name,account_number,account_name,sort_order) VALUES (?,?,?,?)');
  bankSeed.forEach(([name, val], i) => {
    const [num, ...an] = String(val).split(' ');
    insBank.run(name, num.trim(), an.join(' ').replace(/^a\.n\s*/i, '').trim(), i);
  });
}
if (db.prepare('SELECT COUNT(*) as c FROM ewallet_accounts').get().c === 0) {
  const ewSeed = [
    ['DANA', defaults.ewallet_dana], ['OVO', defaults.ewallet_ovo],
    ['GoPay', defaults.ewallet_gopay], ['ShopeePay', defaults.ewallet_shopeepay]
  ].filter(e => e[1]);
  const insEw = db.prepare('INSERT INTO ewallet_accounts (wallet_name,account_number,account_name,sort_order) VALUES (?,?,?,?)');
  ewSeed.forEach(([name, val], i) => insEw.run(name, String(val).trim(), '', i));
}

// ===== RATE LIMITING (Simple in-memory) =====
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 menit

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.start > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { start: now, count: 1 });
    return true;
  }
  record.count++;
  return record.count <= MAX_LOGIN_ATTEMPTS;
}

// Cleanup old rate limit records every 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.start > LOGIN_WINDOW_MS * 2) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000);

// ===== UPLOAD (With path traversal protection) =====
const ALLOWED_UPLOAD_TYPES = ['products', 'maps', 'logo'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = ALLOWED_UPLOAD_TYPES.includes(req.query.type) ? req.query.type : 'products';
    const dir = `uploads/${type}`;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2,8) + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Support all image types
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'));
  }
});

// Upload khusus untuk import CSV produk massal (bukan gambar)
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/tmp-csv';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.csv')
});
const uploadCsv = multer({
  storage: csvStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB cukup untuk puluhan ribu baris produk
  fileFilter: (req, file, cb) => {
    const okType = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'application/octet-stream' || file.originalname.toLowerCase().endsWith('.csv');
    if (okType) cb(null, true);
    else cb(new Error('Hanya file CSV yang diizinkan'));
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000,
    httpOnly: true,              // Tidak bisa diakses via JavaScript
    secure: false,               // Set true jika sudah pakai HTTPS
    sameSite: 'lax'              // Proteksi CSRF
  }
}));

function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return s;
}

// ===== AUTH =====
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 1 menit.' });
  }

  const admin = db.prepare('SELECT * FROM admin WHERE username=?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password))
    return res.status(401).json({ error: 'Username atau password salah' });

  req.session.admin = { id: admin.id, username: admin.username, name: admin.name };

  // Check if password change is required
  const forceChange = admin.force_password_change === 1;

  res.json({ success: true, admin: { id: admin.id, name: admin.name }, force_password_change: forceChange });
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/auth/check', (req, res) => {
  res.json(req.session?.admin ? { authenticated: true, admin: req.session.admin } : { authenticated: false });
});

app.put('/api/auth/password', requireAdmin, (req, res) => {
  const { old_password, new_password } = req.body;

  // Validate new password
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });

  const admin = db.prepare('SELECT * FROM admin WHERE id=?').get(req.session.admin.id);
  if (!bcrypt.compareSync(old_password, admin.password))
    return res.status(400).json({ error: 'Password lama salah' });

  db.prepare('UPDATE admin SET password=?, force_password_change=0 WHERE id=?')
    .run(bcrypt.hashSync(new_password, 10), admin.id);
  res.json({ success: true });
});

// ===== PRODUCTS (Public) =====
app.get('/api/products', (req, res) => {
  const { category, search, page = 1, limit = 24 } = req.query;
  let q = 'SELECT * FROM products WHERE is_active=1';
  const p = [];
  if (category) { q += ' AND category=?'; p.push(category); }
  if (search) { q += ' AND (name LIKE ? OR description LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  const count = db.prepare(q.replace('SELECT *', 'SELECT COUNT(*) as c')).get(...p).c;
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  p.push(Number(limit), (Number(page)-1)*Number(limit));
  res.json({ products: db.prepare(q).all(...p), total: count, page: +page, pages: Math.ceil(count/limit) });
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(p);
});

app.get('/api/categories', (req, res) => {
  res.json(db.prepare("SELECT DISTINCT category FROM products WHERE is_active=1 AND category != ''").all().map(c=>c.category));
});

// ===== PRODUCTS (Admin) =====
app.get('/api/admin/products', requireAdmin, (req, res) => {
  const { search = '', category = '', status = '', page = 1, limit = 20, sort = 'created_desc' } = req.query;
  const lim = Math.min(Math.max(+limit || 20, 1), 200); // cap max 200/page biar aman
  const pg = Math.max(+page || 1, 1);

  let where = 'WHERE 1=1';
  const p = [];
  if (search) { where += ' AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)'; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category) { where += ' AND category=?'; p.push(category); }
  if (status === 'active') where += ' AND is_active=1';
  else if (status === 'inactive') where += ' AND is_active=0';
  else if (status === 'low') where += ' AND stock<=low_stock_threshold AND stock>0';
  else if (status === 'out') where += ' AND stock<=0';

  const sortMap = {
    created_desc: 'created_at DESC',
    created_asc: 'created_at ASC',
    name_asc: 'name COLLATE NOCASE ASC',
    name_desc: 'name COLLATE NOCASE DESC',
    stock_asc: 'stock ASC',
    stock_desc: 'stock DESC',
    price_asc: 'price ASC',
    price_desc: 'price DESC'
  };
  const orderBy = sortMap[sort] || sortMap.created_desc;

  const total = db.prepare(`SELECT COUNT(*) as c FROM products ${where}`).get(...p).c;
  const rows = db.prepare(`SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...p, lim, (pg-1)*lim);
  const lowStockCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock<=low_stock_threshold AND stock>0').get().c;

  res.json({ products: rows, total, page: pg, limit: lim, pages: Math.max(Math.ceil(total/lim),1), low_stock_count: lowStockCount });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, description, price, cost_price, stock, category, weight, image, sku, low_stock_threshold } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama produk wajib diisi' });
  try {
    const r = db.prepare('INSERT INTO products (name,description,price,cost_price,stock,category,weight,image,sku,low_stock_threshold) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(name, description||'', +price||0, +cost_price||0, +stock||0, category||'', +weight||0, image||'', sku||null, +low_stock_threshold||5);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(400).json({ error: 'SKU sudah dipakai produk lain' });
    res.status(500).json({ error: 'Gagal menyimpan produk' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { name, description, price, cost_price, stock, category, weight, image, is_active, sku, low_stock_threshold } = req.body;
  try {
    db.prepare('UPDATE products SET name=?,description=?,price=?,cost_price=?,stock=?,category=?,weight=?,image=?,is_active=?,sku=?,low_stock_threshold=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(name, description||'', +price||0, +cost_price||0, +stock||0, category||'', +weight||0, image||'', is_active!==undefined?(is_active?1:0):1, sku||null, +low_stock_threshold||5, +req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(400).json({ error: 'SKU sudah dipakai produk lain' });
    res.status(500).json({ error: 'Gagal menyimpan produk' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(+req.params.id);
  res.json({ success: true });
});

// Bulk delete (untuk kelola ribuan produk sekaligus)
app.post('/api/admin/products/bulk-delete', requireAdmin, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Tidak ada produk dipilih' });
  const del = db.prepare('DELETE FROM products WHERE id=?');
  const tx = db.transaction((list) => { list.forEach(id => del.run(+id)); });
  tx(ids);
  res.json({ success: true, deleted: ids.length });
});

// Import CSV massal (dirancang untuk ribuan baris sekaligus)
app.post('/api/admin/products/import', requireAdmin, uploadCsv.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File CSV tidak ditemukan' });
  try {
    const fs = require('fs');
    const raw = fs.readFileSync(req.file.path, 'utf-8');
    fs.unlinkSync(req.file.path); // hapus file temp upload, kita tidak simpan CSV-nya
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV kosong atau tidak ada data' });

    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g,''));
    const required = ['name','price'];
    for (const req of required) if (!header.includes(req)) return res.status(400).json({ error: `Kolom '${req}' wajib ada di CSV` });

    const idx = (col) => header.indexOf(col);
    const parseLine = (line) => {
      // parser CSV sederhana yang tetap tangani koma di dalam tanda kutip
      const out = []; let cur = ''; let inQ = false;
      for (let i=0;i<line.length;i++){
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === ',' && !inQ) { out.push(cur); cur=''; continue; }
        cur += c;
      }
      out.push(cur);
      return out;
    };

    const insert = db.prepare('INSERT INTO products (name,description,price,cost_price,stock,category,weight,image,sku,low_stock_threshold) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let inserted = 0, skipped = 0;
    const errors = [];

    const runImport = db.transaction((rows) => {
      rows.forEach((cols, i) => {
        const name = (cols[idx('name')]||'').trim();
        const price = parseFloat(cols[idx('price')]) || 0;
        if (!name || price <= 0) { skipped++; errors.push(`Baris ${i+2}: nama/harga tidak valid`); return; }
        insert.run(
          name,
          idx('description')>-1 ? (cols[idx('description')]||'').trim() : '',
          price,
          idx('cost_price')>-1 ? (parseFloat(cols[idx('cost_price')])||0) : 0,
          idx('stock')>-1 ? (parseInt(cols[idx('stock')])||0) : 0,
          idx('category')>-1 ? (cols[idx('category')]||'').trim() : '',
          idx('weight')>-1 ? (parseFloat(cols[idx('weight')])||0) : 0,
          idx('image')>-1 ? (cols[idx('image')]||'').trim() : '',
          idx('sku')>-1 ? ((cols[idx('sku')]||'').trim() || null) : null,
          idx('low_stock_threshold')>-1 ? (parseInt(cols[idx('low_stock_threshold')])||5) : 5
        );
        inserted++;
      });
    });

    runImport(lines.slice(1).map(parseLine));

    res.json({ success: true, inserted, skipped, errors: errors.slice(0, 20), total_errors: errors.length });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memproses CSV: ' + err.message });
  }
});

// Export semua produk sebagai CSV (untuk backup / edit massal offline)
app.get('/api/admin/products/export', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT name,description,price,stock,category,weight,sku,low_stock_threshold FROM products ORDER BY created_at DESC').all();
  const esc = (v) => `"${String(v??'').replace(/"/g,'""')}"`;
  const header = 'name,description,price,stock,category,weight,sku,low_stock_threshold';
  const csv = [header, ...rows.map(r => [r.name,r.description,r.price,r.stock,r.category,r.weight,r.sku,r.low_stock_threshold].map(esc).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="produk-export.csv"');
  res.send('\uFEFF' + csv); // BOM biar Excel baca UTF-8 dengan benar
});

// ===== UPLOAD =====
app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tidak ada file' });
  const type = ALLOWED_UPLOAD_TYPES.includes(req.query.type) ? req.query.type : 'products';
  res.json({ success: true, url: `/uploads/${type}/${req.file.filename}` });
});

// ===== ORDERS (Public) =====
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, customer_email, customer_address, customer_city, customer_province, customer_postal, payment_method, payment_detail, shipping_method, shipping_cost, items, notes } = req.body;

  // Basic validation
  if (!customer_name || !customer_phone || !customer_address)
    return res.status(400).json({ error: 'Nama, telepon, dan alamat wajib diisi' });
  if (!items?.length) return res.status(400).json({ error: 'Keranjang kosong' });

  try {
    let subtotal = 0;
    const processed = items.map(i => {
      const prod = db.prepare('SELECT * FROM products WHERE id=? AND is_active=1').get(i.product_id);
      if (!prod) throw new Error('Produk tidak ditemukan');
      if (!Number.isInteger(i.quantity) || i.quantity < 1) throw new Error('Jumlah produk tidak valid');
      if (prod.stock < i.quantity) throw new Error(`Stok ${prod.name} tidak mencukupi (tersisa ${prod.stock})`);
      const sub = prod.price * i.quantity;
      subtotal += sub;
      return { product_id: prod.id, product_name: prod.name, product_image: prod.image, price: prod.price, cost_price: Number(prod.cost_price)||0, quantity: i.quantity, subtotal: sub };
    });

    const s = getSettings();
    const ppnRate = s.ppn_enabled === 'true' ? +s.ppn_rate/100 : 0;
    const ppnAmt = subtotal * ppnRate;
    const total = subtotal + ppnAmt + (+shipping_cost||0);
    const inv = 'INV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();

    // Metode yang statusnya baru "lunas" setelah dikonfirmasi admin secara manual
    const payment_status = 'pending';

    const insItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,product_image,price,quantity,subtotal,cost_price) VALUES (?,?,?,?,?,?,?,?)');
    const updStock = db.prepare('UPDATE products SET stock=MAX(0,stock-?) WHERE id=?');

    const createOrder = db.transaction(() => {
      // Cari pelanggan berdasarkan no. telepon; kalau belum ada, buat baru otomatis
      let customer = db.prepare('SELECT * FROM customers WHERE phone=?').get(customer_phone);
      let customerId;
      if (customer) {
        customerId = customer.id;
        db.prepare('UPDATE customers SET name=?,email=COALESCE(NULLIF(?,\'\'),email),address=?,city=?,province=?,postal_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .run(customer_name, customer_email||'', customer_address, customer_city||'', customer_province||'', customer_postal||'', customerId);
      } else {
        const code = 'CUST' + Date.now().toString(36).toUpperCase();
        const r2 = db.prepare('INSERT INTO customers (customer_code,name,phone,email,address,city,province,postal_code) VALUES (?,?,?,?,?,?,?,?)')
          .run(code, customer_name, customer_phone, customer_email||'', customer_address, customer_city||'', customer_province||'', customer_postal||'');
        customerId = r2.lastInsertRowid;
      }

      const r = db.prepare('INSERT INTO orders (invoice,customer_name,customer_phone,customer_email,customer_address,customer_city,customer_province,customer_postal,payment_method,payment_detail,payment_status,customer_id,shipping_method,shipping_cost,subtotal,ppn_amount,ppn_rate,total,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(inv, customer_name, customer_phone, customer_email||'', customer_address, customer_city||'', customer_province||'', customer_postal||'', payment_method||'', payment_detail||'', payment_status, customerId, shipping_method||'', +shipping_cost||0, subtotal, ppnAmt, ppnRate, total, notes||'');
      const orderId = r.lastInsertRowid;
      processed.forEach(i => {
        insItem.run(orderId, i.product_id, i.product_name, i.product_image, i.price, i.quantity, i.subtotal, i.cost_price);
        updStock.run(i.quantity, i.product_id);
      });
      return orderId;
    });

    const orderId = createOrder();
    res.json({ success: true, invoice: inv, total, order_id: orderId });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Gagal memproses pesanan' });
  }
});

app.get('/api/orders/track/:invoice', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE invoice=?').get(req.params.invoice);
  if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  res.json({ ...o, items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id) });
});

// ===== ORDERS (Admin) =====
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status, payment_status, payment_method, from, to, page=1, limit=20 } = req.query;
  let q = 'SELECT * FROM orders WHERE 1=1', p = [];
  if (status && status!=='all') { q += ' AND status=?'; p.push(status); }
  if (payment_status && payment_status!=='all') { q += ' AND payment_status=?'; p.push(payment_status); }
  if (payment_method && payment_method!=='all') { q += ' AND payment_method=?'; p.push(payment_method); }
  if (from) { q += ' AND created_at>=?'; p.push(from); }
  if (to) { q += ' AND created_at<=?'; p.push(to+' 23:59:59'); }
  const count = db.prepare(q.replace('SELECT *','SELECT COUNT(*) as c')).get(...p).c;
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  p.push(+limit, (+page-1)*+limit);
  res.json({ orders: db.prepare(q).all(...p), total: count, page: +page, pages: Math.ceil(count/+limit) });
});

app.put('/api/admin/orders/:id/payment-status', requireAdmin, (req, res) => {
  const { payment_status } = req.body;
  if (!['pending','lunas'].includes(payment_status)) return res.status(400).json({ error: 'Status pembayaran tidak valid' });
  const o = db.prepare('SELECT id FROM orders WHERE id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  db.prepare('UPDATE orders SET payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(payment_status, o.id);
  res.json({ success: true });
});

// Hapus satu transaksi/pesanan dari riwayat
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const o = db.prepare('SELECT id FROM orders WHERE id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  db.transaction(() => {
    db.prepare('DELETE FROM order_items WHERE order_id=?').run(o.id);
    db.prepare('DELETE FROM orders WHERE id=?').run(o.id);
  })();
  res.json({ success: true });
});

// Hapus riwayat massal berdasarkan rentang tanggal (biasa dipakai setelah export laporan bulanan)
app.post('/api/admin/orders/bulk-delete', requireAdmin, (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'Rentang tanggal wajib diisi' });
  const ids = db.prepare('SELECT id FROM orders WHERE created_at>=? AND created_at<=?').all(from, to+' 23:59:59').map(r => r.id);
  if (!ids.length) return res.json({ success: true, deleted: 0 });
  const delItems = db.prepare('DELETE FROM order_items WHERE order_id=?');
  const delOrder = db.prepare('DELETE FROM orders WHERE id=?');
  db.transaction((list) => { list.forEach(id => { delItems.run(id); delOrder.run(id); }); })(ids);
  res.json({ success: true, deleted: ids.length });
});

// ===== PIUTANG (Piutang / Belum Lunas) =====
app.get('/api/admin/piutang', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, invoice, customer_name, customer_phone, payment_method, total, status, created_at
    FROM orders WHERE payment_status='pending' AND status!='cancelled' ORDER BY created_at ASC
  `).all();
  const totalPiutang = rows.reduce((s, r) => s + r.total, 0);
  res.json({ orders: rows, total_piutang: totalPiutang, count: rows.length });
});

app.get('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  res.json({ ...o, items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id) });
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Status tidak valid' });

  db.prepare('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, +req.params.id);
  if (status === 'cancelled') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(+req.params.id);
    items.forEach(i => db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.quantity, i.product_id));
  }
  res.json({ success: true });
});

// ===== BANK ACCOUNTS =====
app.get('/api/bank-accounts', (req, res) => {
  res.json(db.prepare('SELECT * FROM bank_accounts WHERE is_active=1 ORDER BY sort_order, id').all());
});

app.get('/api/admin/bank-accounts', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM bank_accounts ORDER BY sort_order, id').all());
});

app.post('/api/admin/bank-accounts', requireAdmin, (req, res) => {
  const { bank_name, account_number, account_name, is_active } = req.body;
  if (!bank_name || !account_number)
    return res.status(400).json({ error: 'Nama bank dan nomor rekening wajib diisi' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 as m FROM bank_accounts').get().m;
  const r = db.prepare('INSERT INTO bank_accounts (bank_name,account_number,account_name,is_active,sort_order) VALUES (?,?,?,?,?)')
    .run(bank_name.trim(), account_number.trim(), account_name||'', is_active!==undefined?(is_active?1:0):1, max);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/bank-accounts/:id', requireAdmin, (req, res) => {
  const { bank_name, account_number, account_name, is_active } = req.body;
  if (!bank_name || !account_number)
    return res.status(400).json({ error: 'Nama bank dan nomor rekening wajib diisi' });
  db.prepare('UPDATE bank_accounts SET bank_name=?,account_number=?,account_name=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(bank_name.trim(), account_number.trim(), account_name||'', is_active!==undefined?(is_active?1:0):1, +req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/bank-accounts/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM bank_accounts WHERE id=?').run(+req.params.id);
  res.json({ success: true });
});

// ===== EWALLET ACCOUNTS =====
app.get('/api/ewallet-accounts', (req, res) => {
  res.json(db.prepare('SELECT * FROM ewallet_accounts WHERE is_active=1 ORDER BY sort_order, id').all());
});

app.get('/api/admin/ewallet-accounts', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM ewallet_accounts ORDER BY sort_order, id').all());
});

app.post('/api/admin/ewallet-accounts', requireAdmin, (req, res) => {
  const { wallet_name, account_number, account_name, is_active } = req.body;
  if (!wallet_name || !account_number)
    return res.status(400).json({ error: 'Nama e-wallet dan nomor wajib diisi' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 as m FROM ewallet_accounts').get().m;
  const r = db.prepare('INSERT INTO ewallet_accounts (wallet_name,account_number,account_name,is_active,sort_order) VALUES (?,?,?,?,?)')
    .run(wallet_name.trim(), account_number.trim(), account_name||'', is_active!==undefined?(is_active?1:0):1, max);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/ewallet-accounts/:id', requireAdmin, (req, res) => {
  const { wallet_name, account_number, account_name, is_active } = req.body;
  if (!wallet_name || !account_number)
    return res.status(400).json({ error: 'Nama e-wallet dan nomor wajib diisi' });
  db.prepare('UPDATE ewallet_accounts SET wallet_name=?,account_number=?,account_name=?,is_active=? WHERE id=?')
    .run(wallet_name.trim(), account_number.trim(), account_name||'', is_active!==undefined?(is_active?1:0):1, +req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/ewallet-accounts/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM ewallet_accounts WHERE id=?').run(+req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const upd = db.prepare('INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)');
  const tx = db.transaction(s => { for (const [k,v] of Object.entries(s)) upd.run(k, String(v)); });
  tx(req.body);
  res.json({ success: true });
});

// ===== COURIERS =====
app.get('/api/couriers', (req, res) => {
  res.json(db.prepare('SELECT * FROM couriers WHERE is_active=1 ORDER BY name').all());
});

app.get('/api/admin/couriers', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM couriers ORDER BY name').all());
});

app.post('/api/admin/couriers', requireAdmin, (req, res) => {
  const { name, code, base_cost, cost_per_kg, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kurir wajib diisi' });
  const r = db.prepare('INSERT INTO couriers (name,code,base_cost,cost_per_kg,description) VALUES (?,?,?,?,?)')
    .run(name, code||'', +base_cost||0, +cost_per_kg||0, description||'');
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/couriers/:id', requireAdmin, (req, res) => {
  const { name, code, base_cost, cost_per_kg, description, is_active } = req.body;
  db.prepare('UPDATE couriers SET name=?,code=?,base_cost=?,cost_per_kg=?,description=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, code||'', +base_cost||0, +cost_per_kg||0, description||'', is_active!==undefined?(is_active?1:0):1, +req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/couriers/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM couriers WHERE id=?').run(+req.params.id);
  res.json({ success: true });
});

// ===== PELANGGAN =====
app.get('/api/admin/customers', requireAdmin, (req, res) => {
  const { search = '', active = 'all' } = req.query;
  let q = 'SELECT * FROM customers WHERE 1=1';
  const p = [];
  if (search) { q += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR customer_code LIKE ?)'; const x = `%${search}%`; p.push(x, x, x, x); }
  if (active !== 'all') { q += ' AND is_active=?'; p.push(active === 'true' ? 1 : 0); }
  q += ' ORDER BY name COLLATE NOCASE ASC';
  res.json(db.prepare(q).all(...p));
});

app.post('/api/admin/customers', requireAdmin, (req, res) => {
  const { name, phone, email, address, city, province, postal_code, notes, is_active } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama pelanggan wajib diisi' });
  const code = 'PLG-' + Date.now().toString(36).toUpperCase();
  const r = db.prepare('INSERT INTO customers (customer_code,name,phone,email,address,city,province,postal_code,notes,is_active) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(code, String(name).trim(), phone||'', email||'', address||'', city||'', province||'', postal_code||'', notes||'', is_active !== undefined ? (is_active ? 1 : 0) : 1);
  res.json({ success: true, id: r.lastInsertRowid, customer_code: code });
});

app.put('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const { name, phone, email, address, city, province, postal_code, notes, is_active } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama pelanggan wajib diisi' });
  const r = db.prepare('UPDATE customers SET name=?,phone=?,email=?,address=?,city=?,province=?,postal_code=?,notes=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(String(name).trim(), phone||'', email||'', address||'', city||'', province||'', postal_code||'', notes||'', is_active !== undefined ? (is_active ? 1 : 0) : 1, +req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
  res.json({ success: true });
});

app.delete('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const r = db.prepare('UPDATE customers SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(+req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
  res.json({ success: true });
});

// ===== KASIR =====
app.get('/api/admin/cashier/products', requireAdmin, (req, res) => {
  const search = String(req.query.search || '');
  const q = search ? 'SELECT id,name,price,stock,category,image FROM products WHERE is_active=1 AND (name LIKE ? OR category LIKE ?) ORDER BY name LIMIT 50' : 'SELECT id,name,price,stock,category,image FROM products WHERE is_active=1 ORDER BY name LIMIT 100';
  const p = search ? [`%${search}%`, `%${search}%`] : [];
  res.json(db.prepare(q).all(...p));
});

app.get('/api/admin/cashier/shifts/active', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM cashier_shifts WHERE status='open' ORDER BY id DESC LIMIT 1").get() || null);
});

app.post('/api/admin/cashier/shifts/open', requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT id FROM cashier_shifts WHERE status='open' LIMIT 1").get();
  if (existing) return res.status(400).json({ error: 'Masih ada shift kasir yang terbuka' });
  const opening = Number(req.body.opening_balance) || 0;
  const r = db.prepare('INSERT INTO cashier_shifts (shift_name,opening_balance,opened_by,notes) VALUES (?,?,?,?)').run(req.body.shift_name || 'Shift Kasir', opening, req.session.admin.id, req.body.notes || '');
  res.json({ success: true, id: r.lastInsertRowid });
});

app.post('/api/admin/cashier/shifts/:id/close', requireAdmin, (req, res) => {
  const shift = db.prepare("SELECT * FROM cashier_shifts WHERE id=? AND status='open'").get(+req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift aktif tidak ditemukan' });
  const closing = Number(req.body.closing_balance);
  if (!Number.isFinite(closing) || closing < 0) return res.status(400).json({ error: 'Saldo penutupan tidak valid' });
  db.prepare("UPDATE cashier_shifts SET closing_balance=?,closed_at=CURRENT_TIMESTAMP,status='closed',closed_by=?,notes=CASE WHEN ?='' THEN notes ELSE ? END WHERE id=?")
    .run(closing, req.session.admin.id, req.body.notes || '', req.body.notes || '', shift.id);
  res.json({ success: true });
});

app.get('/api/admin/cashier/sales', requireAdmin, (req, res) => {
  const { from, to, limit } = req.query;
  let where = 'WHERE 1=1'; const p = [];
  if (from) { where += ' AND date(s.created_at)>=?'; p.push(from); }
  if (to) { where += ' AND date(s.created_at)<=?'; p.push(to); }
  const rows = db.prepare(`SELECT s.*, c.name AS customer_name FROM cashier_sales s LEFT JOIN customers c ON c.id=s.customer_id ${where} ORDER BY s.id DESC LIMIT ?`).all(...p, Math.min(Number(limit) || 100, 500));
  res.json(rows);
});

app.get('/api/admin/cashier/sales/:id', requireAdmin, (req, res) => {
  const sale = db.prepare(`SELECT s.*, c.name AS customer_name FROM cashier_sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?`).get(+req.params.id);
  if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  const items = db.prepare('SELECT * FROM cashier_sale_items WHERE sale_id=?').all(sale.id);
  res.json({ ...sale, items });
});

app.post('/api/admin/cashier/sales', requireAdmin, (req, res) => {
  const { customer_id, payment_method = 'cash', amount_paid, discount = 0, items, notes = '' } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Item kasir wajib diisi' });
  let shift = db.prepare("SELECT * FROM cashier_shifts WHERE status='open' ORDER BY id DESC LIMIT 1").get();
  if (!shift) {
    // Auto-buka shift di background — pengguna tidak perlu mengelola shift secara manual
    const r = db.prepare("INSERT INTO cashier_shifts (shift_name,opening_balance,opened_by) VALUES ('Shift Harian',0,?)").run(req.session.admin.id);
    shift = db.prepare('SELECT * FROM cashier_shifts WHERE id=?').get(r.lastInsertRowid);
  }
  if (customer_id && !db.prepare('SELECT id FROM customers WHERE id=? AND is_active=1').get(+customer_id)) return res.status(400).json({ error: 'Pelanggan tidak valid' });
  const clean = [];
  let subtotal = 0;
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id=? AND is_active=1').get(+item.product_id);
    const qty = Number(item.quantity);
    if (!product) return res.status(400).json({ error: 'Produk tidak ditemukan' });
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'Jumlah produk tidak valid' });
    if (product.stock < qty) return res.status(400).json({ error: `Stok ${product.name} tidak mencukupi` });
    const line = product.price * qty; subtotal += line;
    clean.push({ product, qty, line, cost_price: Number(product.cost_price)||0 });
  }
  const disc = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const taxable = subtotal - disc;
  const settings = getSettings();
  const ppnRate = settings.ppn_enabled === 'true' ? (+settings.ppn_rate || 0) / 100 : 0;
  const ppn = taxable * ppnRate;
  const total = taxable + ppn;
  const paid = Number(amount_paid);
  if (!Number.isFinite(paid) || paid < total) return res.status(400).json({ error: 'Jumlah pembayaran kurang' });
  const invoice = 'POS' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const tx = db.transaction(() => {
    const sale = db.prepare('INSERT INTO cashier_sales (invoice,shift_id,customer_id,subtotal,discount,ppn_amount,total,payment_method,amount_paid,change_amount,cashier_id,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(invoice, shift.id, customer_id ? +customer_id : null, subtotal, disc, ppn, total, payment_method, paid, paid-total, req.session.admin.id, notes);
    const itemStmt = db.prepare('INSERT INTO cashier_sale_items (sale_id,product_id,product_name,price,quantity,subtotal,cost_price) VALUES (?,?,?,?,?,?,?)');
    const stockStmt = db.prepare('UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=?');
    for (const x of clean) { itemStmt.run(sale.lastInsertRowid, x.product.id, x.product.name, x.product.price, x.qty, x.line, x.cost_price); stockStmt.run(x.qty, x.product.id); }
    return sale.lastInsertRowid;
  });
  res.json({ success: true, id: tx(), invoice, subtotal, discount: disc, ppn_amount: ppn, total, change_amount: paid-total });
});

// ===== REPORTS =====
// Tren penjualan harian (gabungan order online + kasir) untuk grafik dashboard
app.get('/api/admin/dashboard/trend', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(+req.query.days || 14, 7), 90);
  const rows = db.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', '-${days-1} days')
      UNION ALL SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
    )
    SELECT dates.d as date,
      COALESCE((SELECT SUM(total) FROM orders WHERE date(created_at)=dates.d AND status!='cancelled'),0)
      + COALESCE((SELECT SUM(total) FROM cashier_sales WHERE date(created_at)=dates.d AND status!='void'),0) as revenue
    FROM dates ORDER BY dates.d ASC
  `).all();
  res.json(rows);
});

// Produk terlaris (gabungan order online + kasir)
app.get('/api/admin/dashboard/top-products', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(+req.query.days || 30, 1), 365);
  const limit = Math.min(Math.max(+req.query.limit || 5, 1), 20);
  const rows = db.prepare(`
    SELECT product_name as name, SUM(qty) as qty, SUM(rev) as revenue FROM (
      SELECT oi.product_name, oi.quantity as qty, oi.subtotal as rev FROM order_items oi
        JOIN orders o ON oi.order_id=o.id WHERE o.status!='cancelled' AND o.created_at>=date('now','-${days} days')
      UNION ALL
      SELECT csi.product_name, csi.quantity as qty, csi.subtotal as rev FROM cashier_sale_items csi
        JOIN cashier_sales cs ON csi.sale_id=cs.id WHERE cs.status!='void' AND cs.created_at>=date('now','-${days} days')
    ) combined GROUP BY product_name ORDER BY qty DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

app.get('/api/admin/reports/summary', requireAdmin, (req, res) => {
  const today = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as t FROM orders WHERE date(created_at)=date('now')`).get();
  const month = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as t FROM orders WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')`).get();
  const year = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as t FROM orders WHERE strftime('%Y',created_at)=strftime('%Y','now')`).get();
  const prod = db.prepare('SELECT COUNT(*) as c FROM products').get();
  const pend = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pending'`).get();
  res.json({
    today:{orders:today.c,revenue:today.t}, month:{orders:month.c,revenue:month.t},
    year:{orders:year.c,revenue:year.t}, totalProducts:prod.c, pendingOrders:pend.c
  });
});

app.get('/api/admin/reports/transactions', requireAdmin, (req, res) => {
  const { from, to, period, payment_status, payment_method } = req.query;
  let q, p = [];
  if (from && to) { q="SELECT * FROM orders WHERE created_at>=? AND created_at<=? AND status!='cancelled'"; p=[from,to+' 23:59:59']; }
  else if (period==='daily') { q=`SELECT * FROM orders WHERE date(created_at)=date('now') AND status!='cancelled'`; }
  else if (period==='monthly') { q=`SELECT * FROM orders WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now') AND status!='cancelled'`; }
  else if (period==='yearly') { q=`SELECT * FROM orders WHERE strftime('%Y',created_at)=strftime('%Y','now') AND status!='cancelled'`; }
  else { q="SELECT * FROM orders WHERE status!='cancelled'"; }
  if (payment_status && payment_status!=='all') { q += ' AND payment_status=?'; p.push(payment_status); }
  if (payment_method && payment_method!=='all') { q += ' AND payment_method=?'; p.push(payment_method); }
  if (period || (from && to)) q += ' ORDER BY created_at DESC';
  else q += ' ORDER BY created_at DESC LIMIT 100';
  res.json(db.prepare(q).all(...p));
});

// ===== DASHBOARD STATS =====
app.get('/api/admin/dashboard/stats', requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

  // Sales stats
  const todaySales = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE date(created_at)=date('now') AND status!='cancelled'`).get();
  const sevenDaysSales = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE created_at>=? AND status!='cancelled'`).get(sevenDaysAgo);
  const thirtyDaysSales = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE created_at>=? AND status!='cancelled'`).get(thirtyDaysAgo);

  // Top products
  const topProducts = db.prepare(`SELECT p.id, p.name, p.stock, p.price, oi.quantity as sold
    FROM products p LEFT JOIN (SELECT product_id, SUM(quantity) as quantity FROM order_items GROUP BY product_id) oi ON p.id=oi.product_id
    WHERE p.is_active=1 ORDER BY oi.quantity DESC LIMIT 5`).all();

  // Inventory value (total modal barang di stok)
  const inventoryValue = db.prepare(`SELECT COALESCE(SUM(price * stock),0) as value FROM products`).get();

  res.json({
    sales: {
      today: { revenue: todaySales.total, transactions: todaySales.count },
      sevenDays: { revenue: sevenDaysSales.total, transactions: sevenDaysSales.count },
      thirtyDays: { revenue: thirtyDaysSales.total, transactions: thirtyDaysSales.count },
      topProducts: topProducts
    },
    inventory: { totalValue: inventoryValue.value }
  });
});

app.get('/api/admin/dashboard/finance', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(+req.query.days || 30, 1), 3650);
  const since = new Date(Date.now() - (days-1)*24*60*60*1000).toISOString().slice(0,10);
  const onlineRevenue = db.prepare(`SELECT COALESCE(SUM(total),0) revenue FROM orders WHERE created_at>=? AND status!='cancelled'`).get(since).revenue;
  const onlineCogs = db.prepare(`SELECT COALESCE(SUM(CASE WHEN oi.cost_price>0 THEN oi.cost_price*oi.quantity ELSE COALESCE(p.cost_price,0)*oi.quantity END),0) cogs FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id WHERE o.created_at>=? AND o.status!='cancelled'`).get(since).cogs;
  const cashierRevenue = db.prepare(`SELECT COALESCE(SUM(total),0) revenue FROM cashier_sales WHERE created_at>=? AND status!='void'`).get(since).revenue;
  const cashierCogs = db.prepare(`SELECT COALESCE(SUM(CASE WHEN csi.cost_price>0 THEN csi.cost_price*csi.quantity ELSE COALESCE(p.cost_price,0)*csi.quantity END),0) cogs FROM cashier_sale_items csi JOIN cashier_sales cs ON cs.id=csi.sale_id LEFT JOIN products p ON p.id=csi.product_id WHERE cs.created_at>=? AND cs.status!='void'`).get(since).cogs;
  const revenue = Number(onlineRevenue)+Number(cashierRevenue);
  const cogs = Number(onlineCogs)+Number(cashierCogs);
  const grossProfit = revenue-cogs;
  const inventory = db.prepare('SELECT COALESCE(SUM(cost_price*stock),0) as value FROM products WHERE is_active=1').get();
  res.json({ omzet: revenue, hpp: cogs, labaKotor: grossProfit, biayaOperasional: 0, labaBersih: grossProfit, arusKas: revenue, nilaiPersediaan: inventory.value, posisiBersih: grossProfit + inventory.value, periodeHari: days });
});
app.get('/api/admin/dashboard/products', requireAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock>0 AND stock<=5').get().c;
  const outOfStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock<=0').get().c;

  // Get products with low stock detail
  const lowStockProducts = db.prepare('SELECT id, name, stock, price FROM products WHERE stock>0 AND stock<=5 ORDER BY stock ASC LIMIT 10').all();

  res.json({
    total,
    lowStock,
    outOfStock,
    lowStockProducts
  });
});

app.get('/api/admin/dashboard/purchases', requireAdmin, (req, res) => {
  const runningPOs = db.prepare("SELECT COUNT(*) as c FROM purchase_orders WHERE status IN ('draft','pending')").get().c;
  const pendingValue = db.prepare("SELECT COALESCE(SUM(total_amount),0) as total FROM purchase_orders WHERE status IN ('draft','pending')").get().total;
  const supplierCount = db.prepare('SELECT COUNT(DISTINCT supplier_name) as c FROM purchase_orders').get().c;

  // Get recent POs
  const recentPOs = db.prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    runningPOs,
    pendingValue,
    supplierCount,
    recentPOs
  });
});

// ===== PEMBELIAN (Purchase Orders) — CRUD lengkap =====
app.get('/api/admin/purchases', requireAdmin, (req, res) => {
  const { status = '' } = req.query;
  let where = 'WHERE 1=1'; const p = [];
  if (status) { where += ' AND status=?'; p.push(status); }
  const rows = db.prepare(`SELECT po.*, (SELECT COUNT(*) FROM purchase_order_items WHERE po_id=po.id) as item_count FROM purchase_orders po ${where} ORDER BY created_at DESC`).all(...p);
  res.json(rows);
});

app.get('/api/admin/purchases/:id', requireAdmin, (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(+req.params.id);
  if (!po) return res.status(404).json({ error: 'Pembelian tidak ditemukan' });
  const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id=?').all(po.id);
  res.json({ ...po, items });
});

app.post('/api/admin/purchases', requireAdmin, (req, res) => {
  const { supplier_name, expected_date, notes, items } = req.body;
  if (!supplier_name) return res.status(400).json({ error: 'Nama supplier wajib diisi' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Minimal 1 item pembelian' });

  try {
    const clean = items.map(i => {
      const qty = Number(i.quantity), cost = Number(i.unit_cost);
      if (!i.product_name || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(cost) || cost < 0)
        throw new Error('Data item pembelian tidak valid');
      const productId = i.product_id ? +i.product_id : null;
      const product = productId ? db.prepare('SELECT id,name FROM products WHERE id=? AND is_active=1').get(productId) : null;
      if (!product) throw new Error('Setiap item pembelian harus memilih produk aktif');
      return { product_id: product.id, product_name: product.name, quantity: qty, unit_cost: cost, subtotal: qty * cost };
    });
    const total = clean.reduce((s, i) => s + i.subtotal, 0);
    const poNumber = 'PO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

    const insItem = db.prepare('INSERT INTO purchase_order_items (po_id,product_id,product_name,quantity,unit_cost,subtotal) VALUES (?,?,?,?,?,?)');
    const create = db.transaction(() => {
      const r = db.prepare('INSERT INTO purchase_orders (po_number,supplier_name,expected_date,status,total_amount,notes) VALUES (?,?,?,?,?,?)')
        .run(poNumber, supplier_name, expected_date || null, 'pending', total, notes || '');
      clean.forEach(i => insItem.run(r.lastInsertRowid, i.product_id, i.product_name, i.quantity, i.unit_cost, i.subtotal));
      return r.lastInsertRowid;
    });
    const id = create();
    res.json({ success: true, id, po_number: poNumber });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Gagal menyimpan pembelian' });
  }
});

// Terima barang — otomatis menambah stok produk terkait
app.post('/api/admin/purchases/:id/receive', requireAdmin, (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(+req.params.id);
  if (!po) return res.status(404).json({ error: 'Pembelian tidak ditemukan' });
  if (po.status === 'received') return res.status(400).json({ error: 'Pembelian ini sudah diterima sebelumnya' });
  if (po.status === 'cancelled') return res.status(400).json({ error: 'Pembelian ini sudah dibatalkan' });

  const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id=?').all(po.id);
  const getProduct = db.prepare('SELECT stock,cost_price FROM products WHERE id=?');
  const updStock = db.prepare('UPDATE products SET stock=stock+?,cost_price=?,updated_at=CURRENT_TIMESTAMP WHERE id=?');
  const receive = db.transaction(() => {
    items.forEach(i => {
      if (!i.product_id) return;
      const product = getProduct.get(i.product_id);
      if (!product) throw new Error(`Produk ${i.product_name} tidak ditemukan`);
      const nextStock = product.stock + i.quantity;
      const avgCost = nextStock > 0 ? ((product.stock * (Number(product.cost_price)||0)) + (i.quantity * i.unit_cost)) / nextStock : i.unit_cost;
      updStock.run(i.quantity, avgCost, i.product_id);
    });
    db.prepare("UPDATE purchase_orders SET status='received',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(po.id);
  });
  receive();
  res.json({ success: true });
});

app.put('/api/admin/purchases/:id/cancel', requireAdmin, (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(+req.params.id);
  if (!po) return res.status(404).json({ error: 'Pembelian tidak ditemukan' });
  if (po.status === 'received') return res.status(400).json({ error: 'Pembelian yang sudah diterima tidak bisa dibatalkan' });
  db.prepare("UPDATE purchase_orders SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(po.id);
  res.json({ success: true });
});

app.delete('/api/admin/purchases/:id', requireAdmin, (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(+req.params.id);
  if (!po) return res.status(404).json({ error: 'Pembelian tidak ditemukan' });
  if (po.status === 'received') return res.status(400).json({ error: 'Pembelian yang sudah diterima tidak bisa dihapus' });
  db.prepare('DELETE FROM purchase_orders WHERE id=?').run(po.id);
  res.json({ success: true });
});

app.get('/api/admin/reports/tax', requireAdmin, (req, res) => {
  const { year, month } = req.query;
  const s = getSettings();
  let q=`SELECT * FROM orders WHERE status!='cancelled'`, p=[];
  const yr = year||new Date().getFullYear().toString();
  if (month) { q+=` AND strftime('%Y',created_at)=? AND strftime('%m',created_at)=?`; p=[yr,month]; }
  else { q+=` AND strftime('%Y',created_at)=?`; p=[yr]; }
  const orders = db.prepare(q).all(...p);
  let revenue=0, ppnTotal=0;
  orders.forEach(o=>{ revenue+=o.subtotal; ppnTotal+=o.ppn_amount; });
  res.json({
    period:{year:yr,month:month||null}, totalOrders:orders.length,
    totalRevenue:revenue, totalPPN:ppnTotal, ppnRate:+s.ppn_rate,
    pphRate:2, pphAmount:revenue*0.02, npwp:s.npwp, company:s.company_name, nib:s.nib,
    orders:orders.map(o=>({invoice:o.invoice,date:o.created_at,subtotal:o.subtotal,ppn:o.ppn_amount,total:o.total}))
  });
});

// ===== SEO =====
app.get('/sitemap.xml', (req, res) => {
  const prods = db.prepare('SELECT id,updated_at FROM products WHERE is_active=1').all();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://tokotrijaya.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  prods.forEach(p => xml += `\n<url><loc>https://tokotrijaya.com/#product-${p.id}</loc><lastmod>${p.updated_at}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  xml += '\n</urlset>';
  res.type('application/xml').send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send("User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\n\nSitemap: https://tokotrijaya.com/sitemap.xml");
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const isCsv = req.path.includes('/import');
      return res.status(400).json({ error: `Ukuran file terlalu besar (maks ${isCsv ? '20MB' : '5MB'})` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(500).json({ error: err.message });
  next();
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🏪 TokoTriJaya Server berjalan di http://localhost:${PORT}`);
  console.log(`  🌐 Website : http://localhost:${PORT}`);
  console.log(`  🔧 Admin   : http://localhost:${PORT}/admin.html`);
  console.log(`  📦 Mode    : ${NODE_ENV}\n`);
});
