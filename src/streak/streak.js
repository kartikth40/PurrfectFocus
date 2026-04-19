import { FOCUS, LIGHTTHEME, SETTINGSKEY } from '../constants.js'
import {
  getLocalStorage,
  setLocalStorage,
  getSyncStorage,
  createNewTabForHistory,
  createNewTabForSettings,
  createNewTabForTimers,
} from '../utils.js'

const currentStreakEl = document.querySelector('.current-streak')
const maxStreakEl = document.getElementById('max-streak')
const pomosToday = document.getElementById('pomos-today')
const streakChecks = document.querySelectorAll('.streak-check')
const fireIcon = document.getElementById('fire-icon')
const streakStatusLabel = document.getElementById('streak-status-label')

// how many months back the monthly grid is offset (0 = current 3 months)
let monthViewOffset = 0
// cached for use in runPageAnimations
let _streak = 0
let _max = 0

const MILESTONES = [
  { days: 3, icon: '🌱', label: '3 days', phrase: 'Seeds of habit planted. Keep watering!' },
  { days: 7, icon: '🔥', label: '7 days', phrase: "A full week of fire. You're on a roll!" },
  { days: 14, icon: '⚡', label: '2 weeks', phrase: 'Two weeks strong. The habit is forming.' },
  { days: 30, icon: '💎', label: '30 days', phrase: "A whole month. You're built different." },
  { days: 60, icon: '🚀', label: '60 days', phrase: 'Two months in orbit. Unstoppable.' },
  { days: 100, icon: '👑', label: '100 days', phrase: 'A hundred days. Legendary focus.' },
]

const sendRuntimeMessageSafely = async (message) => {
  try {
    await chrome.runtime.sendMessage(message)
  } catch (e) {
    console.warn(e)
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await init()
  const loadingScreen = document.querySelector('.loading-screen')
  setTimeout(() => {
    loadingScreen.classList.add('fade-out')
    setTimeout(() => {
      loadingScreen.remove()
      runPageAnimations()
    }, 500)
  }, 200)
  document.querySelector('.history-tab-btn')?.addEventListener('click', () => createNewTabForHistory())
  document.querySelector('.settings-tab-btn')?.addEventListener('click', () => createNewTabForSettings())
  document.querySelector('.timer-tab-btn')?.addEventListener('click', () => createNewTabForTimers(false, true))

  const today = new Date()
  const currentYear = today.getFullYear().toString()

  document.getElementById('months-prev')?.addEventListener('click', async () => {
    monthViewOffset += 3
    const histObj = await getLocalStorage(currentYear)
    const history = histObj?.[currentYear] ?? {}
    await renderMonthlyGrid(today, history, currentYear, monthViewOffset)
    // re-animate done cells
    document.querySelectorAll('.monthly-day[data-done="true"]').forEach((el, i) => {
      setTimeout(() => el.classList.add('done'), i * 25)
    })
  })

  document.getElementById('months-next')?.addEventListener('click', async () => {
    if (monthViewOffset === 0) return
    monthViewOffset = Math.max(0, monthViewOffset - 3)
    const histObj = await getLocalStorage(currentYear)
    const history = histObj?.[currentYear] ?? {}
    await renderMonthlyGrid(today, history, currentYear, monthViewOffset)
    document.querySelectorAll('.monthly-day[data-done="true"]').forEach((el, i) => {
      setTimeout(() => el.classList.add('done'), i * 25)
    })
  })
  await sendRuntimeMessageSafely({
    type: 'PAGE_VIEW',
    properties: {
      currentUrl: window.location.href,
      pathName: 'streak',
      screenWidth: window?.screen?.width,
      screenHeight: window?.screen?.height,
    },
  })
})

chrome.runtime.onMessage.addListener(async (request) => {
  if (request.saveSettings) {
    location.reload()
  }
})

function dateKey(date) {
  return `${date.getDate()}-${date.getMonth() + 1}`
}

function focusSessionCount(history, date) {
  const sessions = history?.[dateKey(date)]
  if (!Array.isArray(sessions)) return 0
  return sessions.filter((s) => s.type === FOCUS).length
}

function hasFocusSession(history, date) {
  return focusSessionCount(history, date) > 0
}

