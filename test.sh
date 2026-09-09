#!/bin/bash
# Test script for TokoTriJaya
# Jalankan: bash test.sh

echo "🧪 TokoTriJaya Test Suite"
echo "========================="

# Start server
cd /home/linux/tokotrijaya
rm -f data/tokotrijaya.db
node server.js &
SERVER_PID=$!
sleep 3

PASS=$(grep -o 'Password: [a-f0-9]*' /tmp/ttj.log 2>/dev/null | awk '{print $2}')
if [ -z "$PASS" ]; then
  PASS=$(grep -o 'Password: [a-f0-9]*' /proc/$SERVER_PID/fd/1 2>/dev/null | awk '{print $2}')
fi

# Get password from server startup
echo ""
echo "Server started (PID: $SERVER_PID)"

# Wait for server
for i in $(seq 1 10); do
  if curl -s http://localhost:3000/api/settings > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  sleep 1
done

echo ""
echo "=== TEST 1: Settings ==="
RESULT=$(curl -s http://localhost:3000/api/settings)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ site_name:', d['site_name'])" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 2: Products (empty) ==="
RESULT=$(curl -s http://localhost:3000/api/products)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ products:', len(d['products']))" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 3: Categories ==="
RESULT=$(curl -s http://localhost:3000/api/categories)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ categories:', d)" 2>/dev/null || echo "❌ FAILED"

# Login
echo ""
echo "=== TEST 4: Login ==="
RESULT=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"$PASS\"}" -c /tmp/ttj_cookies.txt)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ login:', d['success'])" 2>/dev/null || echo "❌ FAILED"

# Create products
echo ""
echo "=== TEST 5: Create Product ==="
RESULT=$(curl -s -X POST http://localhost:3000/api/admin/products -H 'Content-Type: application/json' -d '{"name":"Produk Test 1","description":"Deskripsi test","price":50000,"stock":10,"category":"Elektronik"}' -b /tmp/ttj_cookies.txt)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ product created:', d)" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 6: Create Product 2 ==="
RESULT=$(curl -s -X POST http://localhost:3000/api/admin/products -H 'Content-Type: application/json' -d '{"name":"Produk Test 2","description":"Produk kedua","price":75000,"stock":5,"category":"Fashion"}' -b /tmp/ttj_cookies.txt)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ product created:', d)" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 7: Get Products ==="
RESULT=$(curl -s http://localhost:3000/api/products)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ total products:', d['total'])" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 8: Create Order ==="
RESULT=$(curl -s -X POST http://localhost:3000/api/orders -H 'Content-Type: application/json' -d '{"customer_name":"Budi Santoso","customer_phone":"08123456789","customer_address":"Jl. Merdeka No. 10, Jakarta","payment_method":"bank","payment_detail":"BCA: 1234567890","shipping_method":"JNE","shipping_cost":15000,"items":[{"product_id":1,"quantity":2},{"product_id":2,"quantity":1}]}')
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ order:', d)" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 9: Admin Orders ==="
RESULT=$(curl -s http://localhost:3000/api/admin/orders -b /tmp/ttj_cookies.txt)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ total orders:', d['total'])" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 10: Reports Summary ==="
RESULT=$(curl -s http://localhost:3000/api/admin/reports/summary -b /tmp/ttj_cookies.txt)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ today:', d['today'], 'products:', d['totalProducts'])" 2>/dev/null || echo "❌ FAILED"

echo ""
echo "=== TEST 11: Robots.txt ==="
curl -s http://localhost:3000/robots.txt | head -3

echo ""
echo "=== TEST 12: Sitemap ==="
curl -s http://localhost:3000/sitemap.xml | head -3

echo ""
echo "==============================="
echo "✅ SEMUA TEST SELESAI!"
echo "==============================="

# Cleanup
kill $SERVER_PID 2>/dev/null
