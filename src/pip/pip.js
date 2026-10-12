import { getTimeString, getFocusText, timerDuration } from '../utils.js'
import { PLAY, PAUSE, FOCUS, LIGHTTHEME, modes } from '../constants.js'

const PIP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Poppins:wght@200;400;700;900&display=swap');
html, body {
  height: 100%;
}
body {
  font-family: "Poppins", sans-serif;
  font-size: 11px;
  margin: 0;
  padding: 8px;
  box-sizing: border-box;
  background: radial-gradient(130% 100% at 50% 0%, #2a2140 0%, #17151c 60%);
  color: #f0f0f5;
  --accent: #8b5cf6;
  --accent-2: #6d4bd0;
  --accent-soft: rgba(139, 92, 246, 0.25);
  transition: color .4s ease;
}
.light {
  background: radial-gradient(130% 100% at 50% 0%, #efe9ff 0%, #f4f2fb 60%);
  color: #241a33;
}
body.break {
  --accent: #4ade80;
  --accent-2: #22a85c;
  --accent-soft: rgba(74, 222, 128, 0.25);
}
.pip-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  z-index: 50;
}
.light .pip-progress {
  background: rgba(0, 0, 0, 0.06);
}
.pip-progress-fill {
  height: 100%;
  width: 0%;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(90deg, var(--accent-2), var(--accent));
  box-shadow: 0 0 10px var(--accent-soft);
  transition: width 1s linear, background .4s ease;
}
.pip-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
}
.time-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.timer-tag {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: calc(100% + 16px);
  max-width: 220px;
  margin: 0 -8px;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: background .2s ease;
}
.timer-tag:hover {
  background: rgba(255, 255, 255, 0.05);
}
.light .timer-tag:hover {
  background: rgba(0, 0, 0, 0.04);
}
.timer-tag:active {
  background: rgba(255, 255, 255, 0.09);
}
.light .timer-tag:active {
  background: rgba(0, 0, 0, 0.07);
}
.mode {
  margin: 0;
  font-size: .72em;
  font-weight: 600;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: var(--accent);
  pointer-events: none;
  transition: color .4s ease;
}
.phase {
  margin: 0;
  font-size: .72em;
  font-weight: 500;
  opacity: .6;
  pointer-events: none;
}
.timer {
  font-weight: 900;
  font-family: "Share Tech Mono", monospace;
  font-size: 34px;
  line-height: 1;
  letter-spacing: 1px;
  text-shadow: 0 2px 12px var(--accent-soft);
  transition: text-shadow .4s ease;
}
.timer.tick {
  animation: pipTick 1s ease-out;
}
@keyframes pipTick {
  0% {
    opacity: .85;
    text-shadow: 0 0 10px var(--accent-soft), 0 2px 12px var(--accent-soft);
  }
  100% {
    opacity: 1;
    text-shadow: 0 2px 12px var(--accent-soft);
  }
}
.focus-btn {
  min-width: 120px;
  padding: 7px 20px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  font-family: "Poppins", sans-serif;
  border: none;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 5px 14px var(--accent-soft);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, background .4s ease;
}
.focus-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 7px 20px var(--accent-soft);
}
.focus-btn:active {
  transform: translateY(0);
}
.focus-btns-int {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.focus-btns-int button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  opacity: .3;
  pointer-events: none;
  cursor: pointer;
  transition: .2s all;
}
.light .focus-btns-int button {
  border: 1px solid rgba(126, 87, 194, 0.2);
  background: rgba(126, 87, 194, 0.08);
}
.focus-btns-int button.active {
  opacity: 1;
  pointer-events: all;
}
.focus-btns-int button:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.focus-btns-int button img {
  display: block;
  width: 15px;
  height: 15px;
  filter: invert(1);
}
.light .focus-btns-int button img {
  filter: none;
}
`

let handle = null

export async function openPipTimer(ctx) {
  if (handle && handle.pipWindow && !handle.pipWindow.closed) {
    handle.pipWindow.focus()
    return handle
  }
  let pipWindow
  try {
    pipWindow = await window.documentPictureInPicture.requestWindow({ width: 240, height: 180 })
  } catch (e) {
    console.warn(e)
    return null
  }

  // Seed state is read AFTER requestWindow so the opener's click keeps user
  // activation (storage awaits before requestWindow break it in the popup).
  const { timer, settings } = await ctx.seed()
  const doc = pipWindow.document
  const isPomodoro = settings?.mode === modes.POMODORO

  const style = doc.createElement('style')
  style.textContent = PIP_CSS
  doc.head.appendChild(style)
  doc.body.className = settings?.theme === LIGHTTHEME ? 'light' : ''

  const progress = doc.createElement('div')
  progress.className = 'pip-progress'
  const progressFill = doc.createElement('div')
  progressFill.className = 'pip-progress-fill'
  progress.appendChild(progressFill)
  doc.body.appendChild(progress)

  const root = doc.createElement('div')
  root.className = 'pip-root'

  const timeContainer = doc.createElement('div')
  timeContainer.className = 'time-container'
  const orb = doc.createElement('div')
  orb.className = 'timer-tag'
  orb.title = 'Open full timer'
  const modeEl = doc.createElement('p')
  modeEl.className = 'mode'
  const timerEl = doc.createElement('div')
  timerEl.className = 'timer'
  const phaseEl = doc.createElement('p')
  phaseEl.className = 'phase'
  orb.appendChild(modeEl)
  orb.appendChild(timerEl)
  orb.appendChild(phaseEl)
  timeContainer.appendChild(orb)

  const primaryBtn = doc.createElement('button')
  primaryBtn.className = 'focus-btn'
  const primaryLabel = doc.createElement('span')
  primaryBtn.appendChild(primaryLabel)

  const controls = doc.createElement('div')
  controls.className = 'focus-btns-int'
  const stopBtn = doc.createElement('button')
  stopBtn.className = 'focus-btn-stop'
  const stopImg = doc.createElement('img')
  stopImg.src = chrome.runtime.getURL('icons/stop.png')
  stopBtn.appendChild(stopImg)
  const nextBtn = doc.createElement('button')
  nextBtn.className = 'focus-btn-next'
  const nextImg = doc.createElement('img')
  nextImg.src = chrome.runtime.getURL('icons/next.png')
  nextBtn.appendChild(nextImg)
  const doneBtn = doc.createElement('button')
  doneBtn.className = 'focus-btn-done'
  const doneImg = doc.createElement('img')
  doneImg.src = chrome.runtime.getURL('icons/done.png')
  doneBtn.appendChild(doneImg)
  controls.appendChild(stopBtn)
  controls.appendChild(nextBtn)
  controls.appendChild(doneBtn)

  root.appendChild(timeContainer)
  root.appendChild(primaryBtn)
  root.appendChild(controls)
  doc.body.appendChild(root)

  const setText = (el, text) => {
    if (el && el.textContent !== String(text)) el.textContent = text
  }

  const updateTick = (str, fraction) => {
    if (timerEl.textContent !== String(str)) {
      timerEl.textContent = str
      timerEl.classList.remove('tick')
      // reflow so the animation restarts on every change
      void timerEl.offsetWidth
      timerEl.classList.add('tick')
    }
    if (typeof fraction === 'number' && !Number.isNaN(fraction)) {
      progress.style.display = ''
      progressFill.style.width = Math.max(0, Math.min(100, fraction * 100)) + '%'
    } else {
      progress.style.display = 'none'
    }
  }

  const applyPhase = (isFocus) => {
    doc.body.classList.toggle('break', !isFocus)
  }

  const setActive = (bool) => {
    if (bool) {
      stopBtn.classList.add('active')
      nextBtn.classList.add('active')
      if (isPomodoro) doneBtn.classList.add('active')
    } else {
      stopBtn.classList.remove('active')
      nextBtn.classList.remove('active')
      doneBtn.classList.remove('active')
    }
  }

  const applyMode = (pomodoro) => {
    nextImg.src = chrome.runtime.getURL(pomodoro ? 'icons/next.png' : 'icons/end.png')
    setText(modeEl, pomodoro ? 'Pomodoro Mode' : 'Stopwatch Mode')
    if (pomodoro) {
      doneBtn.style.display = ''
    } else {
      doneBtn.style.display = 'none'
      doneBtn.classList.remove('active')
    }
  }

  const applyTheme = (isLight) => {
    doc.body.classList.toggle('light', isLight)
  }

  applyPhase(!timer || timer.type === FOCUS)
  if (timer && (timer.status === PLAY || timer.status === PAUSE)) {
    const total = timerDuration(timer.type, settings) * 60
    const fraction = isPomodoro && total > 0 ? (total - timer.time) / total : null
    updateTick(getTimeString(timer.time, false), fraction)
    setText(primaryLabel, getFocusText(timer, settings))
    setText(phaseEl, timer.type)
    setActive(true)
  } else {
    updateTick(
      isPomodoro ? getTimeString(timerDuration(timer?.type, settings) * 60, false) : getTimeString(0, false),
      isPomodoro ? 0 : null
    )
    setText(primaryLabel, timer ? getFocusText(timer, settings) : 'Start Focusing')
    setActive(false)
  }
  applyMode(isPomodoro)

  orb.addEventListener('click', async () => {
    if (ctx.onExpand) await ctx.onExpand()
  })
  primaryBtn.addEventListener('click', async () => {
    await ctx.onPrimary()
  })
  stopBtn.addEventListener('click', async () => {
    await ctx.onStop()
  })
  nextBtn.addEventListener('click', async () => {
    await ctx.onNext()
  })
  doneBtn.addEventListener('click', async () => {
    await ctx.onFinish()
  })

  pipWindow.addEventListener('pagehide', () => {
    handle = null
    if (ctx.onClose) ctx.onClose()
  })

  handle = {
    pipWindow,
    updateTick,
    setPrimaryLabel: (str) => setText(primaryLabel, str),
    setPhase: (str) => setText(phaseEl, str),
    setActive,
    applyMode,
    applyPhase,
    applyTheme,
    close: () => pipWindow.close(),
  }
  return handle
}
