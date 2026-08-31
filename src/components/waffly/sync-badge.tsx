'use client'

// نشان وضعیت سینک در هدر
import { Cloud, CloudOff, Loader2, CloudUpload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSyncStore, forceSyncNow } from '@/lib/sync-engine'
import { faDigits } from '@/lib/jalali'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

export function SyncBadge() {
  const { online, syncing, pendingCount } = useSyncStore()

  const label = syncing
    ? 'در حال سینک…'
    : !online
      ? 'آفلاین — تغییرات صف شده'
      : pendingCount > 0
        ? `${faDigits(pendingCount)} مورد در صف ارسال`
        : 'همگام‌شده'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => forceSyncNow()}
            aria-label={`سینک: ${label}`}
          >
            {syncing ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : !online ? (
              <CloudOff className="h-4.5 w-4.5" />
            ) : pendingCount > 0 ? (
              <span className="relative">
                <CloudUpload className="h-4.5 w-4.5" />
                <span className="absolute -top-1.5 -left-1.5 h-3.5 min-w-3.5 rounded-full bg-amber-400 text-[9px] text-black flex items-center justify-center px-0.5 waffly-num">
                  {faDigits(pendingCount > 99 ? '99+' : pendingCount)}
                </span>
              </span>
            ) : (
              <Cloud className="h-4.5 w-4.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{label} — برای سینک فوری کلیک کنید</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
