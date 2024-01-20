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

chrome.storage.sync.get('settings').then(result => {
  console.log('initiate settings')
  console.log(result)
  if(!Object.keys(result).length) {
    chrome.storage.sync.set(settings)
    console.log('set')
  }
})

chrome.storage.sync.set({
  timer: {
    focus: false,
    shortBreak: false,
    longBreak: false
  }
})

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('message...')
  if (request.startTimer) {
    console.log('start')
    chrome.storage.sync.set({
      timer: {
        focus: true,
        shortBreak: false,
        longBreak: false
      }
    })
    startTimer(chrome)
  }
  else if(request.saveSettings) {
    console.log('save settings')
    console.log(request.newSettings)
    chrome.storage.sync.set(request.newSettings).then(() => {
      chrome.runtime.sendMessage({status: 'saved'})
    })
  }
});


