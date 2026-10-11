import {
  createNotification,
  createState,
  getSessionStorage,
  getSyncStorage,
  initBackgroundJs,
  printer,
  setTimerInStore,
  setSyncStorage,
  storageChangesLogger,
  getTimeString,
  setLocalStorage,
  getLocalStorage,
  getCurrentTimeString,
  checkUserActivity,
  getValidTask,
  setSessionStorage,
  getOrCreateAnonymousId,
  setBlockRules,
  unSetBlockRules,
  addInboxItem,
  getInbox,
  wakeDueInboxSnoozes,
} from './utils.js'
import {
  PLAY,
  PAUSE,
  FOCUS,
  SHORTBREAK,
  LONGBREAK,
  TIMERKEY,
  SETTINGSKEY,
  TASKS,
  DEVELOPING,
  DEV_TIMER_SECONDS,
  DEV_SESSION_DURATION_MINS,
  BREAK,
  TASKSALIASKEY,
  TASKS_ALIAS,
  CURRENTTASKKEY,
  modes,
} from './constants.js'
import { CONFIG } from './config.js'

import posthog from 'posthog-js'

let sessionActive = false
let sessionTimeout = null

let musicPlayTimer = null

const initPostHog = getOrCreateAnonymousId().then((anonymousId) => {
  posthog.init(CONFIG.POSTHOG_API_KEY, {
    api_host: 'https://us.i.posthog.com',
  })
  posthog.identify(anonymousId)
  return posthog
})

let intervalId = createState(0)
let blockingSites = createState(false)
const print = printer()

const sendRuntimeMessage = async (message) => {
  try {
    await chrome.runtime.sendMessage(message)
  } catch (e) {
    console.warn(e)
  }
}

const trackEvent = (event, properties = null) => {
  initPostHog.then((ph) => {
    if (properties) ph.capture(event, properties)
    else ph.capture(event)
  })
}

const clearBlockingState = async () => {
  if (!blockingSites.getState()) return
  await unSetBlockRules()
  blockingSites.setState(false)
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.tabs.create({ url: 'src/userGuide/userGuide.html', active: true })
    await setLocalStorage({ [TASKSALIASKEY]: TASKS_ALIAS })
    trackEvent('extension_installed')
  } else if (details.reason === 'update') {
    const thisVersion = chrome.runtime.getManifest().version
    const prevVersion = details.previousVersion

    // ✅ Only run update logic if the version actually changed
    if (prevVersion && prevVersion !== thisVersion) {
      // Initialize TASKSALIAS if empty
      const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
      const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}

      if (Object.keys(tasksAlias).length === 0) {
        await setLocalStorage({ [TASKSALIASKEY]: TASKS_ALIAS })
      }

      // Fire the update event to PostHog with both versions for clarity
      trackEvent('extension_updated', {
        previousVersion: prevVersion,
        currentVersion: thisVersion,
      })
    }
  }
  await initBackgroundJs()
  storageChangesLogger()
  const alarms = await chrome.alarms.getAll()
  if (!alarms.some((alarm) => alarm.name === 'checkActivity')) {
    chrome.alarms.create('checkActivity', { periodInMinutes: 180 })
  }
  await wakeDueInboxSnoozes()
  await scheduleNextSnoozeWake()
  chrome.runtime.setUninstallURL(CONFIG.UNINSTALL_SURVEY_URL)
})

chrome.runtime.onStartup.addListener(async () => {
  const sessionTimerObj = await getSessionStorage(TIMERKEY)
  if (!sessionTimerObj[TIMERKEY]) {
    const localTimerObj = await getLocalStorage(TIMERKEY)
    if (localTimerObj[TIMERKEY]) {
      await setSessionStorage(localTimerObj)
    }
  }
  await wakeDueInboxSnoozes()
  await unSetBlockRules()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkActivity') {
    await checkUserActivity()
  } else if (alarm.name === 'wakeSnoozes') {
    await scheduleNextSnoozeWake()
  }
})

