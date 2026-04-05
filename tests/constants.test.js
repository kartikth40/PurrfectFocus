import { describe, it, expect } from 'vitest'
import {
  DEVELOPING,
  FOCUS,
  BREAK,
  SHORTBREAK,
  LONGBREAK,
  STOP,
  PLAY,
  PAUSE,
  TASKS,
  TASKS_ALIAS,
  TASKS_COLORS,
  defaultSettings,
  defaultFocusTime,
  modes,
  DARKTHEME,
  LIGHTTHEME,
  SIMPLETIMERSTYLE,
  CATWALKTIMERSTYLE,
  SETTINGSKEY,
  TIMERKEY,
  breakQuotes,
  focusQuotes,
} from '../src/constants.js'

describe('DEVELOPING flag', () => {
  it('must be false for production builds', () => {
    expect(DEVELOPING).toBe(false)
  })
})

describe('timer status constants', () => {
  it('has all required statuses', () => {
    expect(STOP).toBe('Stop')
    expect(PLAY).toBe('Play')
    expect(PAUSE).toBe('Pause')
  })
})

describe('timer type constants', () => {
  it('has all required types', () => {
    expect(FOCUS).toBe('Focus')
    expect(BREAK).toBe('Break')
    expect(SHORTBREAK).toBe('Short Break')
    expect(LONGBREAK).toBe('Long Break')
  })
})

describe('TASKS', () => {
  it('has all 6 task categories', () => {
    expect(Object.keys(TASKS)).toHaveLength(6)
    expect(TASKS.WORK).toBe('Work')
    expect(TASKS.STUDY).toBe('Study')
    expect(TASKS.PERSONAL).toBe('Personal')
    expect(TASKS.CHORES).toBe('Chores')
    expect(TASKS.OTHER).toBe('Other')
    expect(TASKS.REST).toBe('Rest')
  })

  it('has matching aliases for every task', () => {
    for (const key of Object.values(TASKS)) {
      expect(TASKS_ALIAS).toHaveProperty(key)
    }
  })

  it('has matching colors for every task', () => {
    for (const key of Object.values(TASKS)) {
      expect(TASKS_COLORS).toHaveProperty(key)
      expect(TASKS_COLORS[key]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('modes', () => {
  it('has Pomodoro and Stopwatch', () => {
    expect(modes.POMODORO).toBe('Pomodoro')
    expect(modes.STOPWATCH).toBe('Stopwatch')
  })
})

describe('themes', () => {
  it('has dark and light', () => {
    expect(DARKTHEME).toBe('dark')
    expect(LIGHTTHEME).toBe('light')
  })
})

describe('timer styles', () => {
  it('has simple and catWalk', () => {
    expect(SIMPLETIMERSTYLE).toBe('simple')
    expect(CATWALKTIMERSTYLE).toBe('catWalk')
  })
})

describe('defaultSettings', () => {
  const s = defaultSettings.settings

  it('has valid focus defaults', () => {
    expect(s.focus.time).toBe(defaultFocusTime)
    expect(s.focus.time).toBeGreaterThan(0)
    expect(typeof s.focus.notifications).toBe('boolean')
    expect(typeof s.focus.autoStart).toBe('boolean')
    expect(typeof s.focus.sound).toBe('string')
  })

  it('has valid short break defaults', () => {
    expect(s.shortBreak.time).toBeGreaterThan(0)
    expect(s.shortBreak.time).toBeLessThan(s.focus.time)
  })

  it('has valid long break defaults', () => {
    expect(s.longBreak.time).toBeGreaterThan(s.shortBreak.time)
    expect(Number(s.longBreak.interval)).toBeGreaterThan(0)
  })

  it('has valid theme and style defaults', () => {
    expect([DARKTHEME, LIGHTTHEME]).toContain(s.theme)
    expect([SIMPLETIMERSTYLE, CATWALKTIMERSTYLE]).toContain(s.timerStyle)
  })

  it('has valid mode default', () => {
    expect([modes.POMODORO, modes.STOPWATCH]).toContain(s.mode)
  })
})

describe('quotes', () => {
  it('has break quotes', () => {
    expect(breakQuotes.length).toBeGreaterThan(0)
    breakQuotes.forEach(q => expect(typeof q).toBe('string'))
  })

  it('has focus quotes', () => {
    expect(focusQuotes.length).toBeGreaterThan(0)
    focusQuotes.forEach(q => expect(typeof q).toBe('string'))
  })
})

describe('storage keys', () => {
  it('has required keys as non-empty strings', () => {
    expect(SETTINGSKEY).toBe('settings')
    expect(TIMERKEY).toBe('timer')
  })
})
