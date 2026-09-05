#!/bin/bash
# تست سایت آرتا روی Netlify — GET ها + ثبت سفارش تست + پیگیری
SITE="https://delightful-salamander-306f01.netlify.app"
echo "=== HOME status ==="
curl -s -o /dev/null -w "%{http_code}\n" --max-time 25 "$SITE/"
echo "=== /checkout status ==="
curl -s -o /dev/null -w "%{http_code}\n" --max-time 25 "$SITE/checkout"
echo "=== /admin status ==="
curl -s -o /dev/null -w "%{http_code}\n" --max-time 25 "$SITE/admin"
echo "=== /api/provinces ==="
curl -s --max-time 25 "$SITE/api/provinces" | head -c 280; echo
echo "=== /api/products ==="
curl -s --max-time 25 "$SITE/api/products" | head -c 280; echo
echo "=== POST order (تست) ==="
ORD=$(curl -s --max-time 30 -X POST "$SITE/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"تست یزد","phone":"09120000000","provinceName":"تهران","cityName":"تهران","address":"خیابان تست، پلاک ۱۲، واحد ۳","paymentMethod":"CARD_TRANSFER","items":[{"productId":"nan-fantezi-kuchak","essence":false,"boxes":2}]}')
echo "$ORD" | head -c 400; echo
SERIAL=$(echo "$ORD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("serial",""))' 2>/dev/null)
echo "=== track serial=$SERIAL ==="
curl -s --max-time 25 "$SITE/api/orders/track?serial=$SERIAL&phone=09120000000" | head -c 280; echo
echo "=== SERIAL_FOR_CLEANUP=$SERIAL ==="