async function calcCurrentStreak(today) {
  let streak = 0
  const cursor = new Date(today)
  let year = cursor.getFullYear().toString()
  let histObj = await getLocalStorage(year)
  let history = histObj?.[year] ?? {}

  // if today has no session yet, start from yesterday — streak is still alive
  if (!hasFocusSession(history, cursor)) {
    cursor.setDate(cursor.getDate() - 1)
    year = cursor.getFullYear().toString()
    histObj = await getLocalStorage(year)
    history = histObj?.[year] ?? {}
    // if yesterday also has no session, streak is broken — return 0
    if (!hasFocusSession(history, cursor)) return 0
  }

  while (true) {
    const curYear = cursor.getFullYear().toString()
    if (curYear !== year) {
      histObj = await getLocalStorage(curYear)
      history = histObj?.[curYear] ?? {}
      year = curYear
    }
    if (!hasFocusSession(history, cursor)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

async function calcMaxStreak() {
  const allData = await getLocalStorage(null)
  const years = Object.keys(allData ?? {})
    .filter((k) => !isNaN(Number(k)))
    .sort()
  if (!years.length) return 0

  let maxStreak = 0,
    currentRun = 0,
    prevDate = null

  for (const year of years) {
    const history = allData[year]
    if (!history || typeof history !== 'object') continue
    const sortedKeys = Object.keys(history).sort((a, b) => {
      const [da, ma] = a.split('-').map(Number)
      const [db, mb] = b.split('-').map(Number)
      return ma !== mb ? ma - mb : da - db
    })
    for (const key of sortedKeys) {
      const sessions = history[key]
      if (!Array.isArray(sessions)) continue
      const hasFocus = sessions.some((s) => s.type === FOCUS)
      if (!hasFocus) {
        currentRun = 0
        prevDate = null
        continue
      }
      const [d, m] = key.split('-').map(Number)
      const thisDate = new Date(Number(year), m - 1, d)
      if (prevDate) {
        const diff = (thisDate - prevDate) / (1000 * 60 * 60 * 24)
        currentRun = diff === 1 ? currentRun + 1 : 1
      } else {
        currentRun = 1
      }
      prevDate = thisDate
      if (currentRun > maxStreak) maxStreak = currentRun
    }
  }
  return maxStreak
}

/** Find the most recent completed streak before today — returns { days, endDate } */
async function calcLastStreak(today) {
  const allData = await getLocalStorage(null)
  let run = 0
  let lastEndDate = null
  let inRun = false
  const cursor = new Date(today)
  cursor.setDate(cursor.getDate() - 1)

  for (let attempts = 0; attempts < 400; attempts++) {
    const y = cursor.getFullYear().toString()
    const history = allData?.[y] ?? {}
    const has = hasFocusSession(history, cursor)
    if (has) {
      if (!inRun) {
        inRun = true
        lastEndDate = new Date(cursor)
      }
      run++
    } else if (inRun) {
      break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return { days: run, endDate: lastEndDate }
}

/** Find the most recent date when a streak of targetDays was achieved — walks backwards from today */
async function findMilestoneEarnedDate(targetDays) {
  const allData = await getLocalStorage(null)
  const today = new Date()
  const cursor = new Date(today)

  // if today has no session yet, start from yesterday (streak is still alive)
  const todayYear = today.getFullYear().toString()
  const todayHistory = allData?.[todayYear] ?? {}
  if (!hasFocusSession(todayHistory, today)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let run = 0
  for (let i = 0; i < 400; i++) {
    const y = cursor.getFullYear().toString()
    const history = allData?.[y] ?? {}
    if (!hasFocusSession(history, cursor)) {
      if (run > 0) break
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    run++
    if (run === targetDays) return new Date(cursor)
    cursor.setDate(cursor.getDate() - 1)
  }
  return null
}

function showBadgeOverlay(icon, label, sub = "You've maintained a focus streak 🔥", type = 'badge') {
  const overlay = document.getElementById('badge-overlay')
  const content = overlay?.querySelector('.badge-overlay-content')
  const iconEl = document.getElementById('badge-overlay-icon')
  const nameEl = document.getElementById('badge-overlay-name')
  const subEl = overlay?.querySelector('.badge-overlay-sub')
  const closeBtn = document.getElementById('badge-overlay-close')
  if (!overlay) return
  iconEl.textContent = icon
  nameEl.textContent = label
  if (subEl) subEl.textContent = sub
  // apply type-specific style
  content.classList.remove('badge-overlay-personal-best')
  if (type === 'personal-best') content.classList.add('badge-overlay-personal-best')
  overlay.style.display = 'flex'
  closeBtn.onclick = () => {
    overlay.style.display = 'none'
  }
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.style.display = 'none'
  }
}

/** Fire confetti celebration */
function celebrateConfetti(type = 'default') {
  /* global confetti */
  if (typeof confetti === 'undefined') return

  // ensure confetti canvas is above the overlay
  const myConfetti = confetti.create(null, { resize: true, useWorker: true })

  if (type === 'personal-best') {
    myConfetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#ffd700', '#ffaa00', '#ff8c00', '#fff', '#c084fc'],
      scalar: 2,
      zIndex: 10000,
    })
    setTimeout(() => {
      myConfetti({
        particleCount: 60,
        spread: 50,
        origin: { x: 0.2, y: 0.5 },
        colors: ['#ffd700', '#ffaa00'],
        zIndex: 10000,
      })
      myConfetti({
        particleCount: 60,
        spread: 50,
        origin: { x: 0.8, y: 0.5 },
        colors: ['#ffd700', '#ffaa00'],
        zIndex: 10000,
      })
    }, 200)
  } else {
    myConfetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#c084fc', '#a855f7', '#e879f9', '#fff', '#818cf8'],
      zIndex: 10000,
    })
  }
}

/** Returns { week: { label, days }, month: { label, days } } best stats */
async function calcBestStats() {
  const allData = await getLocalStorage(null)
  const years = Object.keys(allData ?? {})
    .filter((k) => !isNaN(Number(k)))
    .sort()

  let bestWeekDays = 0,
    bestWeekLabel = '—'
  let bestMonthDays = 0,
    bestMonthLabel = '—'
  let totalFocusDays = 0
  let totalSessions = 0
  let totalFocusMinutes = 0
  // Mon=0 ... Sun=6
  const daySessionCount = [0, 0, 0, 0, 0, 0, 0]
  const dayNames7 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  for (const year of years) {
    const history = allData[year]
    if (!history || typeof history !== 'object') continue

    // best week — iterate all weeks
    const allDates = Object.keys(history)
      .filter((k) => Array.isArray(history[k]) && history[k].some((s) => s.type === FOCUS))
      .map((k) => {
        const [d, m] = k.split('-').map(Number)
        return new Date(Number(year), m - 1, d)
      })
      .sort((a, b) => a - b)

    totalFocusDays += allDates.length

    // accumulate total sessions and focus minutes
    for (const date of allDates) {
      const key = `${date.getDate()}-${date.getMonth() + 1}`
      const sessions = history[key] ?? []
      const focusSessions = sessions.filter((s) => s.type === FOCUS)
      totalSessions += focusSessions.length
      totalFocusMinutes += focusSessions.reduce((sum, s) => sum + (s.duration ?? 0), 0)
      // track by day of week (Mon=0)
      const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
      daySessionCount[dow] += focusSessions.length
    }

    const weekMap = {}
    for (const date of allDates) {
      const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1 // Mon=0 ... Sun=6
      const mon = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek)
      const wk = `${mon.getFullYear()}-${mon.getMonth() + 1}-${mon.getDate()}`
      weekMap[wk] = (weekMap[wk] ?? 0) + 1
    }
    for (const [wk, days] of Object.entries(weekMap)) {
      if (days > bestWeekDays) {
        bestWeekDays = days
        const [wy, wm, wd] = wk.split('-').map(Number)
        const monDate = new Date(wy, wm - 1, wd) // local time, no UTC shift
        const sunDate = new Date(wy, wm - 1, wd + 6)
        const sameMonth = monDate.getMonth() === sunDate.getMonth()
        bestWeekLabel = sameMonth
          ? `${monthNames[monDate.getMonth()]} ${monDate.getDate()}–${sunDate.getDate()}`
          : `${monthNames[monDate.getMonth()]} ${monDate.getDate()} – ${monthNames[sunDate.getMonth()]} ${sunDate.getDate()}`
      }
    }

    // best month
    const monthMap = {}
    for (const date of allDates) {
      const mk = `${year}-${date.getMonth()}`
      monthMap[mk] = (monthMap[mk] ?? 0) + 1
    }
    for (const [mk, days] of Object.entries(monthMap)) {
      if (days > bestMonthDays) {
        bestMonthDays = days
        const [y, m] = mk.split('-')
        bestMonthLabel = `${monthNames[Number(m)]} ${y}`
      }
    }
  }

  const bestDowIdx = daySessionCount.indexOf(Math.max(...daySessionCount))
  const bestDayOfWeek = totalSessions > 0 ? dayNames7[bestDowIdx] : '—'

  return {
    bestWeekDays,
    bestWeekLabel,
    bestMonthDays,
    bestMonthLabel,
    totalFocusDays,
    avgSessionsPerDay: totalFocusDays > 0 ? parseFloat((totalSessions / totalFocusDays).toFixed(1)) : 0,
    avgFocusMinPerDay: totalFocusDays > 0 ? Math.round(totalFocusMinutes / totalFocusDays) : 0,
    bestDayOfWeek,
  }
}

function renderMilestones(streak) {
  const section = document.getElementById('milestone-section')
  if (!section) return

  const badgesDiv = document.createElement('div')
  badgesDiv.className = 'milestone-badges'

  MILESTONES.forEach((m) => {
    const badge = document.createElement('div')
    badge.className = 'milestone-badge locked'
    if (streak >= m.days) badge.dataset.earned = 'true'
    badge.dataset.phrase = m.phrase
    badge.innerHTML = `<span class="badge-icon">${m.icon}</span><span class="badge-label">${m.label}</span>`

    // tooltip
    if (streak >= m.days) {
      badge.addEventListener('mouseenter', async (e) => {
        const earnedDate = await findMilestoneEarnedDate(m.days)
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const dateStr = earnedDate
          ? ` · earned ${shortMonths[earnedDate.getMonth()]} ${earnedDate.getDate()}, ${earnedDate.getFullYear()}`
          : ''
        showDayTooltip(e, `${m.icon} ${m.phrase}${dateStr}`)
      })
      badge.addEventListener('mousemove', (e) => {
        if (tooltip) {
          tooltip.style.left = `${e.clientX}px`
          tooltip.style.top = `${e.clientY - 36}px`
        }
      })
      badge.addEventListener('mouseleave', hideDayTooltip)
    } else {
      const needed = m.days - streak
      badge.addEventListener('mouseenter', (e) =>
        showDayTooltip(e, `${needed} more day${needed !== 1 ? 's' : ''} to unlock ${m.icon}`)
      )
      badge.addEventListener('mousemove', (e) => {
        if (tooltip) {
          tooltip.style.left = `${e.clientX}px`
          tooltip.style.top = `${e.clientY - 36}px`
        }
      })
      badge.addEventListener('mouseleave', hideDayTooltip)
    }

    badgesDiv.appendChild(badge)
  })
  section.appendChild(badgesDiv)

  // next milestone progress
  const next = MILESTONES.find((m) => streak < m.days)
  if (next) {
    const nextIdx = MILESTONES.indexOf(next)
    const from = nextIdx > 0 ? MILESTONES[nextIdx - 1].days : 0
    const pct = Math.round(((streak - from) / (next.days - from)) * 100)
    const nextDiv = document.createElement('div')
    nextDiv.className = 'milestone-next'
    nextDiv.innerHTML = `
      <span class="milestone-next-label">Next: ${next.icon} <b>${next.label}</b> &nbsp;·&nbsp; ${streak}/${next.days} days &nbsp;<span class="milestone-next-pct">${pct}%</span></span>
      <div class="milestone-next-bar-wrap">
        <div class="milestone-next-bar" style="width:0%" data-width="${pct}%"></div>
      </div>`
    section.appendChild(nextDiv)
  }
}

function renderBestStats(
  bestWeekDays,
  bestWeekLabel,
  bestMonthDays,
  bestMonthLabel,
  totalFocusDays,
  avgSessionsPerDay,
  avgFocusMinPerDay,
  bestDayOfWeek
) {
  const section = document.getElementById('best-stats-section')
  if (!section) return
  const avgTime =
    avgFocusMinPerDay >= 60
      ? `${Math.floor(avgFocusMinPerDay / 60)}h ${avgFocusMinPerDay % 60}m`
      : `${avgFocusMinPerDay}m`
  section.innerHTML = `
    <div class="best-stat-card">
      <span class="stat-value">${bestWeekDays} days</span>
      <span class="stat-label">Most focus days<br>in a week<br><small>${bestWeekLabel}</small></span>
    </div>
    <div class="best-stat-card">
      <span class="stat-value">${bestMonthDays} days</span>
      <span class="stat-label">Most focus days<br>in a month<br><small>${bestMonthLabel}</small></span>
    </div>
    <div class="best-stat-card">
      <span class="stat-value">${totalFocusDays}</span>
      <span class="stat-label">Total focus<br>days ever</span>
    </div>
    <div class="best-stat-card">
      <span class="stat-value">${avgSessionsPerDay}</span>
      <span class="stat-label">Avg sessions<br>per focus day</span>
    </div>
    <div class="best-stat-card">
      <span class="stat-value">${avgTime}</span>
      <span class="stat-label">Avg focus time<br>per focus day</span>
    </div>
    <div class="best-stat-card">
      <span class="stat-value">${bestDayOfWeek}</span>
      <span class="stat-label">Most productive<br>day of week</span>
    </div>`
}

/** Animate a number counting up from 0 to target */
function countUp(el, target, duration = 600) {
  if (!el || target === 0) return
  const start = performance.now()
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1)
    el.textContent = Math.round(progress * target)
    if (progress < 1) requestAnimationFrame(update)
    else el.textContent = target
  }
  requestAnimationFrame(update)
}

