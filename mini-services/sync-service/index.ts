// سرویس سینک real-time — socket.io روی پورت 3003
// رویداد data-changed پس از هر push به همه دستگاه‌های متصل پخش می‌شود
import { Server } from 'socket.io'
import { createServer } from 'http'

const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && (req.url || '').startsWith('/notify')) {
    res.writeHead(204)
    res.end()
    io.emit('data-changed', { t: Date.now() })
    return
  }
  res.writeHead(404)
  res.end('not found')
})

const io = new Server(httpServer, {
  cors: { origin: '*' },
  path: '/socket.io',
})

httpServer.listen(3003, () => {
  console.log('[sync-service] socket.io listening on 3003')
})