// Schedule a single one-shot alarm for the earliest pending snooze, instead of
// polling. The SW only wakes when something is actually due (cheap for MV3).
// Always clears the alarm first, so an item removed/unsnoozed/deleted leaves no
// stale alarm; and wakes anything already overdue before (re)scheduling.
async function scheduleNextSnoozeWake() {
  await chrome.alarms.clear('wakeSnoozes')
  await wakeDueInboxSnoozes()
  const items = await getInbox()
  const pending = items
    .filter((it) => it.status === 'postponed' && typeof it.snoozeUntil === 'number' && it.snoozeUntil > Date.now())
    .map((it) => it.snoozeUntil)
  if (pending.length === 0) return
  const next = Math.min(...pending)
  // chrome.alarms minimum granularity is ~1 min; clamp to the near future
  chrome.alarms.create('wakeSnoozes', { when: Math.max(Date.now() + 1000, next) })
}

// Self-contained prompt injected into the active tab's page context. The service
// worker cannot render DOM itself, so we inject a branded overlay (textarea +
// a "include this page as context" toggle checked by default, showing the page
// it will attach) and resolve with what the user entered. Must not reference any
// background-script variables; styles are inlined and reset so host page CSS
// can't bleed in.
function injectedCapturePrompt() {
  return new Promise((resolve) => {
    const reset = 'all:revert;box-sizing:border-box;font-family:"Poppins",system-ui,sans-serif;'
    const pageTitle = (document.title || '').trim()
    let pageHost = ''
    try {
      pageHost = location.host
    } catch (e) {
      pageHost = ''
    }
    const pageLabel = pageTitle || pageHost || 'this page'

    const overlay = document.createElement('div')
    overlay.setAttribute('data-brain-dump-overlay', '')
    overlay.style.cssText =
      reset +
      'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(10,6,18,0.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);'

    const box = document.createElement('div')
    box.style.cssText =
      reset +
      'width:360px;max-width:92vw;padding:22px;border-radius:16px;color:#f3eeff;' +
      'background:linear-gradient(160deg,#2b2140,#1c1530);border:1px solid rgba(190,150,255,0.25);' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.55),0 0 0 1px rgba(0,0,0,0.3);' +
      'opacity:0;transform:translateY(8px) scale(0.98);transition:0.18s ease;'

    const header = document.createElement('div')
    header.style.cssText = reset + 'display:flex;align-items:center;gap:10px;margin-bottom:4px;'
    const dot = document.createElement('span')
    dot.style.cssText =
      reset +
      'width:26px;height:26px;border-radius:8px;flex:none;display:inline-block;' +
      'background:linear-gradient(135deg,#c966f8,#8a4fd0);box-shadow:0 0 12px rgba(201,102,248,0.6);'
    const title = document.createElement('div')
    title.textContent = 'Brain Dump'
    title.style.cssText = reset + 'font-size:17px;font-weight:700;letter-spacing:0.3px;color:#f3eeff;'
    header.appendChild(dot)
    header.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.textContent = 'Capture now, decide later - this is just a thought, not a task.'
    subtitle.style.cssText = reset + 'font-size:12px;line-height:1.5;color:#b9a8d8;margin-bottom:14px;'

    const input = document.createElement('textarea')
    input.rows = 3
    input.placeholder = 'What popped into your head?'
    input.style.cssText =
      reset +
      'width:100%;resize:none;padding:11px 12px;border-radius:10px;font-size:14px;line-height:1.4;' +
      'color:#f3eeff;background:rgba(255,255,255,0.06);border:1px solid rgba(190,150,255,0.3);' +
      'outline:none;margin-bottom:14px;'
    input.addEventListener('focus', () => {
      input.style.borderColor = 'rgba(201,102,248,0.8)'
      input.style.boxShadow = '0 0 0 3px rgba(201,102,248,0.2)'
    })
    input.addEventListener('blur', () => {
      input.style.borderColor = 'rgba(190,150,255,0.3)'
      input.style.boxShadow = 'none'
    })

    // Context toggle - shows the page it will attach, removable before saving.
    const ctx = document.createElement('button')
    ctx.type = 'button'
    let includeContext = true
    const renderCtx = () => {
      ctx.style.cssText =
        reset +
        'width:100%;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;' +
        'padding:10px 12px;border-radius:10px;margin-bottom:16px;transition:0.15s ease;' +
        (includeContext
          ? 'background:rgba(201,102,248,0.12);border:1px solid rgba(201,102,248,0.5);'
          : 'background:rgba(255,255,255,0.04);border:1px solid rgba(190,150,255,0.18);')
      ctx.innerHTML = ''
      const check = document.createElement('span')
      check.style.cssText =
        reset +
        'width:18px;height:18px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;' +
        'font-size:12px;font-weight:700;color:#1c1530;' +
        (includeContext
          ? 'background:linear-gradient(135deg,#c966f8,#8a4fd0);'
          : 'background:transparent;border:1px solid rgba(190,150,255,0.4);')
      check.textContent = includeContext ? '✓' : ''
      const textWrap = document.createElement('span')
      textWrap.style.cssText = reset + 'display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;'
      const line1 = document.createElement('span')
      line1.textContent = includeContext ? 'Attaching this page' : 'Page context off'
      line1.style.cssText = reset + 'font-size:12px;font-weight:600;color:#f3eeff;'
      const line2 = document.createElement('span')
      line2.textContent = includeContext ? pageLabel : 'Tap to attach the current page'
      line2.style.cssText =
        reset +
        'font-size:11px;color:#b9a8d8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;'
      textWrap.appendChild(line1)
      textWrap.appendChild(line2)
      ctx.appendChild(check)
      ctx.appendChild(textWrap)
    }
    ctx.addEventListener('click', () => {
      includeContext = !includeContext
      renderCtx()
    })
    renderCtx()

    // Priority selector - three chips, default Normal.
    let priority = 'normal'
    const prioColors = { high: '#d14343', normal: '#8577a8', low: '#4a7fb0' }
    const prioRow = document.createElement('div')
    prioRow.style.cssText = reset + 'display:flex;align-items:center;gap:8px;margin-bottom:16px;'
    const prioLabel = document.createElement('span')
    prioLabel.textContent = 'Priority'
    prioLabel.title = 'Alt+1 High · Alt+2 Normal · Alt+3 Low'
    prioLabel.style.cssText = reset + 'font-size:12px;color:#b9a8d8;margin-right:2px;'
    prioRow.appendChild(prioLabel)
    const prioChips = {}
    const renderPrio = () => {
      ;['high', 'normal', 'low'].forEach((p) => {
        const sel = p === priority
        prioChips[p].style.cssText =
          reset +
          'cursor:pointer;padding:4px 12px;border-radius:16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;transition:0.15s ease;' +
          (sel
            ? `background:${prioColors[p]};color:#fff;box-shadow:0 0 10px ${prioColors[p]};`
            : 'background:rgba(255,255,255,0.06);color:#b9a8d8;border:1px solid rgba(190,150,255,0.25);')
      })
    }
    const prioKey = { high: '1', normal: '2', low: '3' }
    ;['high', 'normal', 'low'].forEach((p) => {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.innerHTML = `${p}<span style="opacity:.65;margin-left:5px;font-size:9px;">⌥${prioKey[p]}</span>`
      chip.title = `Alt+${prioKey[p]}`
      chip.addEventListener('click', () => {
        priority = p
        renderPrio()
      })
      prioChips[p] = chip
      prioRow.appendChild(chip)
    })
    renderPrio()

    const footer = document.createElement('div')
    footer.style.cssText = reset + 'display:flex;align-items:center;justify-content:space-between;gap:10px;'
    const hint = document.createElement('span')
    hint.innerHTML =
      '<b style="color:#b9a8d8;font-weight:600;">Enter</b> save · <b style="color:#b9a8d8;font-weight:600;">Esc</b> cancel'
    hint.style.cssText = reset + 'font-size:11px;color:#8f7fb0;'
    const btnRow = document.createElement('div')
    btnRow.style.cssText = reset + 'display:flex;gap:8px;'
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.cssText =
      reset +
      'padding:8px 16px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;color:#d9ccf5;' +
      'background:rgba(255,255,255,0.06);border:1px solid rgba(190,150,255,0.25);'
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.textContent = 'Save'
    saveBtn.style.cssText =
      reset +
      'padding:8px 18px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;color:#fff;border:none;' +
      'background:linear-gradient(135deg,#c966f8,#8a4fd0);box-shadow:0 4px 14px rgba(138,79,208,0.5);'
    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(saveBtn)
    footer.appendChild(hint)
    footer.appendChild(btnRow)

    box.appendChild(header)
    box.appendChild(subtitle)
    box.appendChild(input)
    box.appendChild(ctx)
    box.appendChild(prioRow)
    box.appendChild(footer)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    requestAnimationFrame(() => {
      box.style.opacity = '1'
      box.style.transform = 'translateY(0) scale(1)'
    })
    input.focus()

    const cleanup = (result) => {
      overlay.remove()
      resolve(result)
    }
    const save = () => cleanup({ text: input.value, includeContext, priority })
    saveBtn.addEventListener('click', save)
    cancelBtn.addEventListener('click', () => cleanup(null))
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) cleanup(null)
    })
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cleanup(null)
      } else if (e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        priority = e.key === '1' ? 'high' : e.key === '2' ? 'normal' : 'low'
        renderPrio()
      }
    }
    input.addEventListener('keydown', onKey)
    overlay.addEventListener('keydown', onKey)
  })
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture_brain_dump') return
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) return
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedCapturePrompt,
    })
    const result = injection?.result
    if (!result) return
    const text = result.text?.trim()
    if (!text) return
    const url = result.includeContext ? (tab.url ?? null) : null
    const title = result.includeContext ? (tab.title ?? null) : null
    await addInboxItem({ text, url, title, priority: result.priority })
    trackEvent('brain_dump_added', { item: text, source: 'shortcut' })
    await chrome.notifications.create(`brain-dump-${Date.now()}`, {
      iconUrl: '/cat.png',
      message: 'Captured. Decide on it later.',
      title: 'Added to Brain Dump',
      type: 'basic',
      silent: true,
    })
  } catch (e) {
    // Injection is blocked on restricted pages (chrome://, Web Store, other
    // extension pages). Fall back to our own over page, which we fully control.
    // Reuse an already-open extension tab if there is one, else open a new tab.
    console.warn(e)
    const captureUrl = 'src/newTab/over.html?capture=brain-dump'
    const fullCaptureUrl = chrome.runtime.getURL(captureUrl)
    const base = chrome.runtime.getURL('')
    const extTabs = await chrome.tabs.query({ url: `${base}*` })
    const target = extTabs.find((t) => t.url?.includes('src/newTab/over.html')) || extTabs[0]
    if (target?.id) {
      await chrome.tabs.update(target.id, { url: fullCaptureUrl, active: true })
      if (target.windowId !== undefined) {
        await chrome.windows.update(target.windowId, { focused: true })
      }
    } else {
      await chrome.tabs.create({ url: captureUrl, active: true })
    }
  }
})

