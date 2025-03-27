// logs
export const ALLLOGTYPE = false
export const STEPSLOGTYPE = false
export const HELPERLOGTYPE = false
export const STACKTRACELOGTYPE = false

// env
export const DEVELOPING = true

// status
export const STOP = 'Stop'
export const PLAY = 'Play'
export const PAUSE = 'Pause'

// type
export const FOCUS = 'Focus'
export const BREAK = 'Break'
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
export const LASTUPDATEKEY = 'lastDataUpdate'
export const CURRENTTASKKEY = 'currentTask'
export const NEWTABTIMERIDKEY = 'newTabTimerId'
export const NEWTABSETTINGSIDKEY = 'newTabSettingsId'
export const NEWTABHISTORYIDKEY = 'newTabHistoryId'
export const NEWTABSTREAKIDKEY = 'newTabStreakId'
export const TASKSALIASKEY = 'tasks_alias'

// others
export const tabNames = ['focus', 'settings']

export const defaultSettings = {
  settings: {
    focus: {
      time: defaultFocusTime,
      notifications: true,
      autoStart: false,
      sound: 'Dong'
    },
    shortBreak: {
      time: defaultShortBreakTime,
      notifications: true,
      autoStart: false,
      sound: 'Ding Dong'
    },
    longBreak: {
      time: defaultLongBreakTime,
      interval: defaultInterval.toString(),
      notifications: true,
      autoStart: false,
      sound: 'Computer Magic'
    },
    timerStyle: SIMPLETIMERSTYLE,
    theme: DARKTHEME,
    musicPlayer: true,
    musicPlayerAutoStart: true
  }
    
}

export const DAYS = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday"
}

export const chartColors = [
  '#FF8C69', // Soft Red
  '#85E085', // Light Green
  '#85A9FF', // Gentle Blue
  '#FF85C1', // Soft Pink
  '#FFD580', // Warm Yellow
  '#B39CD0'  // Muted Purple
]
export const chartBorderColors = [
  '#ffffff10',
  '#ffffff10',
  '#ffffff10',
  '#ffffff10',
  '#ffffff10',
  '#ffffff10'
]

export const TASKS = {
  WORK: "Work",
  STUDY: "Study",
  PERSONAL: "Personal",
  CHORES: "Chores",
  OTHER: "Other",
  REST: "Rest"
}
export const TASKS_ALIAS = {
  [TASKS.WORK]: "Work",
  [TASKS.STUDY]: "Study",
  [TASKS.PERSONAL]: "Personal",
  [TASKS.CHORES]: "Chores",
  [TASKS.OTHER]: "Other",
  [TASKS.REST]: "Rest"
}
export const TASKS_COLORS = {
  [TASKS.WORK]: "#b7d9ff",
  [TASKS.STUDY]: "#ffda9f",
  [TASKS.PERSONAL]: "#d5ffa9",
  [TASKS.CHORES]: "#feffae",
  [TASKS.OTHER]: "#c2c2c2",
  [TASKS.REST]: "#ffbdc7"
}


export const breakQuotes = [
  "Relax, Recharge and Reflect. Sometimes it's OK to do nothing.",
  "In this game, everyone needs a break to refuel, recharge, and jump back in full throttle.",
  "Almost everything will work again if you unplug it for a few minutes, including you.",
  "The opportunity to step away from everything and take a break is something that shouldn't be squandered.",
  "Is there a place you can go to break away for a little while? If you haven't yet built your tree house, it's never too late to start",
  "Try to pause each day and take a walk to view nature.",
  "Taking a break can lead to breakthroughs.",
  "When things are not happening as planned just stop worrying and take an unplanned break to regain yourself.",
  "Sometimes doing nothing makes way for everything.",
  "Birds chirping around you is a beautiful realisation that life in incredibly good. Let this sound be a gentle break in your routine.",
  "Don't underestimate the power of resting. It builds you back unlike anything.",
  "Resting is immensely powerful to ignite the glorious star within you. Power yourself by powering up your relaxing game.",
]

export const focusQuotes = [
  "The secret of getting ahead is getting started.",
  "The future depends on what you do today.",
  "Don't watch the clock; do what it does. Keep going.",
  "Focus on being productive instead of busy.",
  "Don't wait. The time will never be just right.",
  "The journey of a thousand miles begins with one step.",
  "Believe you can and you're halfway there.",
  "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.",
  "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.",
  "The bad news is time flies. The good news is you're the pilot.",
  "It does not matter how slowly you go as long as you do not stop.",
  "If there is no struggle, there is no progress.",
  "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
  "What you stay focused on will grow.",
  "Stay focused on the mission.",
  "What you focus on expands. So focus on what you want, not what you do not want.",
  "The successful warrior is the average man, with laser-like focus.",
  "The mind is like water. When it's turbulent, it's challenging to see. When it's calm, everything becomes clear.",
  "Complexity means distracted effort. Simplicity means focused effort.",
  "Time and energy are limited. Any successful person has to decide what to do in part by deciding what not to do.",
]