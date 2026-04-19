import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { Readable } from 'node:stream'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import adminApiHandler from './api/router.ts'

function buildRequestFromNode(req: import('node:http').IncomingMessage) {
  const origin = `http://${req.headers.host ?? '127.0.0.1:5173'}`
  const url = new URL(req.url ?? '/', origin)
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry))
      continue
    }
    if (value) headers.append(key, value)
  }

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
  }

  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    init.body = Readable.toWeb(req) as BodyInit
    init.duplex = 'half'
  }

  return new Request(url, init)
}

async function sendNodeResponse(
  res: import('node:http').ServerResponse,
  response: Response
) {
  res.statusCode = response.status

  const setCookies =
    typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : []

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return
    res.setHeader(key, value)
  })

  if (setCookies.length > 0) {
    res.setHeader('Set-Cookie', setCookies)
  } else {
    const cookie = response.headers.get('set-cookie')
    if (cookie) res.setHeader('Set-Cookie', cookie)
  }

  const body = Buffer.from(await response.arrayBuffer())
  res.end(body)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
      {
        name: 'local-admin-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/')) {
              next()
              return
            }

            try {
              const request = buildRequestFromNode(req)
              const response = await adminApiHandler(request)
              await sendNodeResponse(res, response)
            } catch (error) {
              next(error)
            }
          })
        },
      },
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    server: {
      proxy: env.VITE_API_PROXY_TARGET
        ? {
            '/assets': {
              target: env.VITE_API_PROXY_TARGET,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('@tiptap')) return 'tiptap';
            if (id.includes('motion')) return 'motion';
            if (id.includes('react-router-dom') || id.includes('@remix-run/router')) {
              return 'router';
            }
            if (id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (
              id.includes('@radix-ui') ||
              id.includes('class-variance-authority') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge')
            ) {
              return 'ui-vendor';
            }
            if (id.includes('gsap')) {
              return 'gsap';
            }

            return undefined;
          },
        },
      },
    },
  };
})