async function startActualTimer(timer) {
  print.log('message received - start timer')
  const timerObj = {
    [TIMERKEY]: {
      time: timer?.time ?? 0,
      status: PLAY,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: timer?.startTime ?? getCurrentTimeString(),
      endTime: null,
      task: getValidTask(timer?.task),
    },
  }
  await setTimerInStore(timerObj)
  await startTimer(chrome, timer?.time ?? 0)
  await sendRuntimeMessage({ timerStarted: true })
}

async function pauseActualTimer(timer) {
  print.log('message received - pause timer')
  print.log(intervalId.getState())
  clearInterval(intervalId.getState())
  const timerObj = {
    [TIMERKEY]: {
      time: timer?.time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: timer?.startTime ?? getCurrentTimeString(),
      endTime: null,
      task: getValidTask(timer?.task),
    },
  }
  await setTimerInStore(timerObj)
  await clearBlockingState()
  print.it('session -> paused')
}

async function stopActualTimer() {
  print.log('message received - stop timer')
  clearInterval(intervalId.getState())
  await setTimerInStore({ [TIMERKEY]: null })
  await clearBlockingState()
}

async function resetCurrentTimer() {
  clearInterval(intervalId.getState())
  const timerObj = await getSessionStorage(TIMERKEY)
  const timer = timerObj[TIMERKEY]
  if (!timer || (timer?.counts === 0 && timer?.type === FOCUS)) {
    await setTimerInStore({ [TIMERKEY]: null })
    return
  }
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const settings = settingsObj[SETTINGSKEY]
  let time
  if (!timer || timer?.type === FOCUS) {
    time = settings?.focus?.time * 60
  } else if (timer?.type === SHORTBREAK) {
    time = settings?.shortBreak?.time * 60
  } else if (timer?.type === LONGBREAK) {
    time = settings?.longBreak?.time * 60
  }
  const newTimerObj = {
    [TIMERKEY]: {
      time: time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: null,
      endTime: null,
      task: getValidTask(timer?.task),
    },
  }
  await setTimerInStore(newTimerObj)
  await clearBlockingState()
}

