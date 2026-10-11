import {
  clearHistory,
  exportData,
  formatDateWithOrdinal,
  formatTimeWithLabel,
  getLocalStorage,
  getSessionStorage,
  getSyncStorage,
  importData,
  setLocalStorage,
  setSampleHistory,
  setSessionStorage,
  getValidTask,
  updateOldHistoryDataToAccomodateLatestChanges,
  showCustomPrompt,
  getFocusOptionsForTasks,
  openSettingsInCurrentTab,
  openTimerInCurrentTab,
  openStreakInCurrentTab,
  showCustomAlert,
  getInbox,
  updateInboxItem,
  deleteInboxItem,
  restoreInboxItem,
  setInbox,
} from '../utils.js'
import {
  SETTINGSKEY,
  LIGHTTHEME,
  TASKS,
  chartColors,
  chartBorderColors,
  FOCUS,
  BREAK,
  DARKTHEME,
  TASKSALIASKEY,
  TIMERKEY,
  modes,
  DAILYJOURNALLISTKEY,
} from '../constants.js'
import { CONFIG } from '../config.js'

const container = document.querySelector('.container')
const todayCount = document.querySelector('.today-count')
const weekCount = document.querySelector('.week-count')
const monthCount = document.querySelector('.month-count')
const yearCount = document.querySelector('.year-count')
const weekBars = document.querySelectorAll('.week-bar')
const monthBarsContainer = document.querySelector('.month-bars-container')
const sampleHistoryBtn = document.querySelector('.sample-history-btn')
const sampleHistoryRemoveBtn = document.querySelector('.sample-history-btn-remove')
const deleteHistoryBtn = document.querySelector('.delete-btn')
const userGuideBtn = document.querySelector('.user-guide-btn')
const deleteSomeContainer = document.querySelector('.delete-some-container')
const deleteSomeHistoryBtn = document.querySelector('.delete-some-btn')
const addSessionBtn = document.querySelector('.add-session-btn')
const deleteDateInput = document.querySelector('#delete-date')
const exportDataBtn = document.querySelector('.export-btn')
const importDataBtn = document.querySelector('.import-btn')
const isSampleElement = document.querySelectorAll('.is-sample')
const noWeekDataElements = document.querySelectorAll('.week-no-data')
const noMonthDataElements = document.querySelectorAll('.month-no-data')
const calendarMonthContainers = document.querySelectorAll('.calendar-month-container')
const calendarMonthLabels = document.querySelectorAll('.calendar-month-label')
const calendarMonthBoxesContainers = document.querySelectorAll('.calendar-month-boxes-container')
const totalFocusCountEle = document.querySelector('.total-focus-count')
const dateInput = document.getElementById('date-range')
const resetButton = dateInput.parentElement.querySelector('button')
const loadingScreen = document.querySelector('.loading-screen')
const settingsBtn = document.querySelector('.settings-tab-btn')
const timerBtn = document.querySelector('.timer-tab-btn')
const streakBtn = document.querySelector('.streak-tab-btn')
const supportBtn = document.querySelector('.support-tab-btn')
const supportLink = document.querySelector('.support-link')

supportBtn.href = CONFIG.SUPPORT_URL
supportLink.href = CONFIG.SUPPORT_URL

const today = new Date()
const threeYearsAgo = new Date()

today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
dateInput.value = today.toISOString().split('T')[0]
threeYearsAgo.setFullYear(today.getFullYear() - 3)
dateInput.max = today.toISOString().split('T')[0]
dateInput.min = threeYearsAgo.toISOString().split('T')[0]

let sampleHistory
let sessions = []
let theme = DARKTHEME

const WEEK = 'week'
const MONTH = 'month'
const YEAR = 'year'

const maxHeightOfGraph = monthBarsContainer.clientHeight - 15
let maxValueOfGraph = 0

const sendRuntimeMessageSafely = async (message) => {
  try {
    await chrome.runtime.sendMessage(message)
  } catch (e) {
    console.warn(e)
  }
}

dateInput.addEventListener('change', async () => {
  const newValue = dateInput.value
  if (newValue !== today.toISOString().split('T')[0]) {
    if (resetButton) {
      resetButton.style.display = 'block'
    }
  } else if (resetButton) {
    resetButton.style.display = 'none'
  }
  await init()
})

resetButton.addEventListener('click', async () => {
  dateInput.value = today.toISOString().split('T')[0]
  resetButton.style.display = 'none'
  await init()
})

sampleHistoryBtn.addEventListener('click', async () => {
  dateInput.disabled = true
  await setSampleHistory()
  await init()
})
sampleHistoryRemoveBtn.addEventListener('click', async () => {
  dateInput.disabled = false
  const currentFullDate = new Date()
  const currentYear = currentFullDate.getFullYear().toString()
  await setSessionStorage({ [currentYear]: null })
  await init()
  setSimpleMetrics(0, todayCount)
})

deleteHistoryBtn.addEventListener('click', async () => {
  showCustomAlert('🗑️ Delete All History', 'Are you sure you wanna delete all of your history?', async (confirmed) => {
    if (confirmed) {
      await clearHistory()
      await init()
      await sendRuntimeMessageSafely({ type: 'DELETE_ALL_DATA' })
    }
  })
})
userGuideBtn.addEventListener('click', async () => {
  window.location.href = chrome.runtime.getURL('src/userGuide/userGuide.html')
})
deleteDateInput.addEventListener('change', async () => {
  await generateSessionsToDelete()
  if (sessions && sessions.length !== 0) {
    deleteSomeHistoryBtn.disabled = false
  } else deleteSomeHistoryBtn.disabled = true
})
addSessionBtn.addEventListener('click', async () => {
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}

  const focusTaskOptions = Object.values(TASKS)
    .filter((t) => t !== TASKS.REST)
    .map((t) => `<option value="${t}">${tasksAlias[t] || t}</option>`)
    .join('')
  const breakTaskOptions = `<option value="${TASKS.REST}">${tasksAlias[TASKS.REST] || TASKS.REST}</option>`

  const now = new Date()
  const defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const fields = [
    {
      id: 'type',
      label: 'Type',
      type: 'select',
      options: `<option value="Focus">Focus</option><option value="Break">Break</option>`,
      value: FOCUS,
      onChange: (e, fields, container) => {
        const taskEl = container.querySelector('#pf-task')
        if (!taskEl) return
        taskEl.innerHTML = e.target.value === BREAK ? breakTaskOptions : focusTaskOptions
      },
    },
    { id: 'task', label: 'Task', type: 'select', options: focusTaskOptions },
    { id: 'duration', label: 'Duration (mins)', type: 'number', value: '25', min: 1, max: 180 },
    { id: 'startTime', label: 'Start Time', type: 'time', value: defaultTime },
  ]

  showCustomPrompt(
    '➕ Add Session',
    `Adding session for: <b>${deleteDateInput.value || 'selected date'}</b>`,
    null,
    async (result) => {
      if (!result) return

      const type = result.type
      const task = getValidTask(result.task, type)
      const duration = parseInt(result.duration)
      const startTimeStr = result.startTime

      if (!duration || duration < 1 || duration > 180) return
      if (!startTimeStr) return

      const dateStr = deleteDateInput.value
      if (!dateStr || dateStr.split('-').length !== 3) return

      const year = dateStr.split('-')[0]
      const rawDay = dateStr.split('-')[2]
      const rawMonth = dateStr.split('-')[1]
      const day = rawDay[0] === '0' ? rawDay[1] : rawDay
      const month = rawMonth[0] === '0' ? rawMonth[1] : rawMonth
      const dateKey = `${day}-${month}`

      const [startH, startM] = startTimeStr.split(':').map(Number)
      const endTotalMins = startH * 60 + startM + duration
      const endH = Math.floor(endTotalMins / 60) % 24
      const endM = endTotalMins % 60
      const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

      const session = { startTime: startTimeStr, endTime: endTimeStr, duration, type, task, mode: modes.POMODORO }

      const histObj = await getLocalStorage(year)
      const history = histObj?.[year] ?? {}
      const existing = Array.isArray(history[dateKey]) ? history[dateKey] : []
      existing.push(session)
      history[dateKey] = existing
      await setLocalStorage({ [year]: history })
      location.reload()
    },
    'fields',
    '',
    null,
    fields
  )
})

