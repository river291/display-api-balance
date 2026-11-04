# display-api-balance

[English](README.md) | 中文

在 DeepSeek Harness 输入框下方的统计行里显示 **DeepSeek API 余额**，每 60 秒自动刷新；点击余额可设置本地低余额阈值，低于阈值时金额变红。

## 功能

- 余额显示在输入框下方的统计行（"轮次 · tok/s"、"上下文用量"之后），与 DSH 自带统计同一套字号 / 颜色 / 图标风格，不额外占一块悬浮层。
- 每 60 秒自动刷新；切回窗口或标签页时立即刷新一次。
- 点击余额弹出小面板设置低余额阈值（默认 ¥20），低于或等于阈值时金额变红并加粗；留空关闭提醒。
- 阈值保存在本机浏览器 `localStorage`（`display-api-balance:threshold`），不随插件上传，也不经过网络。
- 未配置 `DEEPSEEK_API_KEY` / 接口失败 / 未登录时给出对应提示，不会显示错误数字。
- 兼容深浅色主题：颜色全部取 DSH 的 `--dsw-alias-*` 语义变量。

## 安装

DSH 插件通过 profile 安装。在桌面版插件页或 CLI 执行：

```sh
# 从 GitHub 安装（源码即产物，无构建步骤，不需要 allowBuilds 授权）
dsh plugin --profile <profile> add github:river291/display-api-balance
```

安装后在插件页确认 `display-api-balance` 已启用。

插件目前通过 GitHub 分发，尚未发布到 npm，请使用上面的 GitHub 地址安装；以后若发布到 npm，也可以 `dsh plugin add display-api-balance`（包的 `package.json` 里 `repository` 已指回本仓库，市场会据此关联 npm 数据）。

## 前置条件

- 本机 Host 的凭据服务能解析 `DEEPSEEK_API_KEY`：在 DSH 设置 → 模型里填入 DeepSeek API Key，或在启动 DSH 的环境里导出该变量。
- DSH 版本：在 `0.2.1-rc.5`（桌面版）上开发与验证；Host 侧只用到 `webServer`、`credentials`，客户端只用到 `slots`、`locale`。

## 工作方式

- **Host 半端**（`index.js`）注册 `GET /api/balance`：每次请求重新解析凭据 `DEEPSEEK_API_KEY`（轮换 Key 无需重启），带 `Authorization: Bearer` 调用 `https://api.deepseek.com/user/balance`，15 秒超时，返回上游 JSON。Key 只留在 Host 进程内，不会下发到浏览器。
- **Client 半端**（`client.js`）把余额作为一条文字统计注册到 `conversation.composer.dock` 插槽（`order: 2`，位于上下文占用之后）。页面里的相对路径 `fetch('/api/balance')` 在桌面版经 `dsh-app://` 协议转发到上面的 Host 路由，在 Web 版就是同源请求。
- 明文 HTTP 的 Web 部署请自行注意：`/api/balance` 与 DSH 的其他 Host 路由一样，只建议绑定在回环地址上使用。

## 与 DSH Web 版旧方案的区别

Web 版用的是 `webServer.tapIndex` 往 `index.html` 注入 DOM 脚本。桌面版（Electron）的窗口从打包好的 `dsh-web-frontend/dist` 加载页面，不经过 Host 的 `renderIndex`，注入脚本不会执行；因此本插件改为在 Client 插槽里用 React 渲染，桌面版与 Web 版都能用。

## 卸载

```sh
dsh plugin --profile <profile> remove display-api-balance
```

## License

MIT