function runPageAnimations() {
  const BASE = 0
  const streak = _streak
  const max = _max

  // fire icon — pop in, then glow if active streak
  const fire = document.getElementById('fire-icon')
  if (fire) {
    setTimeout(() => {
      fire.style.opacity = '1'
      fire.style.animation = 'popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
      if (fire.classList.contains('active-streak')) {
        setTimeout(() => {
          fire.style.animation = 'fireGlow 2s ease-in-out infinite'
        }, 700)
      }
    }, BASE + 50)
  }

  // main-left-title — slide up
  const leftTitle = document.querySelector('.main-left-title')
  if (leftTitle) setTimeout(() => leftTitle.classList.add('anim-fade-up'), BASE + 200)

  // top metric — slide up
  const topMetric = document.querySelector('.top-metric')
  if (topMetric) setTimeout(() => topMetric.classList.add('anim-fade-up'), BASE + 150)

  // count up numbers after their containers appear
  const streakVal = parseInt(currentStreakEl.textContent) || 0
  const maxVal = parseInt(maxStreakEl.textContent) || 0
  const pomosVal = parseInt(pomosToday.textContent) || 0
  currentStreakEl.textContent = '0'
  maxStreakEl.textContent = '0'
  pomosToday.textContent = '0'
  setTimeout(() => {
    countUp(currentStreakEl, streakVal, 800)
    countUp(maxStreakEl, maxVal, 800)
    countUp(pomosToday, pomosVal, 600)
  }, BASE + 300)

  // weekly container — slide right
  const weeklyContainer = document.querySelector('.weekly-streak-container')
  if (weeklyContainer) setTimeout(() => weeklyContainer.classList.add('anim-fade-right'), BASE + 250)

  // bottom section (monthly + badges + stats) — fade up as one block
  const bottomSection = document.querySelector('.bottom-section')
  if (bottomSection) setTimeout(() => bottomSection.classList.add('anim-fade-up'), BASE + 300)

  // monthly — all cells appear instantly, only done cells animate in
  const allCells = Array.from(document.querySelectorAll('.monthly-day'))
  allCells.forEach((el) => el.classList.remove('anim-target')) // show all immediately
  const doneCells = allCells.filter((el) => el.dataset.done === 'true')
  doneCells.forEach((el, i) => {
    setTimeout(() => el.classList.add('done'), BASE + 400 + i * 30)
  })

  // weekly checkboxes — appear empty, then fill one by one
  document.querySelectorAll('.streak-check').forEach((el, i) => {
    setTimeout(
      () => {
        el.classList.add('anim-check')
        if (el.dataset.check === 'true') {
          setTimeout(() => el.classList.add('check'), 150)
        }
      },
      BASE + 300 + i * 60
    )
  })

  // milestone badges — appear locked, then earned ones flip one by one
  // confetti only for the highest earned badge, and only if no personal best confetti
  const allBadges = Array.from(document.querySelectorAll('.milestone-badge'))
  const earnedBadges = allBadges.filter((el) => el.dataset.earned === 'true')
  const isPersonalBest = streak > 0 && streak >= max

  allBadges.forEach((el, i) => {
    setTimeout(
      () => {
        el.classList.add('anim-badge')
        if (el.dataset.earned === 'true') {
          setTimeout(async () => {
            el.classList.remove('locked')
            el.classList.add('earned')
            // always mark lower earned badges as celebrated silently
            const thisLabel = el.querySelector('.badge-label')?.textContent
            if (el !== earnedBadges[earnedBadges.length - 1]) {
              const stored = await getLocalStorage(`badge_celebrated_${thisLabel}`)
              if (!stored[`badge_celebrated_${thisLabel}`]) {
                await setLocalStorage({ [`badge_celebrated_${thisLabel}`]: true })
              }
            }
            if (el === earnedBadges[earnedBadges.length - 1] && !isPersonalBest) {
              const phrase = el.dataset.phrase ?? "You've maintained a focus streak 🔥"
              const celebKey = `badge_celebrated_${thisLabel}`
              const stored = await getLocalStorage(celebKey)
              if (!stored[celebKey]) {
                await setLocalStorage({ [celebKey]: true })
                const icon = el.querySelector('.badge-icon')?.textContent ?? '🏅'
                setTimeout(() => {
                  showBadgeOverlay(icon, thisLabel, phrase)
                  celebrateConfetti('badge')
                }, 300)
              }
            }
          }, 200)
        }
      },
      BASE + 350 + i * 55
    )
  })

  // progress bar + info — fade up, then animate bar width
  document.querySelectorAll('.milestone-next, .best-stat-card').forEach((el, i) => {
    setTimeout(() => el.classList.add('anim-fade-up'), BASE + 600 + i * 80)
  })
  // animate progress bar fill after it becomes visible
  setTimeout(() => {
    const bar = document.querySelector('.milestone-next-bar')
    if (bar) {
      const target = bar.dataset.width ?? '0%'
      bar.style.transition = 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)'
      bar.style.width = target
    }
  }, BASE + 700)
}

