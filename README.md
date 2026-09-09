# 🏪 TokoTriJaya

Toko Online Terpercaya - E-Commerce Platform dengan Node.js, Express, dan SQLite.

## ✨ Fitur

- 🛒 Keranjang belanja & checkout
- 🔍 Pencarian & filter produk per kategori
- 📦 Tracking pesanan
- 🔐 Admin panel dengan autentikasi
- 📊 Dashboard & laporan transaksi
- 💰 Perhitungan PPN (Pajak Pertambahan Nilai)
- 📱 Responsive design (mobile-friendly)
- 🔍 SEO optimized (meta tags, Open Graph, JSON-LD)
- 📸 Upload gambar produk

## 🚀 Instalasi (Ubuntu 24.04)

### 1. Clone Repository

```bash
git clone https://github.com/USERNAME/tokotrijaya.git
cd tokotrijaya
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

```bash
cp .env.example .env
# Generate random secret:
# openssl rand -hex 32
# Lalu edit .env dan isi SESSION_SECRET dengan random string tersebut
```

### 4. Jalankan Server

```bash
# Development
npm run dev

# Production (dengan PM2)
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Setup Nginx (Production)

```bash
sudo cp nginx.conf /etc/nginx/sites-available/tokotrijaya
sudo ln -s /etc/nginx/sites-available/tokotrijaya /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup SSL (HTTPS)

```bash
sudo certbot --nginx -d tokotrijaya.com -d www.tokotrijaya.com
```

## 📁 Struktur Project

```
tokotrijaya/
├── server.js              # Backend server (Express.js)
├── package.json           # Dependencies
├── ecosystem.config.js    # PM2 config
├── nginx.conf             # Nginx config
├── setup.sh               # Setup script
├── .env                   # Environment variables (JANGAN di-push!)
├── .env.example           # Template environment
├── .gitignore             # Git ignore rules
├── public/
│   ├── index.html         # Halaman utama (toko)
│   └── admin.html         # Panel admin
├── uploads/               # Upload gambar (JANGAN di-push!)
│   ├── products/
│   ├── maps/
│   └── logo/
└── data/                  # Database SQLite (JANGAN di-push!)
    └── tokotrijaya.db
```

## 🔑 Default Admin

Saat pertama kali menjalankan server, admin account akan dibuat otomatis dengan password random. **Catat password yang muncul di terminal!**

- Username: `admin`
- Password: *(random, lihat di terminal)*

Admin akan diminta mengganti password saat login pertama kali.

## ⚙️ Konfigurasi

Semua pengaturan toko dapat diubah melalui **Admin Panel > Pengaturan**:

- Informasi toko (nama, alamat, kontak)
- Rekening bank & e-wallet
- Pengiriman (JNE, TIKI, POS, Grab, GoSend)
- Pajak (PPN rate)
- SEO & Logo
- Google Maps

## 🛡️ Keamanan

- Session secret menggunakan environment variable
- Cookie: `httpOnly`, `secure` (production), `sameSite`
- Rate limiting pada endpoint login (5x per menit)
- Upload path traversal protection
- Password hashing dengan bcrypt
- Admin diwajibkan ganti password default

## 📄 License

MIT