async function syncBlockRulesFromSettings() {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const settings = settingsObj?.[SETTINGSKEY]
  const timerObj = await getSessionStorage(TIMERKEY)
  const timer = timerObj?.[TIMERKEY]

  const shouldBlockNow = settings?.blockSites && timer?.type === FOCUS && timer?.status === PLAY

  if (shouldBlockNow) {
    await setBlockRules()
    blockingSites.setState(true)
  } else {
    await clearBlockingState()
  }
}

const actionHandlers = {
  startTimer: async (request) => {
    await startActualTimer(request?.timer)
    trackEvent('timer_started')
  },
  pauseTimer: async (request) => {
    await pauseActualTimer(request?.timer)
    await sendRuntimeMessage({ timerPaused: true })
  },
  stopTimer: async () => {
    await stopActualTimer()
    await sendRuntimeMessage({ timerStopped: true })
    trackEvent('timer_stopped')
  },
  resetCurrentTimer: async () => {
    await resetCurrentTimer()
    await sendRuntimeMessage({ timerReset: true })
  },
  nextTimer: async () => {
    await setNextTimer()
  },
  stopwatchNextTimer: async () => {
    await setNextTimer(false, true)
  },
  finishTimer: async () => {
    await setNextTimer(true, true, true)
  },
  syncBlockRules: async () => {
    await syncBlockRulesFromSettings()
  },
}

