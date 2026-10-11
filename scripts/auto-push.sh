#!/bin/bash
# auto-push.sh — کامیت و push خودکار هر تغییری به گیت‌هاب (اجرا توسط watcher یا دستی)
# استفاده: bash scripts/auto-push.sh ["پیام کامیت اختیاری"]
cd /home/z/my-project || exit 1

MSG="${1:-auto-sync: $(date '+%Y-%m-%d %H:%M')}"
export HOME=/home/z

# جلوگیری از اجرای همزمان دو instance
LOCK=/tmp/waffly-autopush.lock
if [ -f "$LOCK" ] && kill -0 "$(cat $LOCK)" 2>/dev/null; then exit 0; fi
echo $$ > "$LOCK"

git add -A
if ! git diff --cached --quiet; then
  git commit -m "$MSG" --quiet && echo "[$(date '+%H:%M:%S')] committed: $MSG"
fi

# push فقط اگر چیزی برای push هست (شامل کامیت‌های قبلی)
BEHIND=$(git rev-list --count origin/main..main 2>/dev/null || echo "?")
if [ "$BEHIND" != "0" ] && [ -n "$BEHIND" ]; then
  if git push origin main --quiet 2>/tmp/push-err.log; then
    echo "[$(date '+%H:%M:%S')] pushed $BEHIND commit(s) ✓"
  else
    echo "[$(date '+%H:%M:%S')] push FAILED: $(head -c 200 /tmp/push-err.log)"
  fi
fi
rm -f "$LOCK"