async function init() {
  const store = await getSyncStorage(SETTINGSKEY)
  const settings = store?.settings

  if (settings?.theme === LIGHTTHEME) {
    document.body.classList.add('light')
  } else {
    document.body.classList.remove('light')
  }

  const today = new Date()
  const currentYear = today.getFullYear().toString()
  const histObj = await getLocalStorage(currentYear)
  const history = histObj?.[currentYear] ?? {}

  // today's pomodoros
  const focusToday = focusSessionCount(history, today)
  pomosToday.textContent = focusToday

  // check for empty state — no history at all
  const allData = await getLocalStorage(null)
  const hasAnyHistory = Object.keys(allData ?? {})
    .filter((k) => !isNaN(Number(k)))
    .some((y) => {
      const h = allData[y]
      return (
        h &&
        typeof h === 'object' &&
        Object.values(h).some((sessions) => Array.isArray(sessions) && sessions.some((s) => s.type === FOCUS))
      )
    })

  const emptyState = document.getElementById('empty-state')
  const monthlySection = document.querySelector('.monthly-section')
  const rightPanel = document.querySelector('.right-panel')

  if (!hasAnyHistory) {
    if (emptyState) emptyState.style.display = 'flex'
    if (monthlySection) monthlySection.style.display = 'none'
    if (rightPanel) rightPanel.style.display = 'none'
    return
  }
  if (emptyState) emptyState.style.display = 'none'
  if (monthlySection) monthlySection.style.display = ''
  if (rightPanel) rightPanel.style.display = ''

  // current streak
  const streak = await calcCurrentStreak(today)
  currentStreakEl.textContent = streak
  _streak = streak

  // streak broken indicator — check if yesterday had no session
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayYear = yesterday.getFullYear().toString()
  let yesterdayHistory = history
  if (yesterdayYear !== currentYear) {
    const h = await getLocalStorage(yesterdayYear)
    yesterdayHistory = h?.[yesterdayYear] ?? {}
  }
  const yesterdayHadSession = hasFocusSession(yesterdayHistory, yesterday)
  const todayHadSession = hasFocusSession(history, today)

  // if streak is broken (2+ days no session), reset badge celebrations so they fire again next streak
  if (todayHadSession) {
    streakStatusLabel.textContent = 'focus streak'
    fireIcon.classList.remove('dull')
    if (streak > 0) fireIcon.classList.add('active-streak')
  } else if (yesterdayHadSession) {
    streakStatusLabel.innerHTML = `focus streak <span class="streak-at-risk">⚡ do a session today to keep it going!</span>`
    fireIcon.classList.remove('dull', 'active-streak')
  } else if (streak === 0) {
    // streak is broken — clear badge celebration keys so they re-fire on the next streak
    const allData = await getLocalStorage(null)
    const badgeKeys = Object.keys(allData ?? {}).filter((k) => k.startsWith('badge_celebrated_'))
    if (badgeKeys.length > 0) await chrome.storage.local.remove(badgeKeys)

    const { days: lastDays, endDate } = await calcLastStreak(today)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const endLabel = endDate ? `${monthNames[endDate.getMonth()]} ${endDate.getDate()}` : null
    const brokenMsg =
      lastDays > 0 && endLabel
        ? `⚠ streak broken · last: ${lastDays} day${lastDays !== 1 ? 's' : ''}, ended ${endLabel}`
        : `⚠ streak broken`
    streakStatusLabel.innerHTML = `focus streak <span class="streak-broken">${brokenMsg}</span>`
    fireIcon.classList.add('dull')
    fireIcon.classList.remove('active-streak')
  } else {
    streakStatusLabel.textContent = 'focus streak'
    fireIcon.classList.remove('dull', 'active-streak')
  }

  // max streak + personal best check
  const max = await calcMaxStreak()
  maxStreakEl.textContent = max
  _max = max

  // personal best — current streak matches or beats all-time high
  const maxMetricEl = maxStreakEl.closest('p')
  if (streak > 0 && streak >= max && maxMetricEl) {
    maxMetricEl.innerHTML = `Highest: <span id="max-streak">${max}</span> days &nbsp;<span class="personal-best-badge">🏆 Personal Best!</span>`
    const pbKey = `personal_best_celebrated_${max}`
    const stored = await getLocalStorage(pbKey)
    if (!stored[pbKey]) {
      // remove stale personal best keys from previous streak values
      const allData = await getLocalStorage(null)
      const oldKeys = Object.keys(allData ?? {}).filter((k) => k.startsWith('personal_best_celebrated_') && k !== pbKey)
      if (oldKeys.length > 0) await chrome.storage.local.remove(oldKeys)
      await setLocalStorage({ [pbKey]: true })
      // mark all earned milestone badges as celebrated — personal best overlay covers them,
      // so they shouldn't fire their own overlay on a future (lower) streak
      for (const m of MILESTONES) {
        if (streak >= m.days) await setLocalStorage({ [`badge_celebrated_${m.label}`]: true })
      }
      setTimeout(() => {
        showBadgeOverlay(
          '🏆',
          `${max} Day Personal Best!`,
          "You've beaten your all-time streak record! 🎉",
          'personal-best'
        )
        celebrateConfetti('personal-best')
      }, 900)
    }
  }

  // milestones
  document.getElementById('milestone-section').innerHTML = ''
  renderMilestones(streak)

  // best stats
  const {
    bestWeekDays,
    bestWeekLabel,
    bestMonthDays,
    bestMonthLabel,
    totalFocusDays,
    avgSessionsPerDay,
    avgFocusMinPerDay,
    bestDayOfWeek,
  } = await calcBestStats()
  renderBestStats(
    bestWeekDays,
    bestWeekLabel,
    bestMonthDays,
    bestMonthLabel,
    totalFocusDays,
    avgSessionsPerDay,
    avgFocusMinPerDay,
    bestDayOfWeek
  )

  // weekly checkboxes
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1

  // weekly label — "This week (Apr 14–20)"
  const weeklyLabel = document.getElementById('weekly-label')
  if (weeklyLabel) {
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const mon = new Date(today)
    mon.setDate(today.getDate() - todayIndex)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const sameMonth = mon.getMonth() === sun.getMonth()
    weeklyLabel.textContent = sameMonth
      ? `This week (${shortMonths[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()})`
      : `This week (${shortMonths[mon.getMonth()]} ${mon.getDate()} – ${shortMonths[sun.getMonth()]} ${sun.getDate()})`
  }
  const monday = new Date(today)
  monday.setDate(today.getDate() - todayIndex)
  monday.setHours(0, 0, 0, 0)

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const check = streakChecks[i]
    check.classList.remove('check', 'current')
    if (i === todayIndex) check.classList.add('current')
    if (i > todayIndex) continue
    const dayYear = day.getFullYear().toString()
    let dayHistory = history
    if (dayYear !== currentYear) {
      const h = await getLocalStorage(dayYear)
      dayHistory = h?.[dayYear] ?? {}
    }
    if (hasFocusSession(dayHistory, day)) check.dataset.check = 'true'
  }

  // monthly grid
  await renderMonthlyGrid(today, history, currentYear, monthViewOffset)
}

