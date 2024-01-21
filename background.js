import { startTimer } from "./utils.js";

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
    status: 'stop',
    type: {
      focus: false,
      shortBreak: false,
      longBreak: false
    }
  },
  timer: 0,
})

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.startTimer) {
    chrome.storage.session.set({
      timerStatus: {
        started: true,
        status: 'play',
        type: {
          focus: true,
          shortBreak: false,
          longBreak: false
        }
      },
      timer: request.time,
    })
    startTimer(chrome, request.time)
  }
  // else if(request.pauseTimer) {

  // }
  else if(request.saveSettings) {
    chrome.storage.sync.set(request.newSettings).then(() => {
      chrome.runtime.sendMessage({status: 'saved'})
    })
  }
});


