import { io, Socket } from 'socket.io-client'

// اتصال پایدار از پروسه Next به سرویس socket (پورت 3003)
// برای broadcast تغییرات به همه کلاینت‌های آنلاین

const g = globalThis as unknown as { __wafflySocket?: Socket }

export function getRealtimeSocket(): Socket {
  if (!g.__wafflySocket) {
    g.__wafflySocket = io('http://localhost:3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    })
    g.__wafflySocket.on('connect_error', () => {
      // سرویس هنوز بالا نیامده — reconnection خودکار تلاش می‌کند
    })
  }
  return g.__wafflySocket
}

// خبر دادن به همه کلاینت‌ها که داده تغییر کرده (برای pull فوری)
export function broadcastDataChanged(source: string) {
  try {
    const s = getRealtimeSocket()
    const payload = { source, ts: Date.now() }
    if (s.connected) {
      s.emit('broadcast-data-changed', payload)
    } else {
      s.once('connect', () => s.emit('broadcast-data-changed', payload))
    }
  } catch {
    // اگر broadcast نشد، pull دوره‌ای جبران می‌کند
  }
}