const analyticsHandlers = {
  START_SESSION: () => {
    startSession()
  },
  DAILY_JOURNAL_ADDED: (request) => {
    trackEvent('daily_journal_added', {
      item: request.response.trim(),
    })
  },
  BRAIN_DUMP_ADDED: (request) => {
    trackEvent('brain_dump_added', {
      item: request.response.trim(),
      source: request.source,
    })
  },
  BRAIN_DUMP_CHANGED: () => {
    scheduleNextSnoozeWake()
  },
  MUSIC_PLAYING: (request) => {
    if (musicPlayTimer) {
      clearTimeout(musicPlayTimer)
    }
    musicPlayTimer = setTimeout(() => {
      trackEvent('playing_music', {
        music_track: request.track,
      })
      musicPlayTimer = null
    }, 30 * 1000)
  },
  EXPORT_DATA: () => {
    trackEvent('data_exported')
  },
  IMPORT_DATA: () => {
    trackEvent('data_imported')
  },
  DELETE_ALL_DATA: () => {
    trackEvent('all_data_deleted')
  },
  PAGE_VIEW: (request) => {
    trackEvent('$pageview', {
      $current_url: request?.properties?.currentUrl,
      $pathname: request?.properties?.pathName,
      $screen_width: request?.properties?.screenWidth,
      $screen_height: request?.properties?.screenHeight,
      extension_version: chrome.runtime.getManifest().version,
    })
  },
  SITE_BLOCKED: (request) => {
    trackEvent('site_blocked', {
      site: request?.properties?.site,
      host: request?.properties?.host,
      site_count: request?.properties?.site_count,
    })
  },
  SETTINGS_SAVED: (request) => {
    trackEvent('settings_saved', {
      focusTime: request?.properties.focusTime,
      focusNotificationTone: request?.properties.focusNotificationTone,
      focusAutoStart: request?.properties.focusAutoStart,
      shortBreakTime: request?.properties.shortBreakTime,
      shortBreakNotificationTone: request?.properties.shortBreakNotificationTone,
      shortBreakAutoStart: request?.properties.shortBreakAutoStart,
      longBreakTime: request?.properties.longBreakTime,
      longBreakNotificationTone: request?.properties.longBreakNotificationTone,
      longBreakAutoStart: request?.properties.longBreakAutoStart,
      isMusicPlayerActive: request?.properties.isMusicPlayerActive,
      theme: request?.properties.theme,
      openNewTab: request?.properties.openNewTab,
      showDailyJournal: request?.properties.showDailyJournal,
      enableSiteBlocking: request?.properties.enableSiteBlocking,
      timerMode: request?.properties.timerMode,
    })
  },
}

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  for (const action of Object.keys(actionHandlers)) {
    if (request[action]) {
      await actionHandlers[action](request)
      break
    }
  }

  if (request.saveSettings) {
    await setSyncStorage(request.newSettings)
    await sendRuntimeMessage({ settingsSaved: true, reload: request.reload })
  }

  if (request.type && analyticsHandlers[request.type]) {
    analyticsHandlers[request.type](request)
  }
})

