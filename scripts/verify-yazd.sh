#!/bin/bash
# ===== Verify Arta Yazd origin + Iran Zamin card (single-call run) =====
set -u
cd /home/z/my-project/arta-wt
export DATABASE_URL="file:/home/z/my-project/arta-wt/db/custom.db"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# --- start dev server ---
rm -f dev.log
bun run dev > /dev/null 2>&1 &
SERVER_PID=$!

echo "--- waiting for server ---"
READY=0
for i in $(seq 1 60); do
  if curl -s --max-time 3 -o /dev/null http://localhost:3000/api/provinces 2>/dev/null; then READY=1; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then bad "server never became ready"; kill $SERVER_PID 2>/dev/null; exit 1; fi
ok "server ready"

# --- provinces API: origin + card + Yazd shipping ---
PR=$(curl -s --max-time 20 http://localhost:3000/api/provinces)
echo "$PR" | python3 -c '
import json,sys
d=json.load(sys.stdin)
errs=[]
if d.get("originCity")!="یزد": errs.append(f"originCity={d.get(chr(111)+chr(114)+chr(105)+chr(103)+chr(105)+chr(110)+chr(67)+chr(105)+chr(116)+chr(121))}")
if d.get("cardNumber")!="6063731255582299": errs.append("cardNumber wrong")
if d.get("cardOwner")!="علی سبیلی": errs.append("cardOwner wrong")
if d.get("cardBank")!="بانک ایران زمین": errs.append("cardBank wrong")
prov={p["name"]:p["shippingCost"] for p in d.get("provinces",[])}
if prov.get("یزد")!=80000: errs.append(f"یزد={prov.get(chr(0x06cc)+chr(0x0632)+chr(0x062f))}")
if prov.get("تهران")!=150000: errs.append("تهران cost wrong")
if prov.get("اصفهان")!=100000: errs.append("اصفهان cost wrong")
print("OK" if not errs else "ERR:"+";".join(errs))
' > /tmp/pr_check.txt
if grep -q "^OK" /tmp/pr_check.txt; then ok "provinces API: Yazd origin + card settings + costs"; else bad "provinces API: $(cat /tmp/pr_check.txt)"; fi

# --- products API ---
PC=$(curl -s --max-time 20 http://localhost:3000/api/products)
N=$(echo "$PC" | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("products",[])))')
[ "$N" = "4" ] && ok "products API: 4 products" || bad "products API: $N products"

# --- pages render ---
for path in / /cart /checkout /track /about /admin; do
  C=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  [ "$C" = "200" ] && ok "page $path -> 200" || bad "page $path -> $C"
done

# --- create test order: 2 boxes small (retail), destination Tehran (150,000) ---
ORD=$(curl -s --max-time 30 -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"تست یزد","phone":"09120000000","provinceName":"تهران","cityName":"تهران","address":"خیابان تست، پلاک ۱۲، واحد ۳","paymentMethod":"CARD_TRANSFER","items":[{"productId":"nan-fantezi-kuchak","essence":false,"boxes":2}]}')
echo "$ORD" | python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("ok") and d.get("subtotal")==1520000 and d.get("shippingCost")==150000 and d.get("total")==1670000 and d.get("serial",0)>=1002:
    print("OK serial="+str(d["serial"]))
else:
    print("ERR:"+json.dumps(d,ensure_ascii=False))
' > /tmp/ord_check.txt
if grep -q "^OK" /tmp/ord_check.txt; then ok "order POST: retail math + Tehran shipping 150k ($(cat /tmp/ord_check.txt | tr -d '\n'))"; else bad "order POST: $(cat /tmp/ord_check.txt)"; fi

SERIAL=$(grep -o 'serial=[0-9]*' /tmp/ord_check.txt | cut -d= -f2)

# --- track the order ---
if [ -n "$SERIAL" ]; then
  TR=$(curl -s --max-time 20 "http://localhost:3000/api/orders/track?serial=$SERIAL&phone=09120000000")
  echo "$TR" | python3 -c '
import json,sys
d=json.load(sys.stdin)
o=d.get("order") or {}
items=json.loads(o.get("items","[]")) if isinstance(o.get("items"),str) else o.get("items",[])
boxok = any(i.get("boxCount")==2 for i in items)
print("OK" if o.get("serial") and o.get("status")=="PENDING" and boxok and o.get("total")==1670000 else "ERR:"+json.dumps(d,ensure_ascii=False)[:300])
' > /tmp/track_check.txt
  if grep -q "^OK" /tmp/track_check.txt; then ok "track API: order $SERIAL found with boxCount fields"; else bad "track API: $(cat /tmp/track_check.txt)"; fi
fi

# --- checkout shows card info in HTML? (client-fetches; check page compiles only) ---
echo "=============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
kill $SERVER_PID 2>/dev/null
sleep 1
pkill -f "next dev" 2>/dev/null
exit 0
