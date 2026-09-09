#!/bin/bash
# ==========================================
# TokoTriJaya - Setup Script untuk Ubuntu 24.04
# ==========================================
# Jalankan: sudo bash setup.sh

set -e

echo ""
echo "========================================="
echo "  🏪 TokoTriJaya.com - Setup Ubuntu 24.04"
echo "========================================="
echo ""

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cek apakah dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Jalankan script ini sebagai root: sudo bash setup.sh${NC}"
  exit 1
fi

echo -e "${YELLOW}📋 Langkah yang akan dilakukan:${NC}"
echo "  1. Update sistem & install dependencies"
echo "  2. Install Node.js 20 LTS"
echo "  3. Install & konfigurasi PM2"
echo "  4. Install & konfigurasi Nginx"
echo "  5. Setup firewall (UFW)"
echo "  6. Generate random SESSION_SECRET"
echo "  7. Setup automatic backup"
echo ""
read -p "Lanjutkan? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Dibatalkan."
  exit 1
fi

# ==========================================
# 1. Update System & Install Dependencies
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 1: Update sistem & install dependencies...${NC}"
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx ufw

# ==========================================
# 2. Install Node.js 20 LTS
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 2: Install Node.js 20 LTS...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  echo -e "${GREEN}✅ Node.js $(node -v) terinstall${NC}"
else
  echo -e "${GREEN}✅ Node.js sudah terinstall: $(node -v)${NC}"
fi

# ==========================================
# 3. Setup Project
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 3: Setup project...${NC}"

PROJECT_DIR="/home/$SUDO_USER/tokotrijaya"
if [ -d "$PROJECT_DIR" ]; then
  echo -e "${YELLOW}⚠️  Folder $PROJECT_DIR sudah ada. Skip cloning.${NC}"
  cd "$PROJECT_DIR"
else
  echo -e "${YELLOW}⚠️  Pastikan project sudah ada di $PROJECT_DIR${NC}"
  echo "    Atau clone dari GitHub:"
  echo "    git clone https://github.com/USERNAME/tokotrijaya.git $PROJECT_DIR"
  echo ""
  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

# Install dependencies
echo "Installing npm dependencies..."
npm install --production

# Create required directories
mkdir -p uploads/{products,maps,logo} data

# Setup .env jika belum ada
if [ ! -f .env ]; then
  echo ""
  echo -e "${YELLOW}⚠️  File .env belum ada!${NC}"
  echo "Generate random SESSION_SECRET..."
  RANDOM_SECRET=$(openssl rand -hex 32)

  cat > .env << EOF
# TokoTriJaya Environment Variables
PORT=3000
NODE_ENV=production
SESSION_SECRET=${RANDOM_SECRET}
EOF

  echo -e "${GREEN}✅ File .env dibuat dengan random secret${NC}"
  echo -e "${RED}⚠️  PENTING: Simpan SESSION_SECRET ini di tempat aman!${NC}"
  echo "   Secret: ${RANDOM_SECRET}"
fi

# Set permissions
chmod 600 .env
chmod -R 755 uploads/
chmod -R 755 data/

# ==========================================
# 4. Setup PM2
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 4: Setup PM2...${NC}"

if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# Start with PM2
pm2 start ecosystem.config.js 2>/dev/null || pm2 start server.js --name tokotrijaya
pm2 save

# Setup PM2 startup
env_path=$(which pm2)
sudo env PATH=$PATH:/usr/local/bin pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER 2>/dev/null || true

echo -e "${GREEN}✅ PM2 configured${NC}"

# ==========================================
# 5. Setup Nginx
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 5: Setup Nginx...${NC}"

# Copy nginx config
if [ -f nginx.conf ]; then
  cp nginx.conf /etc/nginx/sites-available/tokotrijaya
  ln -sf /etc/nginx/sites-available/tokotrijaya /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
fi

# Test nginx config
nginx -t
systemctl reload nginx
systemctl enable nginx

echo -e "${GREEN}✅ Nginx configured${NC}"

# ==========================================
# 6. Setup Firewall
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 6: Setup Firewall (UFW)...${NC}"

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}✅ Firewall aktif${NC}"

# ==========================================
# 7. Setup Backup
# ==========================================
echo ""
echo -e "${GREEN}📦 Step 7: Setup Automatic Backup...${NC}"

BACKUP_DIR="/home/$SUDO_USER/backups/tokotrijaya"
mkdir -p "$BACKUP_DIR"

cat > /usr/local/bin/tokotrijaya-backup << 'BACKUP_SCRIPT'
#!/bin/bash
PROJECT_DIR="$(dirname $(readlink -f $(which node)))/../tokotrijaya"
BACKUP_DIR="/home/$(whoami)/backups/tokotrijaya"
DATE=$(date +%Y-%m-%d_%H-%M)

# Backup database
if [ -f "$PROJECT_DIR/data/tokotrijaya.db" ]; then
  cp "$PROJECT_DIR/data/tokotrijaya.db" "$BACKUP_DIR/tokotrijaya_$DATE.db"
fi

# Hapus backup luar dari 7 hari
find "$BACKUP_DIR" -name "*.db" -mtime +7 -delete
BACKUP_SCRIPT

chmod +x /usr/local/bin/tokotrijaya-backup

# Jalankan backup setiap hari jam 2 pagi
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/tokotrijaya-backup") | crontab -

echo -e "${GREEN}✅ Backup otomatis dijadwalkan (jam 2:00 setiap hari)${NC}"

# ==========================================
# SELESAI
# ==========================================
echo ""
echo "========================================="
echo -e "${GREEN}  ✅ Instalasi Selesai!${NC}"
echo "========================================="
echo ""
echo "  🌐 Website  : http://tokotrijaya.com"
echo "  🔧 Admin    : http://tokotrijaya.com/admin.html"
echo "  🔑 Login    : admin / (lihat di terminal saat pertama kali run)"
echo ""
echo "  📋 Selanjutnya:"
echo "  1. Point domain DNS ke IP VPS ini"
echo "  2. Jalankan SSL: sudo certbot --nginx -d tokotrijaya.com -d www.tokotrijaya.com"
echo "  3. Login admin & ganti password"
echo "  4. Isi pengaturan toko di admin panel"
echo ""
echo "  📁 Project: $PROJECT_DIR"
echo "  📊 Logs:"
echo "     PM2: pm2 logs tokotrijaya"
echo "     Nginx: sudo tail -f /var/log/nginx/error.log"
echo "  🔄 Restart: pm2 restart tokotrijaya"
echo ""