deleteSomeHistoryBtn.addEventListener('click', async () => {
  if (!sessions?.length) return
  const checkboxes = container.querySelectorAll('.session-checkbox')
  const checkedSessions = new Set()

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const sessionId = checkbox.id
      checkedSessions.add(parseInt(sessionId))
    }
  })
  if (!checkedSessions.size) return
  showCustomAlert(
    '🗑️ Delete Sessions',
    'Are you sure you wanna delete selected sessions from your history?',
    async (confirmed) => {
      if (!confirmed) return
      const dateSelected = deleteDateInput.value
      if (dateSelected) {
        let currentYear = dateSelected.substring(0, 4)
        let currentDateStr =
          dateSelected.split('-')[2][0] === '0' ? dateSelected.split('-')[2][1] : dateSelected.split('-')[2]
        let currentMonthStr =
          dateSelected.split('-')[1][0] === '0' ? dateSelected.split('-')[1][1] : dateSelected.split('-')[1]
        const currentDateInHistory = currentDateStr + '-' + currentMonthStr
        const oldHistoryObj = await getLocalStorage(currentYear)
        const oldHistory = oldHistoryObj[currentYear]
        let todaysPomodoros = oldHistory[currentDateInHistory]?.filter((pom, index) => !checkedSessions.has(index))
        if (todaysPomodoros !== undefined) {
          oldHistory[currentDateInHistory] = [...todaysPomodoros]
          await setLocalStorage({ [currentYear]: { ...oldHistory } })
          await generateSessionsToDelete()
        }
      }
    }
  )
})
exportDataBtn.addEventListener('click', async () => {
  await exportData()
  await sendRuntimeMessageSafely({ type: 'EXPORT_DATA' })
})

importDataBtn.addEventListener('click', async () => {
  await importData(async () => {
    await sendRuntimeMessageSafely({ type: 'IMPORT_DATA' })
    location.reload()
  })
})

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  if (store.settings?.theme === LIGHTTHEME) {
    document.body.classList.add('light')
    theme = LIGHTTHEME
  } else {
    document.body.classList.remove('light')
    theme = DARKTHEME
  }

  chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.saveSettings) {
      location.reload()
      loadSettings(request.newSettings.settings)
    } else if (request.taskAliasUpdated) {
      location.reload()
    }
  })

  await init()
  await setupBrainDumpTabs()
  setTimeout(() => {
    loadingScreen.classList.add('fade-out')
    setTimeout(() => {
      loadingScreen.remove()
    }, 500)
  }, 200)
})

