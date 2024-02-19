// status
export const STOP = 'Stop'
export const PLAY = 'Play'
export const PAUSE = 'Pause'

// type
export const FOCUS = 'Focus'
export const SHORTBREAK = 'Short Break'
export const LONGBREAK = 'Long Break'

// defaults
const defaultFocusTime = 25
const defaultShortBreakTime = 5
const defaultLongBreakTime = 15
const defaultInterval = 3

// timer styles
export const CATWALKTIMERSTYLE = 'catWalk'
export const SIMPLETIMERSTYLE = 'simple'

// themes
export const DARKTHEME = 'dark'
export const LIGHTTHEME = 'light'

// storage keys
export const SETTINGSKEY = 'settings'
export const TIMERKEY = 'timer'
export const NEWTABIDKEY = 'newTabId'

// others
export const tabNames = ['focus', 'settings']

export const defaultSettings = {
  settings: {
    focus: {
      time: defaultFocusTime,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    shortBreak: {
      time: defaultShortBreakTime,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    longBreak: {
      time: defaultLongBreakTime,
      interval: defaultInterval.toString(),
      desktopNotifcations: true,
      newTabNotifications: true
    },
    timerStyle: SIMPLETIMERSTYLE,
    theme: DARKTHEME
  }
    
}