const startTimer = async (chrome, timer) => {
  if (DEVELOPING) timer = DEV_TIMER_SECONDS
  print.log('start timer started 🌠')
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const settings = settingsObj[SETTINGSKEY]
  const isPomodoro = settings.mode === modes.POMODORO
  const incrementFactor = isPomodoro ? -1 : 1
  let intId = setInterval(async function () {
    timer += incrementFactor
    if (isPomodoro && timer < 0) {
      await finishCurrentTimer(isPomodoro, settings)
      await setNextTimer(true)
    } else {
      print.log('⏲ -> ' + timer + ' ' + getTimeString(timer))
      const result = await getSessionStorage(TIMERKEY)
      chrome.action.setBadgeText({ text: getTimeString(timer) })
      if (result?.timer?.type === FOCUS) {
        chrome.action.setBadgeBackgroundColor({ color: '#e19be7' })
      } else {
        chrome.action.setBadgeBackgroundColor({ color: '#9CCC65' })
      }
      try {
        await chrome.runtime.sendMessage({ time: getTimeString(timer, false) })
      } catch (e) {
        console.warn(e)
      }
      const timerToStore = {
        [TIMERKEY]: {
          time: timer,
          status: result?.timer?.status,
          type: result?.timer?.type,
          counts: result?.timer?.counts,
          startTime: result?.timer?.startTime,
          endTime: null,
          task: getValidTask(result?.timer?.task),
        },
      }
      await setTimerInStore(timerToStore, timer)
      if (timer % (5 * 60) === 0 && timer !== 0) {
        startSession()
      }
      if (result?.timer?.type === FOCUS && !blockingSites.getState() && settings.blockSites) {
        blockingSites.setState(true)
        await setBlockRules()
      }
    }
  }, 1000)
  print.helper('INTERVAL-ID -> ' + intId)
  intervalId.setState(intId)
}