// shared tooltip element
let tooltip = null
function showDayTooltip(e, text) {
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.className = 'day-tooltip'
    document.body.appendChild(tooltip)
  }
  tooltip.textContent = text
  tooltip.style.display = 'block'
  tooltip.style.left = `${e.clientX}px`
  tooltip.style.top = `${e.clientY - 32}px`
}
function hideDayTooltip() {
  if (tooltip) tooltip.style.display = 'none'
}

async function renderMonthlyGrid(today, history, currentYear, viewOffset = 0) {
  const container = document.getElementById('months-container')
  if (!container) return
  container.innerHTML = ''

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fullMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // update nav button states
  const prevBtn = document.getElementById('months-prev')
  const nextBtn = document.getElementById('months-next')
  if (nextBtn) nextBtn.disabled = viewOffset === 0
  if (prevBtn) prevBtn.disabled = false // always allow going back

  for (let i = -2; i <= 0; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - viewOffset + i, 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    let monthHistory = history
    if (year.toString() !== currentYear) {
      const h = await getLocalStorage(year.toString())
      monthHistory = h?.[year.toString()] ?? {}
    }

    const block = document.createElement('div')
    block.className = 'month-block'

    const label = document.createElement('div')
    label.className = 'month-block-label'
    label.textContent = `${monthNames[month]} ${year}`
    block.appendChild(label)

    const grid = document.createElement('div')
    grid.className = 'monthly-grid'

    dayNames.forEach((name) => {
      const h = document.createElement('div')
      h.className = 'monthly-day-header'
      h.textContent = name
      grid.appendChild(h)
    })

    const firstDayRaw = new Date(year, month, 1).getDay()
    const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1
    for (let i = 0; i < firstDayMon; i++) {
      grid.appendChild(document.createElement('div'))
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div')
      cell.className = 'monthly-day'

      const lbl = document.createElement('span')
      lbl.className = 'day-label'
      lbl.textContent = day
      cell.appendChild(lbl)

      const date = new Date(year, month, day)
      const isToday = date.toDateString() === today.toDateString()
      const isFuture = date > today
      const count = isFuture ? 0 : focusSessionCount(monthHistory, date)

      if (isFuture) {
        cell.classList.add('future')
      } else if (count > 0) {
        cell.dataset.done = 'true'
      }
      if (isToday) cell.classList.add('today')

      // hover tooltip — update text on enter only
      if (!isFuture) {
        const tipText = `${fullMonthNames[month]} ${day} · ${count} focus session${count !== 1 ? 's' : ''}`
        cell.addEventListener('mouseenter', (e) => showDayTooltip(e, tipText))
      }

      grid.appendChild(cell)
    }

    // move tooltip with mouse across the whole grid, hide only on grid leave
    grid.addEventListener('mousemove', (e) => {
      if (tooltip && tooltip.style.display !== 'none') {
        tooltip.style.left = `${e.clientX}px`
        tooltip.style.top = `${e.clientY - 36}px`
      }
    })
    grid.addEventListener('mouseleave', hideDayTooltip)

    block.appendChild(grid)
    container.appendChild(block)
  }
}
