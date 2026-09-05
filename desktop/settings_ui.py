"""트레이에서 여는 데스크톱 설정 창."""
from __future__ import annotations

import sys

import webview

from hotkey import combo_label, default_combo

_TITLE = "Flow Plan 설정"

_HTML = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Flow Plan 설정</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; height: 100%; font-family: -apple-system, system-ui, sans-serif; }
  body { background: #f8fafc; color: #0f172a; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    .card { background: #1e293b; border-color: #334155; }
    button.ghost { background: #334155; color: #e2e8f0; }
    .hint { color: #94a3b8; }
    .key { background: #334155; }
  }
  .wrap { padding: 22px 24px 20px; }
  h1 { font-size: 16px; margin: 0 0 6px; font-weight: 650; }
  .hint { font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 16px; }
  .card {
    border: 1px solid #e2e8f0; background: #fff; border-radius: 12px;
    padding: 16px; display: flex; flex-direction: column; gap: 12px;
  }
  label { font-size: 12px; font-weight: 600; color: #64748b; }
  .key {
    min-height: 44px; border-radius: 10px; background: #f1f5f9;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 650; letter-spacing: 0.04em;
  }
  .key.rec { outline: 2px solid #6366f1; }
  .row { display: flex; gap: 8px; }
  button {
    flex: 1; height: 36px; border: 0; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 600;
  }
  button.primary { background: #4f46e5; color: #fff; }
  button.ghost { background: #e2e8f0; color: #334155; }
  .msg { font-size: 12px; min-height: 18px; color: #64748b; }
  .ok { color: #059669; }
  .err { color: #dc2626; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>단축키</h1>
    <p class="hint">창이 숨겨져 있어도 이 키로 Flow Plan을 앞으로 가져옵니다. 아래를 누른 뒤 원하는 조합을 입력하세요.</p>
    <div class="card">
      <label>현재 단축키</label>
      <div id="key" class="key">—</div>
      <div class="row">
        <button type="button" class="primary" id="rec">단축키 입력</button>
        <button type="button" class="ghost" id="reset">기본값</button>
      </div>
      <div id="msg" class="msg"></div>
    </div>
  </div>
<script>
  let rec = false
  const keyEl = document.getElementById('key')
  const msg = document.getElementById('msg')

  function labelOf(s) { return s.label || s.combo || '—' }

  async function refresh() {
    const s = await window.pywebview.api.get_state()
    keyEl.textContent = labelOf(s)
  }

  function comboFrom(e) {
    const mods = []
    if (e.metaKey) mods.push('cmd')
    if (e.ctrlKey) mods.push('ctrl')
    if (e.altKey) mods.push('alt')
    if (e.shiftKey) mods.push('shift')
    let k = ''
    if (e.code.startsWith('Key')) k = e.code.slice(3).toLowerCase()
    else if (e.code.startsWith('Digit')) k = e.code.slice(5)
    else if (e.code === 'Space') k = 'space'
    if (!mods.length || !k) return ''
    return mods.concat(k).join('+')
  }

  document.getElementById('rec').onclick = () => {
    rec = true
    keyEl.classList.add('rec')
    keyEl.textContent = '키를 누르세요'
    msg.textContent = ''
    msg.className = 'msg'
  }

  document.getElementById('reset').onclick = async () => {
    rec = false
    keyEl.classList.remove('rec')
    const s = await window.pywebview.api.reset_hotkey()
    keyEl.textContent = labelOf(s)
    msg.textContent = '기본 단축키로 되돌렸습니다.'
    msg.className = 'msg ok'
  }

  window.addEventListener('keydown', async (e) => {
    if (!rec) return
    if (['Meta', 'Control', 'Alt', 'Shift', 'OS'].includes(e.key)) return
    e.preventDefault()
    const combo = comboFrom(e)
    rec = false
    keyEl.classList.remove('rec')
    if (!combo) {
      msg.textContent = '명령/컨트롤/옵션 + 글쇠를 함께 누르세요.'
      msg.className = 'msg err'
      await refresh()
      return
    }
    try {
      const s = await window.pywebview.api.set_hotkey(combo)
      keyEl.textContent = labelOf(s)
      msg.textContent = '저장했습니다. 바로 사용할 수 있습니다.'
      msg.className = 'msg ok'
    } catch (err) {
      msg.textContent = '이 조합은 사용할 수 없습니다.'
      msg.className = 'msg err'
      await refresh()
    }
  })

  window.addEventListener('pywebviewready', refresh)
  refresh()
</script>
</body>
</html>
"""


class SettingsApi:
    def __init__(self, bind, data_dir, on_change=None):
        self.bind = bind
        self.data_dir = data_dir
        self.on_change = on_change

    def get_state(self) -> dict:
        combo = self.bind.combo or default_combo()
        return {
            "combo": combo,
            "label": combo_label(combo),
            "default": default_combo(),
        }

    def set_hotkey(self, combo: str) -> dict:
        try:
            applied = self.bind.set_combo(combo, self.data_dir)
        except ValueError as exc:
            raise ValueError("유효하지 않은 단축키입니다.") from exc
        if self.on_change:
            self.on_change(combo_label(applied))
        return self.get_state()

    def reset_hotkey(self) -> dict:
        return self.set_hotkey(default_combo())


def open_settings(bind, data_dir, on_change=None) -> None:
    for w in webview.windows:
        if getattr(w, "title", "") == _TITLE:
            try:
                w.show()
                w.restore()
            except Exception:
                pass
            return
    webview.create_window(
        _TITLE,
        html=_HTML,
        width=420,
        height=340,
        js_api=SettingsApi(bind, data_dir, on_change),
        frameless=False,
        easy_drag=True,
        resizable=False,
        on_top=True,
    )