async function finishCurrentTimer(isPomodoro = true, settings = {}, forceFinish = false) {
  print.log('start timer 🔚')
  clearInterval(intervalId.getState())
  chrome.action.setBadgeText({ text: getTimeString(0) })
  chrome.action.setBadgeBackgroundColor({ color: 'rgb(255, 202, 118)' })
  const currentDate = new Date()
  const oldHistoryObj = await getLocalStorage(currentDate.getFullYear().toString())
  const oldHistory = oldHistoryObj[currentDate.getFullYear().toString()]
  const timerObj = await getSessionStorage(TIMERKEY)
  const currentDateWithMonth = currentDate.getDate() + '-' + (currentDate.getMonth() + 1)
  const task = getValidTask(timerObj?.timer?.task, timerObj?.timer?.type)
  let startTime = timerObj?.timer?.startTime
  let endTime = getCurrentTimeString()
  const configuredDuration =
    timerObj?.timer?.type === SHORTBREAK
      ? settings?.shortBreak?.time
      : timerObj?.timer?.type === LONGBREAK
        ? settings?.longBreak?.time
        : settings?.focus?.time
  const elapsedSeconds = isPomodoro
    ? Math.max(0, (configuredDuration ?? 0) * 60 - (timerObj?.timer?.time ?? 0))
    : Math.max(0, timerObj?.timer?.time ?? 0)
  let duration = parseFloat((elapsedSeconds / 60).toFixed(2))
  // in dev mode, save as a realistic duration for testing history
  if (DEVELOPING && duration > 0) duration = DEV_SESSION_DURATION_MINS

  if (!duration && startTime && endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number)
    const [endHours, endMinutes] = endTime.split(':').map(Number)
    let startTotalMinutes = startHours * 60 + startMinutes
    let endTotalMinutes = endHours * 60 + endMinutes
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60 // Add 24 hours in minutes if end time is on the next day
    }
    duration = endTotalMinutes - startTotalMinutes < duration ? endTotalMinutes - startTotalMinutes : duration
  }
  let isValidSession = true
  const isUnderOneMinute = elapsedSeconds < 60
  if (isUnderOneMinute) {
    isValidSession = false
    await chrome.runtime.sendMessage({ invalidSession: true })
  }
  const shouldSaveSession = startTime && endTime && (DEVELOPING || elapsedSeconds >= 60)
  if (timerObj?.timer?.type === FOCUS) await setLocalStorage({ [CURRENTTASKKEY]: task })
  const sessionObj = {
    startTime: startTime,
    endTime: endTime,
    duration: duration,
    type: timerObj?.timer?.type === FOCUS ? FOCUS : BREAK,
    task: task,
    mode: isPomodoro ? modes.POMODORO : modes.STOPWATCH,
  }
  if (!oldHistory) {
    if (shouldSaveSession)
      await setLocalStorage({
        [currentDate.getFullYear().toString()]: {
          [currentDateWithMonth]: [sessionObj],
        },
      })
  } else if (oldHistory[currentDateWithMonth]) {
    let todaysPomodoros = oldHistory[currentDateWithMonth]
    todaysPomodoros.push(sessionObj)
    if (shouldSaveSession)
      await setLocalStorage({
        [currentDate.getFullYear().toString()]: {
          [currentDateWithMonth]: todaysPomodoros,
          ...oldHistory,
        },
      })
  } else if (shouldSaveSession) {
    await setLocalStorage({
      [currentDate.getFullYear().toString()]: {
        [currentDateWithMonth]: [sessionObj],
        ...oldHistory,
      },
    })
  }
  return isValidSession && shouldSaveSession
}

