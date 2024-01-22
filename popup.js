import { setNewSettings, setFormValues, getTimeString, PLAY, PAUSE, FOCUS, SHORTBREAK, LONGBREAK, setNextTimer, STOP } from "./utils.js"

const timer = document.querySelector('.timer')
const focusBtn = document.querySelector('.focus-btn')
const focusTitle = document.querySelector('.focus-title')
const stopBtn = document.querySelector('.focus-btn-stop')
const nextBtn = document.querySelector('.focus-btn-next')

const settingsForm = document.querySelector('#settings-form')
const saveBtn = document.querySelector('.submit-btn')

const tabNames = ['focus', 'settings']
const tabs = tabNames.map(tabName => ({
  btn: document.querySelector(`.${tabName}-tab-btn`),
  tab: document.querySelector(`.${tabName}-tab`)
}))

let settingsObj = {}
let settingsChanged = false
let isPaused = false
let timerType = FOCUS

// setup tabs system
setupTabsSystem()

// listening messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  // tick with timer
  if (request.time) {
    timer.innerText = request.time
  }
  // settings status change
  if(request.status === 'saved') {
    saveBtn.classList.add('saved')
    saveBtn.innerText = 'Saved'
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      saveBtn.innerText = 'Save'
      settingsChanged = false
      saveBtn.disabled = true
    }, 1500);
  }

  if(request.nextTimer) {
    console.log('message received - nextTimer')
    updateNextTimer()
  }
});

const updateNextTimer = () => {
  console.log('udateNextTimer (UI change)')
  chrome.storage.session.get('timerStatus').then(result => {
    console.log('updated timerStatus -> ', result)
    focusBtn.innerText = 'Start Focusing'
    focusTitle.innerText = 'Start Focusing'
    if(!result?.timerStatus?.started) return
    focusBtn.innerText = 'Start ' + result.timerStatus.type
    focusTitle.innerText = result.timerStatus.type
    // to be continued
  })
}

const timeInSeconds = (type, settings) => {
  return type === SHORTBREAK ? settings.shortBreak.time * 60 
          : type === LONGBREAK ? settings.longBreak.time * 60 
          : settings.focus.time * 60
}

// on DOM loading
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('settings').then(store=> {
    settingsObj = store
    let settings = store.settings
    updateNextTimer()
    chrome.storage.session.get(['timerStatus','timer']).then(sessionStore => {
      timer.innerText = getTimeString(timeInSeconds(sessionStore?.timerStatus?.type, settings))
      if((sessionStore?.timerStatus?.status === PLAY || sessionStore?.timerStatus?.status === PAUSE) && sessionStore?.timer) {
        timer.innerText = getTimeString(sessionStore.timer)
        focusBtn.innerText = getFocusText(sessionStore.timerStatus)
        focusTitle.innerText = sessionStore.timerStatus.type
        stopBtn.classList.add('active')
        nextBtn.classList.add('active')
      }
      if(sessionStore?.timerStatus?.status === PAUSE && sessionStore?.timer) {
        isPaused = true
        timer.innerText = getTimeString(sessionStore.timer)
        chrome.action.setBadgeText({text: getTimeString(sessionStore.timer)});
        chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
        focusBtn.innerText = getFocusText(sessionStore.timerStatus)
        focusTitle.innerText = sessionStore.timerStatus.type
      }
    })
    setFormValues(store)
    focusBtn.addEventListener('click', () => {
      chrome.storage.session.get('timerStatus').then(status => {
        // if started already
        if(status?.timerStatus?.started) {
          if(!isPaused && status.timerStatus.status !== PAUSE) {
              // pause
              pauseTimer(status.timerStatus)
            }else {
              // resume
              resumeTimer(status.timerStatus)
            }
          }else {
            // initiate
            initiateTimer(status.timerStatus)
          }
        });
    })
    stopBtn.addEventListener('click', () => {
      stopTimer()
    })
    
    nextBtn.addEventListener('click', () => {
      chrome.storage.session.get('timerStatus').then(status => {
        pauseTimer(status.timerStatus)
        setNextTimer()
      })
    })
  })



});

const getFocusText = (status) => {
  console.log('--------------------')
  console.log(status)
  let text = ''
  if(!status.started || status.status === STOP) {
    return 'Start Focusing'
  }

  if(status.status === PLAY) {
    text += 'Pause'
  }else if(status.status === PAUSE) {
    text += 'Resume'
  }
  return text
}

const stopTimer = () => {
  console.log('stop timer')
  isPaused = false
  focusBtn.innerText = 'Start Focusing'
  focusTitle.innerText = 'Start Focusing'
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  timer.innerText = getTimeString(settingsObj.settings.focus.time * 60)
  chrome.runtime.sendMessage({stopTimer: true}).catch((e) => {})
  chrome.action.setBadgeText({text: ''});
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
}

const pauseTimer = (timerStatus) => {
  console.log('pause timer')
  isPaused = true
  chrome.storage.session.get('timer').then(timer => {
    console.log('while pausing -> ', timer.timer)
    chrome.runtime.sendMessage({pauseTimer: true, timerStatus: timerStatus, time: timer.timer}).catch((e) => {})
  })
  focusBtn.innerText = 'Resume'
  focusTitle.innerText = timerStatus.type
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
}

const resumeTimer = (timerStatus) => {
  console.log('resume timer')
  isPaused = false
  focusBtn.innerText = 'Pause'
  focusTitle.innerText = timerStatus.type
  chrome.storage.session.get('timer').then(timer => {
    console.log('while resuming -> ', timer.timer)
    chrome.action.setBadgeText({text: getTimeString(timer.timer)});
    chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
    chrome.runtime.sendMessage({startTimer: true, timerStatus: timerStatus, time: timer.timer}).catch((e) => {});
    // check pausing time lag
  })
}

const initiateTimer = (timerStatus) => {
  chrome.storage.sync.get('settings').then(store=> {
    settingsObj = store
    let settings = store.settings
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.runtime.sendMessage({startTimer: true, timerStatus: timerStatus, time: timeInSeconds(timerStatus?.type, settings)}).catch((e) => {});
    });
  })
  focusBtn.innerText = 'Pause' 
  focusTitle.innerText = timerStatus.type
  stopBtn.classList.add('active')
  nextBtn.classList.add('active')
}

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
  settingsObj = setNewSettings(formValues)
  const settings = settingsObj.settings
  chrome.storage.session.get('timerStatus').then(result => {
    timer.innerText = getTimeString(timeInSeconds(timeInSeconds(result.timerStatus.type, settings), settings))
  })
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.runtime.sendMessage({saveSettings: true, newSettings: settingsObj}).catch((e) => {});
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