async function setupBrainDumpTabs() {
  const tabs = document.querySelectorAll('.history-page-tab')
  const panels = document.querySelectorAll('.history-tab-panel')
  const valid = Array.from(tabs).map((t) => t.dataset.tab)

  async function activateTab(target, updateUrl = true) {
    if (!valid.includes(target)) target = 'history'
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === target))
    panels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${target}-tab-panel`)
    })
    if (updateUrl) {
      const url = new URL(window.location.href)
      if (target === 'history') url.searchParams.delete('tab')
      else url.searchParams.set('tab', target)
      window.history.replaceState({}, '', url)
    }
    if (target === 'brain-dump') await renderBrainDump()
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab))
  })

  const searchInput = document.getElementById('brain-dump-search')
  searchInput.addEventListener('input', async () => {
    brainDumpSearch = searchInput.value
    await renderBrainDump()
  })

  document.getElementById('brain-dump-clear-done').addEventListener('click', clearDoneWithUndo)

  const changeBtn = document.getElementById('brain-dump-shortcut-change')
  changeBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
    } catch (e) {
      console.warn(e)
    }
  })

  await renderCaptureShortcut()

  const initialTab = new URL(window.location.href).searchParams.get('tab')
  if (initialTab) await activateTab(initialTab, false)
}

// Read the capture shortcut live from the browser (the user can rebind or clear
// it on chrome://extensions/shortcuts, so never hardcode it). The shortcut can
// be empty when unassigned - show a prompt to set one in that case.
async function renderCaptureShortcut() {
  const keyEle = document.getElementById('brain-dump-shortcut-key')
  const popoverKeyEle = document.getElementById('brain-dump-popover-key')
  const hintEle = document.getElementById('brain-dump-popover-hint')
  if (!keyEle) return
  let shortcut = ''
  try {
    const commands = await chrome.commands.getAll()
    shortcut = commands.find((c) => c.name === 'capture_brain_dump')?.shortcut || ''
  } catch (e) {
    console.warn(e)
  }
  if (shortcut) {
    keyEle.textContent = shortcut
    keyEle.classList.remove('unset')
    popoverKeyEle.textContent = shortcut
    popoverKeyEle.classList.remove('unset')
    hintEle.textContent =
      'Press it on any website - YouTube, docs, anywhere - to capture a thought without leaving the page or breaking focus.'
  } else {
    keyEle.textContent = 'Not set'
    keyEle.classList.add('unset')
    popoverKeyEle.textContent = 'Not set'
    popoverKeyEle.classList.add('unset')
    hintEle.textContent =
      'No shortcut yet. Set one to capture a thought on any website - YouTube, docs, anywhere - without leaving the page or breaking focus.'
  }
}

function shortenUrl(url) {
  try {
    return new URL(url).host
  } catch (e) {
    return url
  }
}

function timeAgo(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function setCount(selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value
  })
}

function formatSnoozeUntil(ts) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `today ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`
}

// Snooze picker - choose when the item should return to the Inbox.
function promptSnooze(item) {
  const options =
    '<option value="later-today">Later today (+3 hrs)</option>' +
    '<option value="tomorrow">Tomorrow morning</option>' +
    '<option value="next-week">Next week</option>' +
    '<option value="indefinite">Until I bring it back</option>'
  showCustomPrompt(
    'Snooze thought',
    'When should this come back to your Inbox?',
    'tomorrow',
    async (choice) => {
      if (choice === null) return
      const patch = { status: 'postponed', snoozeUntil: null }
      const now = new Date()
      if (choice === 'later-today') {
        patch.snoozeUntil = Date.now() + 3 * 60 * 60 * 1000
      } else if (choice === 'tomorrow') {
        const d = new Date(now)
        d.setDate(d.getDate() + 1)
        d.setHours(9, 0, 0, 0)
        patch.snoozeUntil = d.getTime()
      } else if (choice === 'next-week') {
        const d = new Date(now)
        d.setDate(d.getDate() + 7)
        d.setHours(9, 0, 0, 0)
        patch.snoozeUntil = d.getTime()
      }
      await updateInboxItem(item.id, patch)
      await renderBrainDump()
      notifyInboxChanged()
    },
    'select',
    '',
    options
  )
}

// Tell the background to recompute the snooze wake alarm after any change.
function notifyInboxChanged() {
  sendRuntimeMessageSafely({ type: 'BRAIN_DUMP_CHANGED' })
}

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }
function getPriority(item) {
  return PRIORITY_RANK[item.priority] !== undefined ? item.priority : 'normal'
}

let brainDumpSearch = ''

// Any snoozed item whose snoozeUntil has passed returns to the Inbox.
async function wakeDueSnoozes(items) {
  const now = Date.now()
  let changed = false
  items.forEach((item) => {
    if (item.status === 'postponed' && item.snoozeUntil && item.snoozeUntil <= now) {
      item.status = 'inbox'
      delete item.snoozeUntil
      changed = true
    }
  })
  if (changed) await setInbox(items)
  return changed
}

async function renderBrainDump() {
  const items = await getInbox()
  await wakeDueSnoozes(items)

  // FLIP: capture current positions of items before re-render
  const beforeRects = new Map()
  document.querySelectorAll('.brain-dump-item').forEach((el) => {
    beforeRects.set(el.dataset.id, el.getBoundingClientRect())
  })

  const empty = document.querySelector('.brain-dump-empty')
  const noResults = document.querySelector('.brain-dump-no-results')
  const inboxSection = document.querySelector('.brain-dump-inbox-section')
  const snoozedSection = document.querySelector('.brain-dump-snoozed-section')
  const doneSection = document.querySelector('.brain-dump-done-section')
  const summary = document.querySelector('.brain-dump-summary')
  const toolbar = document.querySelector('.brain-dump-toolbar')
  const inboxList = document.querySelector('.brain-dump-inbox-list')
  const snoozedList = document.querySelector('.brain-dump-snoozed-list')
  const doneList = document.querySelector('.brain-dump-done-list')

  const q = brainDumpSearch.trim().toLowerCase()
  const matches = (item) => !q || item.text.toLowerCase().includes(q) || (item.title || '').toLowerCase().includes(q)

  // Inbox: grouped by priority (High→Low), newest/most-recently-moved on top.
  const orderOf = (item) => item.order ?? item.createdAt ?? 0
  const inboxItems = items
    .filter((item) => item.status === 'inbox' && matches(item))
    .sort((a, b) => PRIORITY_RANK[getPriority(a)] - PRIORITY_RANK[getPriority(b)] || orderOf(b) - orderOf(a))
  const snoozedItems = items
    .filter((item) => item.status === 'postponed' && matches(item))
    .sort((a, b) => (a.snoozeUntil || a.createdAt) - (b.snoozeUntil || b.createdAt))
  const doneItems = items
    .filter((item) => item.status === 'done' && matches(item))
    .sort((a, b) => b.createdAt - a.createdAt)

  // counts reflect totals (ignore search) so the user keeps the full picture
  setCount('.brain-dump-count-inbox', items.filter((i) => i.status === 'inbox').length)
  setCount('.brain-dump-count-snoozed', items.filter((i) => i.status === 'postponed').length)
  setCount('.brain-dump-count-done', items.filter((i) => i.status === 'done').length)

  const hasAny = items.length > 0
  const hasVisible = inboxItems.length + snoozedItems.length + doneItems.length > 0
  empty.classList.toggle('active', !hasAny)
  summary.classList.toggle('active', hasAny)
  toolbar.classList.toggle('active', hasAny)
  noResults.classList.toggle('active', hasAny && !hasVisible)
  inboxSection.classList.toggle('active', inboxItems.length > 0)
  snoozedSection.classList.toggle('active', snoozedItems.length > 0)
  doneSection.classList.toggle('active', doneItems.length > 0)

  const clearDoneBtn = document.querySelector('.brain-dump-clear-done')
  if (clearDoneBtn) clearDoneBtn.classList.toggle('active', doneItems.length > 0)

  renderBrainDumpList(inboxList, inboxItems, 'inbox')
  renderBrainDumpList(snoozedList, snoozedItems, 'postponed')
  renderBrainDumpList(doneList, doneItems, 'done')

  playBrainDumpFlip(beforeRects)
}

// FLIP animation: move items from their previous positions to the new ones,
// and gently fade/scale in items that just appeared.
function playBrainDumpFlip(beforeRects) {
  document.querySelectorAll('.brain-dump-item').forEach((el) => {
    const before = beforeRects.get(el.dataset.id)
    const after = el.getBoundingClientRect()
    if (before) {
      const dx = before.left - after.left
      const dy = before.top - after.top
      if (dx || dy) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
          duration: 320,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        })
      }
    } else {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(-6px) scale(0.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      )
    }
  })
}

let undoTimer = null

// Floating top banner offering a 5s window to undo a destructive action.
function showUndoBanner(label, onUndo) {
  const banner = document.getElementById('brain-dump-undo')
  const bar = banner.querySelector('.brain-dump-undo-bar')
  const text = banner.querySelector('.brain-dump-undo-text')
  const undoBtn = document.getElementById('brain-dump-undo-btn')

  text.textContent = label
  if (undoTimer) clearTimeout(undoTimer)
  banner.classList.add('active')
  // restart the shrinking bar animation
  bar.style.animation = 'none'
  void bar.offsetWidth
  bar.style.animation = 'brain-dump-undo-countdown 5s linear forwards'
  bar.style.animationPlayState = 'running'

  let remaining = 5000
  let startedAt = Date.now()
  const close = () => {
    banner.classList.remove('active')
    banner.onmouseenter = null
    banner.onmouseleave = null
    undoBtn.onclick = null
    if (undoTimer) clearTimeout(undoTimer)
    undoTimer = null
  }
  undoBtn.onclick = async () => {
    close()
    await onUndo()
    await renderBrainDump()
  }
  // Hovering pauses the countdown so the user has time to decide.
  banner.onmouseenter = () => {
    if (undoTimer) clearTimeout(undoTimer)
    remaining -= Date.now() - startedAt
    bar.style.animationPlayState = 'paused'
  }
  banner.onmouseleave = () => {
    startedAt = Date.now()
    bar.style.animationPlayState = 'running'
    undoTimer = setTimeout(close, Math.max(0, remaining))
  }
  undoTimer = setTimeout(close, remaining)
}

// Delete immediately, then offer a 5s window to undo.
async function deleteWithUndo(item) {
  await deleteInboxItem(item.id)
  await renderBrainDump()
  notifyInboxChanged()
  showUndoBanner('Thought deleted', async () => {
    await restoreInboxItem(item)
    notifyInboxChanged()
  })
}

// Clear all done items at once, with a 5s undo.
async function clearDoneWithUndo() {
  const items = await getInbox()
  const removed = items.filter((it) => it.status === 'done')
  if (removed.length === 0) return
  await setInbox(items.filter((it) => it.status !== 'done'))
  await renderBrainDump()
  showUndoBanner(`Cleared ${removed.length} done`, async () => {
    for (const it of removed) await restoreInboxItem(it)
    notifyInboxChanged()
  })
}

function makeIconButton(variant, iconSrc, tooltip, onClick) {
  const btn = document.createElement('button')
  btn.className = `brain-dump-action brain-dump-action-${variant}`
  btn.type = 'button'
  btn.title = tooltip
  btn.setAttribute('aria-label', tooltip)
  const img = document.createElement('img')
  img.src = iconSrc
  img.alt = ''
  btn.appendChild(img)
  btn.addEventListener('click', onClick)
  return btn
}

const PRIORITY_ORDER = ['high', 'normal', 'low']
const PRIORITY_LABEL = { high: 'High', normal: 'Normal', low: 'Low' }

// Move an inbox item one position by swapping order with its visible neighbor
// (stays within its priority group, since sorting is priority-then-order).
async function moveInboxItem(id, direction) {
  const items = await getInbox()
  const orderOf = (item) => item.order ?? item.createdAt ?? 0
  const sorted = items
    .filter((it) => it.status === 'inbox')
    .sort((a, b) => PRIORITY_RANK[getPriority(a)] - PRIORITY_RANK[getPriority(b)] || orderOf(b) - orderOf(a))
  const at = sorted.findIndex((it) => it.id === id)
  const swapAt = at + direction
  if (swapAt < 0 || swapAt >= sorted.length) return
  const a = items.find((it) => it.id === sorted[at].id)
  const b = items.find((it) => it.id === sorted[swapAt].id)
  // only swap within the same priority group
  if (getPriority(a) !== getPriority(b)) return
  const ao = orderOf(a)
  a.order = orderOf(b)
  b.order = ao
  await setInbox(items)
  await renderBrainDump()
}

function renderBrainDumpList(listEle, items, section) {
  listEle.innerHTML = ''
  items.forEach((item, index) => {
    const li = document.createElement('li')
    li.className = `brain-dump-item brain-dump-priority-${getPriority(item)}`
    li.dataset.id = item.id

    const content = document.createElement('div')
    content.className = 'brain-dump-item-content'

    const textBlock = document.createElement('div')
    textBlock.className = 'brain-dump-item-textblock'

    const textEle = document.createElement('span')
    textEle.className = 'brain-dump-item-text'
    textEle.title = 'Click to edit'
    textEle.textContent = item.text

    textBlock.appendChild(textEle)
    content.appendChild(textBlock)

    const startEditing = () => {
      if (textBlock.querySelector('.brain-dump-item-edit')) return
      const input = document.createElement('textarea')
      input.className = 'brain-dump-item-edit'
      input.rows = 1
      input.value = item.text
      textEle.replaceWith(input)
      const autoGrow = () => {
        input.style.height = 'auto'
        input.style.height = `${input.scrollHeight}px`
      }
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
      autoGrow()
      input.addEventListener('input', autoGrow)

      let committed = false
      const commit = async (save) => {
        if (committed) return
        committed = true
        const next = input.value.trim()
        if (save && next !== '' && next !== item.text) {
          await updateInboxItem(item.id, { text: next })
        }
        await renderBrainDump()
      }
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit(true)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          commit(false)
        }
      })
      input.addEventListener('blur', () => commit(true))
    }
    textEle.addEventListener('click', startEditing)

    const priority = getPriority(item)
    const prioWrap = document.createElement('div')
    prioWrap.className = `brain-dump-priority brain-dump-priority-${priority}`

    // Current level (always visible); other levels reveal on hover to pick directly.
    const current = document.createElement('span')
    current.className = `brain-dump-priority-chip brain-dump-priority-chip-${priority} brain-dump-priority-current`
    current.innerHTML = `<span class="brain-dump-priority-dot"></span>${PRIORITY_LABEL[priority]}`
    prioWrap.appendChild(current)

    PRIORITY_ORDER.filter((p) => p !== priority).forEach((p) => {
      const opt = document.createElement('button')
      opt.type = 'button'
      opt.className = `brain-dump-priority-chip brain-dump-priority-chip-${p} brain-dump-priority-opt`
      opt.innerHTML = `<span class="brain-dump-priority-dot"></span>${PRIORITY_LABEL[p]}`
      opt.title = `Set priority to ${PRIORITY_LABEL[p]}`
      opt.setAttribute('aria-label', `Set priority to ${PRIORITY_LABEL[p]}`)
      opt.addEventListener('click', async () => {
        await updateInboxItem(item.id, { priority: p, order: Date.now() })
        await renderBrainDump()
      })
      prioWrap.appendChild(opt)
    })
    li.appendChild(prioWrap)

    const meta = document.createElement('div')
    meta.className = 'brain-dump-item-meta'

    const time = document.createElement('span')
    time.className = 'brain-dump-item-time'
    if (section === 'postponed' && item.snoozeUntil) {
      time.textContent = `Snoozed until ${formatSnoozeUntil(item.snoozeUntil)}`
    } else {
      time.textContent = `Captured ${timeAgo(item.createdAt)}`
    }
    time.title = item.createdAt ? new Date(item.createdAt).toLocaleString() : ''
    meta.appendChild(time)

    if (item.url || item.title) {
      const context = document.createElement('a')
      context.className = 'brain-dump-item-context'
      context.textContent = item.title || shortenUrl(item.url)
      if (item.url) {
        context.href = item.url
        context.title = item.url
        context.addEventListener('click', (e) => {
          e.preventDefault()
          chrome.tabs.create({ url: item.url })
        })
      }
      meta.appendChild(context)
    } else {
      const noCtx = document.createElement('span')
      noCtx.className = 'brain-dump-item-context brain-dump-item-context-none'
      noCtx.textContent = 'Captured in app'
      meta.appendChild(noCtx)
    }
    content.appendChild(meta)
    li.appendChild(content)

    const actions = document.createElement('div')
    actions.className = 'brain-dump-item-actions'

    if (item.status !== 'done') {
      actions.appendChild(
        makeIconButton('complete', '/icons/done.png', 'Mark as done (moves to Done)', async () => {
          await updateInboxItem(item.id, { status: 'done' })
          await renderBrainDump()
          notifyInboxChanged()
        })
      )
    }
    if (item.status === 'inbox') {
      actions.appendChild(
        makeIconButton('snooze', '/icons/clock.png', 'Snooze - set aside for later', () => {
          promptSnooze(item)
        })
      )
    }
    if (item.status === 'postponed') {
      actions.appendChild(
        makeIconButton('restore', '/icons/bell.png', 'Unsnooze - move back to Inbox', async () => {
          await updateInboxItem(item.id, { status: 'inbox', snoozeUntil: null })
          await renderBrainDump()
          notifyInboxChanged()
        })
      )
    }
    if (item.status === 'done') {
      actions.appendChild(
        makeIconButton('restore', '/icons/undo.png', 'Restore - move back to Inbox', async () => {
          await updateInboxItem(item.id, { status: 'inbox' })
          await renderBrainDump()
          notifyInboxChanged()
        })
      )
    }
    actions.appendChild(
      makeIconButton('delete', '/icons/trash.png', 'Delete (you can undo for 5s)', async () => {
        await deleteWithUndo(item)
      })
    )

    li.appendChild(actions)

    // Reorder controls (inbox only) - move one position at a time, shown on hover.
    if (section === 'inbox' && items.length > 1) {
      const reorder = document.createElement('div')
      reorder.className = 'brain-dump-reorder'
      const upBtn = document.createElement('button')
      upBtn.type = 'button'
      upBtn.className = 'brain-dump-reorder-btn'
      upBtn.title = 'Move up'
      upBtn.setAttribute('aria-label', 'Move up')
      upBtn.textContent = '▲'
      upBtn.disabled = index === 0
      upBtn.addEventListener('click', () => moveInboxItem(item.id, -1))
      const downBtn = document.createElement('button')
      downBtn.type = 'button'
      downBtn.className = 'brain-dump-reorder-btn'
      downBtn.title = 'Move down'
      downBtn.setAttribute('aria-label', 'Move down')
      downBtn.textContent = '▼'
      downBtn.disabled = index === items.length - 1
      downBtn.addEventListener('click', () => moveInboxItem(item.id, 1))
      reorder.appendChild(upBtn)
      reorder.appendChild(downBtn)
      li.appendChild(reorder)
    }

    listEle.appendChild(li)
  })
}

async function init() {
  maxValueOfGraph = 0
  const currentFullDate = new Date(dateInput.value)
  const currentYear = currentFullDate.getFullYear().toString()
  const currentDate = currentFullDate.getDate()
  const currentMonth = currentFullDate.getMonth() + 1
  const currentDay = currentFullDate.getDay() === 0 ? 6 : currentFullDate.getDay() - 1
  await updateOldHistoryDataToAccomodateLatestChanges(currentYear)
  const sampleHistoryObj = await getSessionStorage(currentYear)
  sampleHistory = sampleHistoryObj[currentYear]
  const historyObj = await getLocalStorage(currentYear)
  const history = sampleHistory ?? historyObj[currentYear]

  if (!sampleHistory) {
    sampleHistoryBtn.classList.add('active')
    sampleHistoryRemoveBtn.classList.remove('active')
    isSampleElement.forEach((el) => el.classList.remove('active'))
    deleteSomeContainer.classList.remove('disable')
  } else {
    sampleHistoryBtn.classList.remove('active')
    sampleHistoryRemoveBtn.classList.add('active')
    isSampleElement.forEach((el) => el.classList.add('active'))
    deleteSomeContainer.classList.add('disable')
  }

  // weekly metrics
  const currentWeekStart = new Date(currentFullDate)
  currentWeekStart.setDate(currentDate - currentDay)
  const weekDate = new Date(currentWeekStart)
  const thisWeekData = {}
  let weeklySum = 0

  const weeklyTasks = Object.keys(TASKS).reduce((acc, key) => {
    acc[TASKS[key]] = new Array(7).fill(0)
    return acc
  }, {})
  if (history) {
    for (let i = 1; i <= 7; i++) {
      const currentWeekDateWithMonth = weekDate.getDate() + '-' + (weekDate.getMonth() + 1)
      weekDate.setDate(weekDate.getDate() + 1)
      if (currentWeekDateWithMonth in history) {
        const data = history[currentWeekDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) focus += d.duration
          else breaks += d.duration
          const task = getValidTask(d.task, d.type)
          weeklyTasks[task][i - 1] += d.duration
        })

        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))
        thisWeekData[i] = {
          focus,
          breaks,
        }

        if (i - 1 === currentDay) {
          setSimpleMetrics(focus, todayCount)
        }
        weeklySum += focus
        maxValueOfGraph = Math.max(focus, maxValueOfGraph)
      }
    }
  }

  if (!weeklySum) {
    noWeekDataElements.forEach((ele) => ele.classList.add('active'))
  } else {
    noWeekDataElements.forEach((ele) => ele.classList.remove('active'))
  }

  Object.keys(weeklyTasks).forEach((task) => {
    weeklyTasks[task] = weeklyTasks[task].map((data) => parseFloat((data / 60).toFixed(2)))
  })

  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    tasks: weeklyTasks,
  }

  // setYAxis(maxValueOfGraph)
  setBars(thisWeekData, maxValueOfGraph)
  setSimpleMetrics(weeklySum, weekCount, true)
  await setWeeklyTasksChart(weeklyData)

  // monthly metrics
  const firstDayOfNextMonth = new Date(currentYear, currentMonth, 1)
  const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
  let totalDaysInCurrentMonth = 0
  const thisMonthData = {}
  let monthlySum = 0
  const monthlyTasks = Object.keys(TASKS).reduce((acc, key) => {
    acc[TASKS[key]] = 0
    return acc
  }, {})
  if (history) {
    for (let i = 1; i <= lastDateOfCurrentMonth; i++) {
      totalDaysInCurrentMonth++
      const date = new Date(currentYear, currentMonth - 1, i)
      const currentDateWithMonth = date.getDate() + '-' + (date.getMonth() + 1)

      if (currentDateWithMonth in history) {
        const data = history[currentDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) focus += d.duration
          else breaks += d.duration
          const task = getValidTask(d.task, d.type)
          monthlyTasks[task] += d.duration
        })
        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))
        thisMonthData[i] = {
          focus,
          breaks,
        }

        monthlySum += focus
        maxValueOfGraph = Math.max(focus, maxValueOfGraph)
      }
    }
  }

  if (!monthlySum) {
    noMonthDataElements.forEach((ele) => ele.classList.add('active'))
  } else {
    noMonthDataElements.forEach((ele) => ele.classList.remove('active'))
  }
  setBars(thisMonthData, maxValueOfGraph, MONTH, totalDaysInCurrentMonth)
  setSimpleMetrics(monthlySum, monthCount, true)
  await makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history)

  Object.keys(monthlyTasks).forEach((task) => {
    monthlyTasks[task] = parseFloat((monthlyTasks[task] / 60).toFixed(2))
  })
  await setMonthlyTasksChart(monthlyTasks)

  // yearly metrics
  let yearlySum = 0
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(currentYear, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentYear, month, day)
      const currentDateWithMonth = currentDate.getDate() + '-' + (currentDate.getMonth() + 1)
      if (!history) break
      if (currentDateWithMonth in history) {
        const data = history[currentDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) focus += d.duration
          else breaks += d.duration
        })

        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))

        yearlySum += focus
      }
    }
  }
  setSimpleMetrics(yearlySum, yearCount, true)

  const today = new Date(dateInput.value)
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0') // Months are zero-indexed
  const day = String(today.getDate()).padStart(2, '0')

  const formattedDate = `${year}-${month}-${day}`

  deleteDateInput.value = formattedDate
  await generateSessionsToDelete()
  if (!sessions?.length) deleteSomeHistoryBtn.disabled = true

  settingsBtn.addEventListener('click', async () => {
    openSettingsInCurrentTab()
  })
  timerBtn.addEventListener('click', async () => {
    openTimerInCurrentTab()
  })
  streakBtn?.addEventListener('click', async () => {
    openStreakInCurrentTab()
  })
  await sendRuntimeMessageSafely({ type: 'START_SESSION' })
  await sendRuntimeMessageSafely({
    type: 'PAGE_VIEW',
    properties: {
      currentUrl: window?.location?.href,
      pathName: 'history',
      screenWidth: window?.screen?.width,
      screenHeight: window?.screen?.height,
    },
  })
}

function setBars(data, maxValueOfGraph, range = WEEK, totalDays = 7) {
  let totalFocus = 0
  let bars = weekBars
  if (range === MONTH) {
    bars = []
    monthBarsContainer.innerHTML = ''
    for (let i = 1; i <= totalDays; i++) {
      const bar = document.createElement('span')
      bar.classList.add('bar', 'month-bar')
      bar.setAttribute('data-x', i)
      bar.style.setProperty('--bar-height', 0 + 'px')
      monthBarsContainer.appendChild(bar)
      bars.push(bar)
    }
  }
  setTimeout(() => {
    bars.forEach((bar, i) => {
      const value = data[i + 1] ? data[i + 1].focus : 0
      totalFocus += value
      bar.setAttribute('data-value', getTimeFormatted(value))
      const height = (maxHeightOfGraph / maxValueOfGraph) * value
      bar.style.setProperty('--bar-height', height + 'px')
    })
  }, 50)
}

function setSimpleMetrics(time, elementToSetUpon, onlyHrs = false) {
  let count = 0
  let step = time / 100
  const interval = setInterval(() => {
    count += step
    if (count >= time) {
      elementToSetUpon.innerText = getTimeFormatted(time, onlyHrs)
      clearInterval(interval)
    }
    elementToSetUpon.innerText = getTimeFormatted(count, onlyHrs)
  }, 5)
}

let taskBarChart
let taskPieChart

async function setWeeklyTasksChart(weeklyData) {
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
  const datasets = Object.entries(weeklyData.tasks).map(([label, data], i) => ({
    label: tasksAlias[label] || label,
    data,
    backgroundColor: chartColors[i],
    borderColor: chartBorderColors,
    borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 10, bottomRight: 10 },
    borderWidth: 1,
  }))

  const barCtx = document.getElementById('taskBarChart').getContext('2d')
  if (taskBarChart) {
    taskBarChart.destroy()
  }
  taskBarChart = new Chart(barCtx, {
    type: 'bar',
    data: { labels: weeklyData.labels, datasets },
    options: {
      responsive: true,
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: theme === LIGHTTHEME ? '#000' : '#fff',
          },
          grid: {
            color: theme === LIGHTTHEME ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          },
        },
        y: {
          stacked: true,
          ticks: {
            color: theme === LIGHTTHEME ? '#000' : '#fff',
          },
          grid: {
            color: theme === LIGHTTHEME ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme === LIGHTTHEME ? '#000' : '#fff',
          },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function (context) {
              return ` ${context.dataset.label}: ${getTimeFormatted(context.raw)}`
            },
          },
        },
      },
      barPercentage: 1,
      borderSkipped: false,
      categoryPercentage: 0.9,
    },
  })
}

async function setMonthlyTasksChart(taskData) {
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
  const pieCtx = document.getElementById('taskPieChart').getContext('2d')
  if (taskPieChart) {
    taskPieChart.destroy()
  }
  taskPieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(taskData).map((label) => tasksAlias[label] || label),
      datasets: [
        {
          data: Object.values(taskData),
          backgroundColor: chartColors,
          borderColor: chartBorderColors,
          borderWidth: 3,
          borderRadius: 10,
          spacing: 5,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: theme === LIGHTTHEME ? '#000' : '#fff',
          },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function (context) {
              return ' ' + getTimeFormatted(context.raw)
            },
          },
        },
      },
      cutout: '40%',
    },
  })
}

function getTimeFormatted(floatHours, onlyHrs = false) {
  let hours = Math.floor(floatHours) > 9 ? Math.floor(floatHours) : '0' + Math.floor(floatHours)
  if (Math.floor(floatHours) === 0) hours = 0
  let minutes =
    Math.round((floatHours - hours) * 60) > 9
      ? Math.round((floatHours - hours) * 60)
      : '0' + Math.round((floatHours - hours) * 60)
  let formattedString = (hours ? hours + 'h ' : '') + minutes + 'm'
  if (onlyHrs) {
    formattedString = (floatHours > 9 ? floatHours.toFixed(1) : '0' + floatHours.toFixed(1)) + 'h'
  }
  return formattedString
}

function loadSettings(settings) {
  if (settings?.theme === LIGHTTHEME) {
    document.body.classList.add('light')
    theme = LIGHTTHEME
  } else {
    document.body.classList.remove('light')
    theme = DARKTHEME
  }
}

async function makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history) {
  let maxPomos = 0
  let prevYearHistory
  const boxes = []
  let totalFocus = 0
  let totalFocusCount = 0
  for (const [index] of calendarMonthContainers.entries()) {
    const m = calendarMonthContainers.length - index - 1
    const previousYear = (new Date(dateInput.value).getFullYear() - 1).toString()
    const curDate = new Date(currentYear, currentMonth - m - 1, 1)
    if (curDate.getFullYear().toString() === previousYear) {
      const historyObj = await getLocalStorage(previousYear)
      if (historyObj && !prevYearHistory) {
        prevYearHistory = historyObj[previousYear]
      }
    } else prevYearHistory = undefined
    calendarMonthBoxesContainers[index].innerHTML = ''
    const firstDayOfCurrentMonth =
      new Date(currentYear, currentMonth - m - 1, 1).getDay() === 0
        ? 6
        : new Date(currentYear, currentMonth - m - 1, 1).getDay() - 1
    const firstDateOfCurrentMonth = new Date(currentYear, currentMonth - m, 1).getDate()
    const firstDayOfNextMonth = new Date(currentYear, currentMonth - m, 1)
    const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
    let noOfDaysThisMonth = lastDateOfCurrentMonth - firstDateOfCurrentMonth + 1 + firstDayOfCurrentMonth
    const currentMonthString = new Date(currentYear, currentMonth - m - 1, 1).toLocaleString('default', {
      month: 'long',
    })
    calendarMonthLabels[index].innerText = currentMonthString
    let calendarCol = document.createElement('div')
    calendarCol.classList.add('calendar-col', 'first-calendar-col')
    const his = prevYearHistory || history
    for (let i = 1; i <= noOfDaysThisMonth; i++) {
      if (firstDayOfCurrentMonth >= i) continue
      const currentDate = new Date(currentYear, currentMonth - m - 1, i - firstDayOfCurrentMonth)
      const currentDateWithMonth = currentDate.getDate() + '-' + (currentDate.getMonth() + 1)
      const calendarBox = document.createElement('span')
      calendarBox.classList.add('calendar-box')
      const data = his && his[currentDateWithMonth] ? his[currentDateWithMonth] : []
      const haveJournal = data[0] && data[0][DAILYJOURNALLISTKEY] && data[0][DAILYJOURNALLISTKEY].length > 0
      if (his && currentDateWithMonth in his) {
        let focus = 0
        let breaks = 0
        let focusCount = 0
        for (const d of data) {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) {
            focus += d.duration
            focusCount++
          } else breaks += d.duration
        }

        focus = parseFloat(focus.toFixed(2))
        totalFocus += focus
        totalFocusCount++
        breaks = parseFloat(breaks.toFixed(2))
        maxPomos = Math.max(maxPomos, focus)
        if (focus !== 0) {
          const focusMins = parseFloat((focus % 60).toFixed(2))
          calendarBox.setAttribute(
            'data-value',
            `${focusCount} pomodoro${focusCount > 1 ? 's' : ''} of total ${focus > 60 ? Math.floor(focus / 60) + ' hrs and ' + focusMins + ' mins' : focus + ' mins'} on ${formatDateWithOrdinal(currentDate)}`
          )
          boxes.push({ ele: calendarBox, focus: focus })
        } else {
          calendarBox.setAttribute('data-value', `0 pomodoros on ${formatDateWithOrdinal(currentDate)}`)
          boxes.push({ ele: calendarBox, focus: 0 })
        }
      } else {
        calendarBox.setAttribute('data-value', `0 pomodoros on ${formatDateWithOrdinal(currentDate)}`)
        boxes.push({ ele: calendarBox, focus: 0 })
      }

      if (haveJournal) {
        calendarBox.classList.add('has-journal')
      }
      calendarBox.addEventListener('click', async (e) => {
        // Only allow editing if the date is less than 6 months from today
        const boxDate = new Date(currentYear, currentMonth - m - 1, i - firstDayOfCurrentMonth)
        const now = new Date()
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        const editable = boxDate > sixMonthsAgo
        const journalList = data[0] ? data[0][DAILYJOURNALLISTKEY] : []
        let anyChange = false
        const journalListContainer = document.querySelector('.journal-list-bg')
        const dailyJournalListSubContainer = journalListContainer.querySelector('.daily-journal-list')
        const dailyJournalAddBtn = journalListContainer.querySelector('.add-btn')
        const dailyJournalDeleteBtns = journalListContainer.querySelectorAll('.dlt-btn')
        const dailyJournalCheckboxes = journalListContainer.querySelectorAll('.journal-checkbox')
        const title = journalListContainer.querySelector('#title')
        title.innerText = `Daily Journal for ${formatDateWithOrdinal(currentDate)}`
        const crossBtn = document.querySelector('.cross-btn')
        journalListContainer.classList.add('show')
        journalListContainer.addEventListener('click', (e) => {
          if (e.target === journalListContainer) {
            journalListContainer.classList.remove('show')
            anyChange && location.reload()
          }
        })
        crossBtn.addEventListener('click', (e) => {
          journalListContainer.classList.remove('show')
          anyChange && location.reload()
        })
        if (!editable) {
          dailyJournalAddBtn.disabled = true
          dailyJournalDeleteBtns.forEach((btn) => {
            btn.disabled = true
          })
          dailyJournalCheckboxes.forEach((checkbox) => {
            checkbox.disabled = true
          })
        } else {
          dailyJournalAddBtn.disabled = false
          dailyJournalDeleteBtns.forEach((btn) => {
            btn.disabled = false
          })
          dailyJournalCheckboxes.forEach((checkbox) => {
            checkbox.disabled = false
          })
        }
        dailyJournalAddBtn.addEventListener('click', async () => {
          if (!editable) return
          showCustomPrompt(
            'Add a daily journal item!',
            `What would you like to add to your daily journal?`,
            '',
            async (response) => {
              if (response !== null && response.trim() !== '') {
                const year = currentDate.getFullYear().toString()
                const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`
                const history = await getLocalStorage(year)
                let yearObj = history[year] || {}
                let dayObj = yearObj[monthDay] || [{}]
                let journalList = dayObj[0][DAILYJOURNALLISTKEY] || []
                journalList.push({
                  id: Date.now() + Math.random().toString(36),
                  item: response.trim(),
                  completed: false,
                })

                dayObj[0][DAILYJOURNALLISTKEY] = journalList
                yearObj[monthDay] = dayObj
                history[year] = yearObj
                await setLocalStorage({ [year]: history[year] })
                initJournal(journalList)
                anyChange = true
                await sendRuntimeMessageSafely({ type: 'DAILY_JOURNAL_ADDED', response: response.trim() })
              }
            }
          )
        })

        initJournal()
        function initJournal(newJournalList = null) {
          const list = newJournalList ?? journalList ?? []
          if (list.length === 0) {
            dailyJournalListSubContainer.style.display = 'flex'
            dailyJournalListSubContainer.style.justifyContent = 'center'
            dailyJournalListSubContainer.style.alignItems = 'center'
            dailyJournalListSubContainer.innerHTML = `<span style="display: inline-block;opacity:0.6;text-align:center; padding-inline: auto;">You don't have any journals for this day</span>`
          } else {
            dailyJournalListSubContainer.innerHTML = list
              .map(
                (dailyJournal, index) => `
                  <li>
                    <input type="checkbox" class='journal-checkbox' id="dailyJournal-${index}" data-index="${index}" ${dailyJournal.completed ? 'checked' : ''}>
                    <label for="dailyJournal-${index}">${dailyJournal.item}</label>
                    <button class='dlt-btn' data-index="${index}"></button>
                  </li>
                `
              )
              .join('')
          }

          dailyJournalListSubContainer.querySelectorAll('.dlt-btn').forEach((button) => {
            button.addEventListener('click', async (event) => {
              showCustomAlert(
                'Are you sure you want to delete this item?',
                'This action cannot be undone.',
                async (response) => {
                  if (response) {
                    if (!editable) return
                    anyChange = true
                    const idx = event.target.dataset.index
                    const year = currentDate.getFullYear().toString()
                    const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`
                    const history = await getLocalStorage(year)
                    let yearObj = history[year] || {}
                    let dayObj = yearObj[monthDay] || [{}]
                    let journalList = dayObj[0][DAILYJOURNALLISTKEY] || []
                    const updatedDailyJournalList = journalList.filter((_, i) => i !== parseInt(idx, 10))
                    dayObj[0][DAILYJOURNALLISTKEY] = updatedDailyJournalList
                    yearObj[monthDay] = dayObj
                    history[year] = yearObj
                    await setLocalStorage({ [year]: history[year] })
                    initJournal(updatedDailyJournalList)
                  }
                }
              )
            })
          })

          dailyJournalListSubContainer.addEventListener('change', async (event) => {
            if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
              if (!editable) return
              anyChange = true
              const idx = event.target.dataset.index
              const year = currentDate.getFullYear().toString()
              const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`
              const history = await getLocalStorage(year)
              let yearObj = history[year] || {}
              let dayObj = yearObj[monthDay] || [{}]
              let journalList = dayObj[0][DAILYJOURNALLISTKEY] || []
              const updatedTodoList = [...journalList]
              updatedTodoList[idx] = {
                ...updatedTodoList[idx],
                completed: event.target.checked,
              }
              dayObj[0][DAILYJOURNALLISTKEY] = updatedTodoList
              yearObj[monthDay] = dayObj
              history[year] = yearObj
              await setLocalStorage({ [year]: history[year] })
            }
          })
        }
      })
      calendarBox.setAttribute('data-date', currentDateWithMonth)
      calendarCol.appendChild(calendarBox)
      if (i % 7 == 0 || i === noOfDaysThisMonth) {
        calendarMonthBoxesContainers[index].appendChild(calendarCol)
        calendarCol = document.createElement('div')
        calendarCol.classList.add('calendar-col')
      }
    }
  }

  const totalFocusString =
    parseFloat((totalFocus / 60).toFixed(2)) > 24
      ? Math.floor(parseFloat((totalFocus / 60).toFixed(2)) / 24) +
        ' days and ' +
        Math.floor(parseFloat((totalFocus / 60).toFixed(2)) % 24) +
        ' hrs'
      : parseFloat((totalFocus / 60).toFixed(2)) + ' hrs'
  totalFocusCountEle.innerText = `${totalFocusCount} (${totalFocusString})`

  let delayIndex = 0
  boxes.forEach((box) => {
    const { ele: boxEle, focus } = box
    let shade = ''
    const value = focus && maxPomos ? (focus / maxPomos) * 100 : 0
    if (value === 0) {
      shade = ''
    } else if (value < 25) {
      shade = '--primary-color-1'
    } else if (value < 50) {
      shade = '--primary-color-2'
    } else if (value < 75) {
      shade = '--primary-color-3'
    } else {
      shade = '--primary-color-4'
    }
    if (shade) {
      setTimeout(() => {
        boxEle.style.backgroundColor = `var(${shade})`
      }, 10 * delayIndex)
      delayIndex++
    }
  })
}