const setNextTimer = async (timerEnds = false, shouldSaveTimer = false, forceFinish = false) => {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const isPomodoro = settingsObj[SETTINGSKEY]?.mode === modes.POMODORO
  const status = await getSessionStorage(TIMERKEY)
  let nextTimer = FOCUS
  let prevTimer = FOCUS
  print.log('setting next timer --------->')
  if (!status?.timer) return
  const currentTaskObj = await getLocalStorage(CURRENTTASKKEY)
  const currentTask = currentTaskObj[CURRENTTASKKEY] || null
  print.helper('NEXT ID  => ' + intervalId.getState())
  clearInterval(intervalId.getState())
  chrome.action.setBadgeBackgroundColor({ color: 'rgb(255, 202, 118)' })
  let timerToStore = {}
  if (shouldSaveTimer) {
    await finishCurrentTimer(isPomodoro, settingsObj?.settings, forceFinish)
  }

  if (status?.timer?.type === FOCUS) {
    const interval = parseInt(settingsObj?.settings?.longBreak?.interval)
    if (!interval || (interval && status.timer.counts < interval)) {
      nextTimer = SHORTBREAK
      print.log('next is short break')
      const time = isPomodoro ? settingsObj.settings.shortBreak.time * 60 : 0
      chrome.action.setBadgeText({ text: getTimeString(time) })
      timerToStore = {
        [TIMERKEY]: {
          time: time,
          status: PAUSE,
          type: SHORTBREAK,
          counts: interval > 0 ? status.timer.counts : 0,
          task: TASKS.REST,
        },
      }
      await setTimerInStore(timerToStore)
      print.log('session -> focus -> short')
    } else if (interval && interval > 0) {
      nextTimer = LONGBREAK
      print.log('next is long break')
      const time = isPomodoro ? settingsObj.settings.longBreak.time * 60 : 0
      chrome.action.setBadgeText({ text: getTimeString(time) })
      timerToStore = {
        [TIMERKEY]: {
          time: time,
          status: PAUSE,
          type: LONGBREAK,
          counts: 0,
          task: TASKS.REST,
        },
      }
      await setTimerInStore(timerToStore)
      print.log('session -> focus -> long')
    }
    try {
      await chrome.runtime.sendMessage({ updateNextTimer: true })
    } catch (e) {
      console.warn(e)
    }
  } else if (status?.timer?.type === SHORTBREAK) {
    prevTimer = SHORTBREAK
    print.log('next is focus after short one')
    const time = isPomodoro ? settingsObj.settings.focus.time * 60 : 0
    chrome.action.setBadgeText({ text: getTimeString(time) })
    timerToStore = {
      [TIMERKEY]: {
        time: time,
        status: PAUSE,
        type: FOCUS,
        counts: status.timer.counts + 1,
        task: currentTask,
      },
    }
    await setTimerInStore(timerToStore)
    print.log('session -> short -> focus')
    try {
      await chrome.runtime.sendMessage({ updateNextTimer: true })
    } catch (e) {
      console.warn(e)
    }
  } else if (status?.timer?.type === LONGBREAK) {
    prevTimer = LONGBREAK
    print.log('next is focus after long one')
    const time = isPomodoro ? settingsObj.settings.focus.time * 60 : 0
    chrome.action.setBadgeText({ text: getTimeString(time) })
    timerToStore = {
      [TIMERKEY]: {
        time: time,
        status: PAUSE,
        type: FOCUS,
        counts: 0,
        task: currentTask,
      },
    }
    await setTimerInStore(timerToStore)
    print.log('session -> long -> focus')
    try {
      await chrome.runtime.sendMessage({ updateNextTimer: true })
    } catch (e) {
      console.warn(e)
    }
  }
  if (isPomodoro && timerEnds && !shouldSaveTimer) {
    await createNotification(prevTimer, nextTimer)
  }
  await clearBlockingState()
  const nextType = timerToStore?.[TIMERKEY]?.type
  if (
    settingsObj?.settings?.mode === modes.POMODORO &&
    ((nextType === FOCUS && settingsObj?.settings?.focus?.autoStart) ||
      (nextType === SHORTBREAK && settingsObj?.settings?.shortBreak?.autoStart) ||
      (nextType === LONGBREAK && settingsObj?.settings?.longBreak?.autoStart))
  ) {
    await startActualTimer(timerToStore[TIMERKEY])
  }
}

function startSession() {
  if (!sessionActive) {
    initPostHog.then((ph) => {
      ph.capture('session_started')
    })
    sessionActive = true
  }

  // Reset timeout: if user is inactive for 10 mins, end session
  clearTimeout(sessionTimeout)
  sessionTimeout = setTimeout(
    () => {
      initPostHog.then((ph) => {
        ph.capture('session_ended')
      })
      sessionActive = false
    },
    10 * 60 * 1000
  ) // 10 mins of inactivity
}
