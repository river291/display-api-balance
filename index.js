/**
 * api-balance — 在 DeepSeek Harness 的输入框下方显示 DeepSeek API 余额。
 *
 * 服务端：注册 /api/balance 路由，读取凭据 DEEPSEEK_API_KEY 后调用
 *        https://api.deepseek.com/user/balance，返回 JSON。
 * 前端：客户端插件把余额作为一条文字统计挂到 conversation.composer.dock，
 *       紧跟在轮次/上下文用量之后，每 60 秒重新请求 /api/balance。
 *
 * 与 Web 版的差异：桌面版 (Electron) 的 index.html 来自打包好的
 * dsh-web-frontend/dist，不经过 Host 的 webServer 渲染，因此 Web 版用的
 * webServer.tapIndex 注入脚本在桌面版不会生效；这里改为让 Client 插件
 * 在输入框下方的统计行里渲染同样的余额文字。页面里的相对路径
 * fetch('/api/balance') 会经 dsh-app:// 协议转发到本 Host 的这条路由，
 * 所以服务端代码与 Web 版保持一致。
 */
export const name = 'api-balance'

export const inject = ['webServer', 'credentials']

/** DeepSeek 开放平台余额接口。 */
const BALANCE_API = 'https://api.deepseek.com/user/balance'

/** 保存 API Key 的凭据引用名；与 Web 版一致。 */
const API_KEY_REF = 'DEEPSEEK_API_KEY'

/** 上游请求超时时间。 */
const UPSTREAM_TIMEOUT_MS = 15000

/**
 * 注册 Host 侧 /api/balance 路由。
 * @param ctx - 带有 webServer 与 credentials 服务的 Host 上下文。
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/balance',
    handler: async (req, res) => {
      try {
        // 每次请求都重新解析，轮换 Key 后无需重启。
        const hit = await ctx.credentials.resolve(API_KEY_REF)
        if (!hit || !hit.value) {
          res.writeHead(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }))
          return
        }
        const upstream = await fetch(BALANCE_API, {
          headers: { authorization: `Bearer ${hit.value}` },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
        const data = await upstream.json()
        res.writeHead(upstream.status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify(data))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ctx.logger?.warn?.(new Error(`api-balance: ${message}`))
        if (res.headersSent) {
          res.destroy()
          return
        }
        res.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ error: message }))
      }
    },
  }), 'api-balance: /api/balance route')
}