async function getSessions() {
  const dateSelected = deleteDateInput.value
  if (dateSelected.split('-').length !== 3) {
    sessions = []
    return
  }
  let currentYear = dateSelected.split('-')[0]
  let currentDate = dateSelected.split('-')[2][0] === '0' ? dateSelected.split('-')[2][1] : dateSelected.split('-')[2]
  let currentMonth = dateSelected.split('-')[1][0] === '0' ? dateSelected.split('-')[1][1] : dateSelected.split('-')[1]
  const currentDateInHistory = currentDate + '-' + currentMonth
  const history = (await getLocalStorage(currentYear))[currentYear]
  if (history) sessions = history[currentDateInHistory]
  else sessions = []
}

async function generateSessionsToDelete() {
  await getSessions()
  if (!sessions) sessions = []
  const container = document.querySelector('.specific-sessions-container')
  container.innerHTML = "<p style='text-align:center; opacity: 0.5;'>No sessions for the selected date</p>"
  if (sessions.length === 0 || (sessions.length === 1 && sessions[0]['dailyJournalList'])) return
  container.innerHTML = ''
  const table = document.createElement('table')
  table.className = 'sessions-table'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')

  const headers = ['Start Time', 'End Time', 'Duration', 'Task', 'Mode', 'Select']
  headers.forEach((headerText, index) => {
    const th = document.createElement('th')
    if (headerText === 'Select') {
      const selectAllCheckbox = document.createElement('input')
      selectAllCheckbox.type = 'checkbox'
      selectAllCheckbox.style.margin = '0'
      selectAllCheckbox.style.width = '100%'
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = container.querySelectorAll('.session-checkbox')
        checkboxes.forEach((checkbox) => {
          checkbox.checked = e.target.checked
          const row = checkbox.closest('tr')
          row.style.backgroundColor = checkbox.checked ? '#733a8e31' : ''
        })
      })
      th.appendChild(selectAllCheckbox)
    } else {
      th.textContent = headerText
    }
    headerRow.appendChild(th)
  })
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')

  for (let id = 0; id < sessions.length; id++) {
    const session = sessions[id]
    const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
    const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}

    const row = document.createElement('tr')
    row.style.cursor = 'pointer'
    const startCell = document.createElement('td')
    startCell.textContent = formatTimeWithLabel(session.startTime)
    if (startCell.textContent === '') continue
    row.appendChild(startCell)

    const endCell = document.createElement('td')
    endCell.textContent = formatTimeWithLabel(session.endTime)
    if (endCell.textContent === '') continue
    row.appendChild(endCell)

    const durationCell = document.createElement('td')
    const duration = session.duration
    durationCell.textContent = `${duration} mins`
    row.appendChild(durationCell)

    const taskCell = document.createElement('td')
    taskCell.classList.add('task-cell')
    const taskSpan = document.createElement('span')
    let task = getValidTask(session.task, session.type)
    taskSpan.textContent = tasksAlias[task]
    taskSpan.classList.add('task-span')
    taskSpan.style.backgroundColor = chartColors[Object.values(TASKS).indexOf(task)]

    if (task !== TASKS.REST) {
      const editIcon = document.createElement('img')
      editIcon.src = '/icons/pencil.png' // Path to the PNG image
      editIcon.classList.add('edit-icon')
      editIcon.style.cursor = 'pointer'
      editIcon.style.marginLeft = '8px'
      taskSpan.appendChild(editIcon)
      taskSpan.classList.add('editable')
      taskCell.addEventListener('click', async (e) => editTask(e, id, task, session))
    }

    taskCell.appendChild(taskSpan)

    row.appendChild(taskCell)

    const modeCell = document.createElement('td')
    const modeSpan = document.createElement('span')
    modeSpan.textContent = session?.mode === modes.STOPWATCH ? '⏲️' : '🍅'
    modeSpan.style.textAlign = 'center'
    modeSpan.style.width = '100%'
    modeSpan.style.display = 'inline-block'
    modeSpan.style.fontSize = '1.3em'
    modeSpan.classList.add('mode-span')
    modeCell.appendChild(modeSpan)
    row.appendChild(modeCell)

    const checkboxCell = document.createElement('td')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'session-checkbox'
    checkbox.checked = false
    checkbox.name = id
    checkbox.id = id
    checkbox.style.margin = '0'
    checkbox.style.width = '100%'
    checkboxCell.appendChild(checkbox)
    row.appendChild(checkboxCell)
    row.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked
      row.style.backgroundColor = checkbox.checked ? '#733a8e31' : ''
    })
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation() // Prevent the row click from being triggered when the checkbox is clicked
      row.style.backgroundColor = checkbox.checked ? '#733a8e31' : ''
    })
    tbody.appendChild(row)
  }

  table.appendChild(tbody)
  container.appendChild(table)
}

