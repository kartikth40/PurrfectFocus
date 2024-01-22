import { FOCUS, PLAY, STOP, startTimer } from "./utils.js";

const settings = {
  settings: {
    focus: {
      time: 25,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    shortBreak: {
      time: 5,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    longBreak: {
      time: 15,
      interval: '3',
      desktopNotifcations: true,
      newTabNotifications: true
    }
  }
}
// let defaultSettings = true
// let newSettings = {}


chrome.storage.sync.get('settings').then(store => {
  if(!Object.keys(store).length) {
    chrome.storage.sync.set(settings)
  }
})

chrome.storage.session.set({
  timerStatus: {
    started: false,
    status: STOP,
    type: FOCUS
  },
  timer: 0,
  breakNo: 0
})


