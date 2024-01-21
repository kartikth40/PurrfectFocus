import { setNewSettings, setFormValues, getTimeString } from "./utils.js"

const runBtn = document.querySelector('.focus-btn')
const timer = document.querySelector('.timer')
const focusBtn = document.querySelector('.focus-btn')
const stopBtn = document.querySelector('.focus-btn-stop')
const pauseBtn = document.querySelector('.focus-btn-pause')

const settingsForm = document.querySelector('#settings-form')
const saveBtn = document.querySelector('.submit-btn')

const tabNames = ['focus', 'settings']
const tabs = tabNames.map(tabName => ({
  btn: document.querySelector(`.${tabName}-tab-btn`),
  tab: document.querySelector(`.${tabName}-tab`)
}))

let settings = {}
let settingsChanged = false
let settingsSaved = false
let isPaused = false

// setup tabs system
setupTabsSystem()

// listening messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  // tick with timer
  if (request.time) {
    timer.innerText = request.time
  }
  // settings status change
  else if(request.status === 'saved') {
    saveBtn.classList.add('saved')
    saveBtn.innerText = 'Saved'
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      saveBtn.innerText = 'Save'
      settingsChanged = false
      settingsSaved = true
      saveBtn.disabled = true
    }, 1500);
  }
});

// on DOM loading
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('settings').then(store=> {
    console.log(store)
    settings = store.settings
    let timeInSeconds = settings.focus.time * 60
    timer.innerText = getTimeString(timeInSeconds)
    chrome.storage.session.get(['timerStatus','timer']).then(sessionStore => {
      if((sessionStore?.timerStatus?.status === 'play' || sessionStore?.timerStatus?.status === 'pause') && sessionStore?.timerStatus?.started) {
        timer.innerText = getTimeString(0)
        focusBtn.classList.add('active')
        focusBtn.innerText = 'Focusing'
        stopBtn.classList.add('active')
        pauseBtn.classList.add('active')
      }
      if(sessionStore?.timerStatus?.status === 'pause' && sessionStore?.timerStatus?.started) {
        isPaused = true
        timer.innerText = getTimeString(sessionStore.timerStatus.timer)
        chrome.action.setBadgeText({text: getTimeString(sessionStore.timerStatus.timer)});
        chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
        pauseBtn.classList.add('pause')
        focusBtn.innerText = 'Focusing paused'
      }
    })
    setFormValues(store)
    runBtn.addEventListener('click', () => {
      chrome.storage.session.get('timerStatus').then(status => {
        if(status?.timerStatus?.started) return
        chrome.storage.sync.get('settings').then(store=> {
          settings = store.settings
          timeInSeconds = settings.focus.time * 60
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.runtime.sendMessage({startTimer: true, time: timeInSeconds});
          });
        })
        console.log(focusBtn)
        focusBtn.classList.add('active')
        focusBtn.innerText = 'Focusing'
        stopBtn.classList.add('active')
        pauseBtn.classList.add('active')
      });
    })
  })

  pauseBtn.addEventListener('click', () => {
    if(!isPaused) {
      isPaused = true
      pauseBtn.classList.add('pause')
      chrome.runtime.sendMessage({pauseTimer: true})
      focusBtn.innerText = 'Focusing paused'
      chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
    }else {
      isPaused = false
      focusBtn.innerText = 'Focusing'
      pauseBtn.classList.remove('pause')
      chrome.storage.sync.get('timer').then(timer => {
        console.log(timer)
        chrome.action.setBadgeText({text: getTimeString(timer.timer)});
        chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
        chrome.runtime.sendMessage({startTimer: true, time: timer.timer});
      })
    }
  })

});

// on settings change
settingsForm.addEventListener('change', (e) => {
  settingsChanged = true
  saveBtn.disabled = false
})
 

// on settings submit
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if(!settingsChanged) return
  const formData = new FormData(e.target);
  const formValues = Object.fromEntries(formData);
  settings = setNewSettings(formValues)
  const timeInSeconds = settings.settings.focus.time * 60
  timer.innerText = getTimeString(timeInSeconds)
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.runtime.sendMessage({saveSettings: true, newSettings: settings});
  });
})


function setupTabsSystem() {
  tabs.forEach(({tab, btn}) => {
    btn.addEventListener('click', () => {
      if(btn.classList.contains('active')) return
      tabs.forEach(curTab => {
        if(curTab.btn.classList.contains('active')) {
          curTab.btn.classList.remove('active')
        }
        if(curTab.tab.classList.contains('active')) {
          curTab.tab.classList.remove('active')
        }
      })
      btn.classList.add('active')
      tab.classList.add('active')
    })
  })
  }