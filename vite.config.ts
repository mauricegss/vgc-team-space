import { defineConfig } from 'vite'
import type { Plugin, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

const jsonWriterPlugin = (): Plugin => ({
  name: 'dados-completos-writer',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/teams', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }

        const teams = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (!Array.isArray(teams)) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Payload must be an array.' }))
          return
        }

        const filePath = path.resolve(server.config.root, 'dados-completos.json')
        await fs.writeFile(filePath, JSON.stringify(teams, null, 4) + '\n', 'utf8')

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
      }
    })

    server.middlewares.use('/api/copies', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }

        const copies = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const filePath = path.resolve(server.config.root, 'copies.json')
        await fs.writeFile(filePath, JSON.stringify(copies, null, 4) + '\n', 'utf8')

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
      }
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [jsonWriterPlugin(), react(), tailwindcss()],
})
