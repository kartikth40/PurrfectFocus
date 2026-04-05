import { describe, it, expect } from 'vitest'
import {
  getTimeString,
  getValidTask,
  timerDuration,
  formatDateWithOrdinal,
  formatTimeWithLabel,
  getRandomNumber,
  createState,
  getFocusText,
  getFocusOptionsForTasks,
} from '../src/utils.js'
import {
  FOCUS,
  BREAK,
  SHORTBREAK,
  LONGBREAK,
  TASKS,
  STOP,
  PLAY,
  PAUSE,
  modes,
} from '../src/constants.js'

// ─── getTimeString ───

describe('getTimeString', () => {
  it('formats 0 seconds concise as "00s"', () => {
    expect(getTimeString(0)).toBe('00s')
  })

  it('formats seconds-only concise (under 60s)', () => {
    expect(getTimeString(45)).toBe('45s')
    expect(getTimeString(9)).toBe('09s')
  })

  it('formats minutes concise', () => {
    expect(getTimeString(60)).toBe('01m')
    expect(getTimeString(125)).toBe('02m')
    expect(getTimeString(1500)).toBe('25m')
  })

  it('formats full time string (non-concise)', () => {
    expect(getTimeString(0, false)).toBe('00:00')
    expect(getTimeString(61, false)).toBe('01:01')
    expect(getTimeString(1500, false)).toBe('25:00')
    expect(getTimeString(3599, false)).toBe('59:59')
  })

  it('handles large values', () => {
    expect(getTimeString(3600, false)).toBe('60:00')
    expect(getTimeString(7200, false)).toBe('120:00')
  })
})

// ─── getValidTask ───

describe('getValidTask', () => {
  it('returns the task if it is a valid TASKS value', () => {
    expect(getValidTask(TASKS.WORK)).toBe(TASKS.WORK)
    expect(getValidTask(TASKS.STUDY)).toBe(TASKS.STUDY)
    expect(getValidTask(TASKS.PERSONAL)).toBe(TASKS.PERSONAL)
    expect(getValidTask(TASKS.CHORES)).toBe(TASKS.CHORES)
    expect(getValidTask(TASKS.OTHER)).toBe(TASKS.OTHER)
    expect(getValidTask(TASKS.REST)).toBe(TASKS.REST)
  })

  it('defaults to WORK for invalid task during focus', () => {
    expect(getValidTask('InvalidTask')).toBe(TASKS.WORK)
    expect(getValidTask(null)).toBe(TASKS.WORK)
    expect(getValidTask(undefined)).toBe(TASKS.WORK)
    expect(getValidTask('')).toBe(TASKS.WORK)
  })

  it('defaults to REST for invalid task during break', () => {
    expect(getValidTask('InvalidTask', BREAK)).toBe(TASKS.REST)
    expect(getValidTask(null, BREAK)).toBe(TASKS.REST)
    expect(getValidTask(undefined, BREAK)).toBe(TASKS.REST)
  })

  it('returns valid task regardless of type parameter', () => {
    expect(getValidTask(TASKS.STUDY, BREAK)).toBe(TASKS.STUDY)
    expect(getValidTask(TASKS.REST, FOCUS)).toBe(TASKS.REST)
  })
})

// ─── timerDuration ───

describe('timerDuration', () => {
  const settings = {
    focus: { time: 25 },
    shortBreak: { time: 5 },
    longBreak: { time: 15 },
  }

  it('returns focus time for FOCUS type', () => {
    expect(timerDuration(FOCUS, settings)).toBe(25)
  })

  it('returns short break time for SHORTBREAK type', () => {
    expect(timerDuration(SHORTBREAK, settings)).toBe(5)
  })

  it('returns long break time for LONGBREAK type', () => {
    expect(timerDuration(LONGBREAK, settings)).toBe(15)
  })

  it('defaults to focus time for unknown type', () => {
    expect(timerDuration('Unknown', settings)).toBe(25)
  })
})


// ─── formatDateWithOrdinal ───

describe('formatDateWithOrdinal', () => {
  it('formats date with "st" suffix', () => {
    const result = formatDateWithOrdinal(new Date(2026, 0, 1))
    expect(result).toMatch(/January 1st, 2026/)
  })

  it('formats date with "nd" suffix', () => {
    const result = formatDateWithOrdinal(new Date(2026, 0, 2))
    expect(result).toMatch(/January 2nd, 2026/)
  })

  it('formats date with "rd" suffix', () => {
    const result = formatDateWithOrdinal(new Date(2026, 0, 3))
    expect(result).toMatch(/January 3rd, 2026/)
  })

  it('formats date with "th" suffix for 4-20', () => {
    const result4 = formatDateWithOrdinal(new Date(2026, 0, 4))
    expect(result4).toMatch(/January 4th, 2026/)

    const result11 = formatDateWithOrdinal(new Date(2026, 0, 11))
    expect(result11).toMatch(/January 11th, 2026/)

    const result12 = formatDateWithOrdinal(new Date(2026, 0, 12))
    expect(result12).toMatch(/January 12th, 2026/)

    const result13 = formatDateWithOrdinal(new Date(2026, 0, 13))
    expect(result13).toMatch(/January 13th, 2026/)

    const result20 = formatDateWithOrdinal(new Date(2026, 0, 20))
    expect(result20).toMatch(/January 20th, 2026/)
  })

  it('formats 21st, 22nd, 23rd correctly', () => {
    expect(formatDateWithOrdinal(new Date(2026, 0, 21))).toMatch(/21st/)
    expect(formatDateWithOrdinal(new Date(2026, 0, 22))).toMatch(/22nd/)
    expect(formatDateWithOrdinal(new Date(2026, 0, 23))).toMatch(/23rd/)
  })

  it('formats 31st correctly', () => {
    expect(formatDateWithOrdinal(new Date(2026, 0, 31))).toMatch(/31st/)
  })
})

