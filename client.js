window.__ModuleLoader__.load({
  id: 'dsh-api-balance',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'api-balance'
    const POLL_MS = 60000
    const THRESHOLD_KEY = 'dsh-api-balance:threshold'
    const THRESHOLD_DEFAULT = 20

    const zh = {
      label: 'API余额',
      loading: '…',
      failed: '—',
      hint: 'DeepSeek API 余额（每 60 秒自动刷新）',
      updated: '更新于',
      toppedUp: '充值',
      granted: '赠送',
      low: '低于提醒阈值',
      lowHint: '低于提醒阈值，点击设置',
      thresholdTitle: '余额提醒阈值',
      thresholdHint: '低于该金额时金额变红；留空关闭提醒。点击余额可再次修改。',
      thresholdPlaceholder: '留空关闭',
      save: '保存',
      cancel: '取消',
      noKeyHint: '未配置 DEEPSEEK_API_KEY：在设置 → 模型中填入 API Key 后即可显示余额。',
      failedHint: '读取余额失败，将自动重试。',
      unavailableHint: 'API 余额接口暂不可用，将自动重试。',
    }

    const en = {
      label: 'API balance',
      loading: '…',
      failed: '—',
      hint: 'DeepSeek API balance (auto-refreshes every 60s)',
      updated: 'Updated',
      toppedUp: 'topped up',
      granted: 'granted',
      low: 'below alert threshold',
      lowHint: 'Below the alert threshold; click to change it',
      thresholdTitle: 'Balance alert threshold',
      thresholdHint: 'The amount turns red below this value; leave it empty to disable the alert. Click the balance to edit it again.',
      thresholdPlaceholder: 'empty = off',
      save: 'Save',
      cancel: 'Cancel',
      noKeyHint: 'DEEPSEEK_API_KEY is not configured. Add an API key under Settings → Models to show the balance.',
      failedHint: 'Reading the balance failed; it retries automatically.',
      unavailableHint: 'The balance endpoint is unavailable; it retries automatically.',
    }

    /**
     * Mirrors the shipped composer stat pills (ui-chat StatsPills) so the
     * balance reads as one more ambient stat next to the turn/token usage.
     */
    const CSS = [
      // The dock's slot wrapper uses display:contents, so this anchor is a flex
      // item beside the shipped stats; order:1 places it after the context meter.
      '.dsab-anchor{order:1;position:relative;min-width:0;',
      'font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);',
      'line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}',
      '.dsab-pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;',
      'color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;',
      'line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;',
      'padding:1px 8px;display:inline-flex;cursor:pointer}',
      '.dsab-pill:hover,.dsab-pill[aria-expanded="true"]{',
      'background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));',
      'color:var(--dsw-alias-label-secondary)}',
      '.dsab-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsab-pill svg{flex:none;width:14px;height:14px}',
      '.dsab-label{white-space:nowrap}',
      '.dsab-amount{font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dsab-pill[data-low="true"] .dsab-amount{color:var(--dsw-alias-state-error-primary);font-weight:500}',
      '.dsab-pill[data-phase="no-key"],.dsab-pill[data-phase="unavailable"]{',
      'color:var(--dsw-alias-state-warn-primary)}',
      '.dsab-editor{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);',
      'z-index:1100;box-sizing:border-box;width:230px;padding:10px 12px;',
      'border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-overlay);',
      '--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);',
      'color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;',
      'display:flex;flex-direction:column;gap:8px;text-align:left}',
      '.dsab-editor-title{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dsab-editor-row{display:flex;align-items:center;gap:6px}',
      '.dsab-editor input{box-sizing:border-box;flex:1;min-width:0;padding:3px 6px;',
      'border-radius:var(--dsw-radius-sm);border:1px solid var(--dsw-alias-border-l2);',
      'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}',
      '.dsab-editor button{padding:2px 8px;border-radius:var(--dsw-radius-sm);',
      'border:1px solid var(--dsw-alias-border-l2);background:0 0;',
      'color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;white-space:nowrap}',
      '.dsab-editor button[data-primary="true"]{background:var(--dsw-alias-brand-primary);',
      'border-color:transparent;color:#fff}',
      '.dsab-editor-hint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
    ].join('')

    function localeTag(locale) {
      try {
        const snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : undefined
        const active = snapshot && snapshot.active
        if (typeof active === 'string') return active
        if (active && typeof active.id === 'string') return active.id
        if (snapshot && typeof snapshot.id === 'string') return snapshot.id
      } catch (_error) {}
      return (typeof navigator !== 'undefined' && navigator.language) || 'en'
    }

    function formatClock(timestamp, locale) {
      try {
        return new Intl.DateTimeFormat(localeTag(locale), {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).format(new Date(timestamp))
      } catch (_error) {
        return new Date(timestamp).toLocaleTimeString()
      }
    }

    /** Re-render the pill when the active locale or a registered dictionary changes. */
    function useLocaleTick(locale) {
      const [, setTick] = React.useState(0)
      React.useEffect(() => {
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => setTick((value) => value + 1))
      }, [locale])
    }

    /** The alert threshold is a local preference: null means the alert is off. */
    function readThreshold() {
      try {
        const raw = localStorage.getItem(THRESHOLD_KEY)
        if (raw === null) return THRESHOLD_DEFAULT
        if (raw === '') return null
        const value = Number(raw)
        return Number.isFinite(value) && value >= 0 ? value : THRESHOLD_DEFAULT
      } catch (_error) {
        return THRESHOLD_DEFAULT
      }
    }

    function writeThreshold(value) {
      try {
        if (value === null) localStorage.setItem(THRESHOLD_KEY, '')
        else localStorage.setItem(THRESHOLD_KEY, String(value))
      } catch (_error) {}
    }

    /** 14px wallet outline, matching the stroke weight of the shipped stat icons. */
    function WalletIcon() {
      return h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false' },
      h('path', {
        d: 'M3.2 5.6h8.9c.9 0 1.6.7 1.6 1.6v4.4c0 .9-.7 1.6-1.6 1.6H3.2c-.9 0-1.6-.7-1.6-1.6V4.6c0-.9.7-1.6 1.6-1.6h6.6',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
      h('circle', { cx: 11, cy: 9.4, r: 0.9, fill: 'currentColor' }))
    }

    /** Ambient API-balance stat with a local low-balance alert; refreshes itself. */
    function BalanceStat(props) {
      const { t, locale } = props
      useLocaleTick(locale)

      const [state, setState] = React.useState({ phase: 'loading', data: null, at: 0 })
      const [threshold, setThreshold] = React.useState(readThreshold)
      const [editing, setEditing] = React.useState(false)
      const [draft, setDraft] = React.useState('')
      const alive = React.useRef(true)
      const rootRef = React.useRef(null)
      const inputRef = React.useRef(null)

      React.useEffect(() => {
        alive.current = true
        return () => { alive.current = false }
      }, [])

      const read = React.useCallback(async () => {
        try {
          const response = await fetch('/api/balance', { cache: 'no-store' })
          let payload = null
          try { payload = await response.json() } catch (_error) {}
          if (!alive.current) return
          if (!response.ok) {
            const missingKey = payload && payload.error === 'DEEPSEEK_API_KEY not configured'
            setState((previous) => ({
              phase: missingKey ? 'no-key' : 'unavailable',
              data: previous.data,
              at: previous.at,
            }))
            return
          }
          const wallet = payload && Array.isArray(payload.balance_infos) ? payload.balance_infos[0] : undefined
          if (!wallet) {
            setState((previous) => ({ phase: 'unavailable', data: previous.data, at: previous.at }))
            return
          }
          setState({
            phase: 'ready',
            data: {
              currency: typeof wallet.currency === 'string' ? wallet.currency : '',
              total: wallet.total_balance === undefined ? '' : String(wallet.total_balance),
              granted: wallet.granted_balance === undefined ? '' : String(wallet.granted_balance),
              toppedUp: wallet.topped_up_balance === undefined ? '' : String(wallet.topped_up_balance),
            },
            at: Date.now(),
          })
        } catch (_error) {
          if (alive.current) {
            setState((previous) => ({ phase: 'unavailable', data: previous.data, at: previous.at }))
          }
        }
      }, [])

      React.useEffect(() => {
        read()
        const timer = setInterval(() => { if (!document.hidden) read() }, POLL_MS)
        const wake = () => { if (!document.hidden) read() }
        document.addEventListener('visibilitychange', wake)
        window.addEventListener('focus', wake)
        return () => {
          clearInterval(timer)
          document.removeEventListener('visibilitychange', wake)
          window.removeEventListener('focus', wake)
        }
      }, [read])

      // Reset the draft whenever the editor opens.
      React.useEffect(() => {
        if (!editing) return
        setDraft(threshold === null ? '' : String(threshold))
      }, [editing, threshold])

      React.useEffect(() => {
        if (!editing) return undefined
        const focusTimer = setTimeout(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }, 0)
        const onPointerDown = (event) => {
          const root = rootRef.current
          if (root && event.target instanceof Node && root.contains(event.target)) return
          setEditing(false)
        }
        document.addEventListener('mousedown', onPointerDown, true)
        return () => {
          clearTimeout(focusTimer)
          document.removeEventListener('mousedown', onPointerDown, true)
        }
      }, [editing])

      const save = () => {
        const trimmed = draft.trim()
        const next = trimmed === '' ? null : Number(trimmed)
        if (next !== null && !(Number.isFinite(next) && next >= 0)) return
        setThreshold(next)
        writeThreshold(next)
        setEditing(false)
      }

      const data = state.data
      const label = t('label')
      const total = data ? Number.parseFloat(data.total) : Number.NaN
      const low = data !== null && threshold !== null && Number.isFinite(total) && total <= threshold
      const amount = data
        ? (data.currency ? data.currency + ' ' : '') + data.total
        : (state.phase === 'loading' ? t('loading') : t('failed'))

      const lines = [t('hint')]
      if (data) {
        if (data.toppedUp) lines.push(t('toppedUp') + ' ' + (data.currency ? data.currency + ' ' : '') + data.toppedUp)
        if (data.granted) lines.push(t('granted') + ' ' + (data.currency ? data.currency + ' ' : '') + data.granted)
        if (low) lines.push(t('low') + ' ' + (data.currency ? data.currency + ' ' : '') + String(threshold))
        if (state.at > 0) lines.push(t('updated') + ' ' + formatClock(state.at, locale))
      }
      if (state.phase === 'no-key') lines.push(t('noKeyHint'))
      else if (state.phase === 'unavailable') lines.push(data ? t('failedHint') : t('unavailableHint'))
      lines.push(low ? t('lowHint') : t('thresholdHint'))
      const title = lines.join('\n')

      const pill = h('button', {
        type: 'button',
        className: 'dsab-pill',
        'data-phase': state.phase,
        'data-low': low ? 'true' : 'false',
        title,
        'aria-haspopup': 'dialog',
        'aria-expanded': editing,
        'aria-label': label + ' ' + amount,
        onClick: () => setEditing((value) => !value),
      },
      h(WalletIcon),
      h('span', { className: 'dsab-label' }, label + ' '),
      h('span', { className: 'dsab-amount' }, amount))

      const editor = editing
        ? h('div', { className: 'dsab-editor', role: 'dialog', 'aria-label': t('thresholdTitle') },
          h('div', { className: 'dsab-editor-title' }, t('thresholdTitle')),
          h('div', { className: 'dsab-editor-row' },
            h('input', {
              ref: inputRef,
              type: 'number',
              min: '0',
              step: '1',
              inputMode: 'decimal',
              placeholder: t('thresholdPlaceholder'),
              value: draft,
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') { event.preventDefault(); save() }
                else if (event.key === 'Escape') { event.preventDefault(); setEditing(false) }
              },
            }),
            h('button', { type: 'button', 'data-primary': 'true', onClick: save }, t('save')),
            h('button', { type: 'button', onClick: () => setEditing(false) }, t('cancel'))),
          h('div', { className: 'dsab-editor-hint' }, t('thresholdHint')))
        : null

      return h('span', {
        ref: rootRef,
        className: 'dsab-anchor',
        'data-composer-stat': 'balance',
        'data-low': low ? 'true' : 'false',
      }, pill, editor)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // One plugin-owned stylesheet, removed with the plugin fiber.
        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = 'api-balance'
          tag.dataset.pluginCss = '@local/dsh-api-balance/styles'
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => { tag.remove() }
        }, 'api-balance: styles')

        ctx.effect(() => {
          const disposeZh = ctx.locale.register(NS, 'zh', zh)
          const disposeEn = ctx.locale.register(NS, 'en', en)
          return () => {
            disposeZh()
            disposeEn()
          }
        }, 'api-balance: dictionaries')

        const provide = {
          t: ctx.locale.bind(NS),
          locale: ctx.locale,
        }

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'api-balance',
          order: 2,
          inject: () => provide,
        }, BalanceStat))
      },
    }
  },
})