async function editTask(e, id, task, session) {
  e.stopPropagation()
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}

  showCustomPrompt(
    '🪻 Edit Task! 🪻',
    `${formatTimeWithLabel(session.startTime)} ▶ ${formatTimeWithLabel(session.endTime)}\n\nSelect the new task name:`,
    task,
    async (response) => {
      if (response !== null) {
        const dateSelected = deleteDateInput.value
        if (dateSelected) {
          let currentYear = dateSelected.substring(0, 4)
          let currentDateStr =
            dateSelected.split('-')[2][0] === '0' ? dateSelected.split('-')[2][1] : dateSelected.split('-')[2]
          let currentMonthStr =
            dateSelected.split('-')[1][0] === '0' ? dateSelected.split('-')[1][1] : dateSelected.split('-')[1]
          const currentDateInHistory = currentDateStr + '-' + currentMonthStr
          const oldHistoryObj = await getLocalStorage(currentYear)
          const oldHistory = oldHistoryObj[currentYear]

          let todaysPomodoros = oldHistory[currentDateInHistory]?.map((pom, index) => {
            if (index === id) {
              return { ...pom, task: response }
            } else return pom
          })

          if (todaysPomodoros !== undefined) {
            oldHistory[currentDateInHistory] = [...todaysPomodoros]
            await setLocalStorage({
              [currentYear]: {
                ...oldHistory,
              },
            })

            await generateSessionsToDelete()
          }
        }
      }
    },
    'select',
    '',
    getFocusOptionsForTasks(tasksAlias)
  )
}