// ─── formatTimeWithLabel ───

describe('formatTimeWithLabel', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTimeWithLabel(null)).toBe('')
    expect(formatTimeWithLabel(undefined)).toBe('')
    expect(formatTimeWithLabel('')).toBe('')
  })

  it('formats morning time (5-11) with sun emoji', () => {
    const result = formatTimeWithLabel('08:30')
    expect(result).toBe('☀️ 8:30 AM')
  })

  it('formats afternoon time (12-16) with bright sun emoji', () => {
    const result = formatTimeWithLabel('14:05')
    expect(result).toBe('🌞 2:05 PM')
  })

  it('formats evening time (17-20) with sunset emoji', () => {
    const result = formatTimeWithLabel('18:00')
    expect(result).toBe('🌅 6:00 PM')
  })

  it('formats night time (21-4) with moon emoji', () => {
    expect(formatTimeWithLabel('23:15')).toBe('🌙 11:15 PM')
    expect(formatTimeWithLabel('02:00')).toBe('🌙 2:00 AM')
  })

  it('formats midnight as 12 AM', () => {
    expect(formatTimeWithLabel('00:00')).toBe('🌙 12:00 AM')
  })

  it('formats noon as 12 PM', () => {
    expect(formatTimeWithLabel('12:00')).toBe('🌞 12:00 PM')
  })
})

// ─── getRandomNumber ───

describe('getRandomNumber', () => {
  it('returns a number within the range', () => {
    for (let i = 0; i < 100; i++) {
      const result = getRandomNumber(1, 10)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(10)
    }
  })

  it('returns min when min equals max', () => {
    expect(getRandomNumber(5, 5)).toBe(5)
  })

  it('returns an integer', () => {
    const result = getRandomNumber(1, 100)
    expect(Number.isInteger(result)).toBe(true)
  })
})

// ─── createState ───

describe('createState', () => {
  it('returns initial state', () => {
    const state = createState(42)
    expect(state.getState()).toBe(42)
  })

  it('updates state', () => {
    const state = createState('initial')
    state.setState('updated')
    expect(state.getState()).toBe('updated')
  })

  it('handles null and undefined', () => {
    const state = createState(null)
    expect(state.getState()).toBe(null)
    state.setState(undefined)
    expect(state.getState()).toBe(undefined)
  })

  it('handles object state', () => {
    const state = createState({ count: 0 })
    expect(state.getState()).toEqual({ count: 0 })
    state.setState({ count: 1 })
    expect(state.getState()).toEqual({ count: 1 })
  })
})

// ─── getFocusText ───

describe('getFocusText', () => {
  const pomodoroSettings = {
    mode: modes.POMODORO,
    focus: { time: 25 },
    shortBreak: { time: 5 },
    longBreak: { time: 15 },
  }

  const stopwatchSettings = {
    mode: modes.STOPWATCH,
    focus: { time: 25 },
    shortBreak: { time: 5 },
    longBreak: { time: 15 },
  }

  it('returns "Start Focusing" when stopped', () => {
    expect(getFocusText({ status: STOP }, pomodoroSettings)).toBe('Start Focusing')
  })

  it('returns "Pause" when playing in pomodoro mode', () => {
    expect(getFocusText({ status: PLAY }, pomodoroSettings)).toBe('Pause')
  })

  it('returns "Running..." when playing in stopwatch mode', () => {
    expect(getFocusText({ status: PLAY }, stopwatchSettings)).toBe('Running...')
  })

  it('returns "Start Focusing" when paused at full focus time', () => {
    const timer = { status: PAUSE, type: FOCUS, time: 25 * 60 }
    expect(getFocusText(timer, pomodoroSettings)).toBe('Start Focusing')
  })

  it('returns "Start Short Break" when paused at full short break time', () => {
    const timer = { status: PAUSE, type: SHORTBREAK, time: 5 * 60 }
    expect(getFocusText(timer, pomodoroSettings)).toBe('Start Short Break')
  })

  it('returns "Start Long Break" when paused at full long break time', () => {
    const timer = { status: PAUSE, type: LONGBREAK, time: 15 * 60 }
    expect(getFocusText(timer, pomodoroSettings)).toBe('Start Long Break')
  })

  it('returns "Resume" when paused mid-session', () => {
    const timer = { status: PAUSE, type: FOCUS, time: 500 }
    expect(getFocusText(timer, pomodoroSettings)).toBe('Resume')
  })
})

// ─── getFocusOptionsForTasks ───

describe('getFocusOptionsForTasks', () => {
  it('generates options for all tasks except REST', () => {
    const html = getFocusOptionsForTasks({})
    expect(html).toContain('Work')
    expect(html).toContain('Study')
    expect(html).toContain('Personal')
    expect(html).toContain('Chores')
    expect(html).toContain('Other')
    expect(html).not.toContain('>Rest<')
  })

  it('uses aliases when provided', () => {
    const aliases = { Work: 'Job', Study: 'Learning' }
    const html = getFocusOptionsForTasks(aliases)
    expect(html).toContain('Job')
    expect(html).toContain('Learning')
    expect(html).toContain('Personal')
  })

  it('returns valid HTML option elements', () => {
    const html = getFocusOptionsForTasks({})
    const optionCount = (html.match(/<option/g) || []).length
    // 5 tasks (all except REST)
    expect(optionCount).toBe(5)
  })
})
