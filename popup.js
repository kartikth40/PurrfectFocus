import { setNewSettings, setFormValues, getTimeString, PLAY, PAUSE, FOCUS, STOP, resumeTimer , timerDuration, printer} from "./background.js"

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

const print = printer()

// setup tabs system
setupTabsSystem()

// listening messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  // tick with timer
  if (request.time) {
    timer.innerText = request.time
    print.log('UI --> ' + request.time)
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

  if(request.updateNextTimer) {
    updateNextTimer()
  }
  else if(request.resumeTimer) {
    chrome.storage.session.get('timer').then(status => {
      resume(status.timer)
    })
  }
});

const updateNextTimer = () => {
  print.log('udateNextTimer (UI change)')
  chrome.storage.session.get('timer').then(result => {
    focusBtn.innerText = 'Start Focusing'
    focusTitle.innerText = 'Start Focusing'
    if(!result?.timer) return
    focusBtn.innerText = 'Start ' + result.timer.type
    focusTitle.innerText = result.timer.type
    // to be continued
  })
}



// on DOM loading
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('settings').then(store=> {
    settingsObj = store
    let settings = store.settings
    updateNextTimer()
    chrome.storage.session.get('timer').then(sessionStore => {
      timer.innerText = getTimeString(timerDuration(sessionStore?.timer?.type, settings)*60)
      if(sessionStore?.timer && (sessionStore?.timer?.status === PLAY || sessionStore?.timer?.status === PAUSE)) {
        timer.innerText = getTimeString(sessionStore.timer.time)
        focusBtn.innerText = getFocusText(sessionStore.timer)
        focusTitle.innerText = sessionStore.timer.type
        stopBtn.classList.add('active')
        nextBtn.classList.add('active')
      }
      if(sessionStore?.timer && sessionStore?.timer?.status === PAUSE) {
        isPaused = true
        timer.innerText = getTimeString(sessionStore.timer)
        chrome.action.setBadgeText({text: getTimeString(sessionStore.timer)});
        chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
        focusBtn.innerText = getFocusText(sessionStore.timer)
        focusTitle.innerText = sessionStore.timer.type
      }
    })
    setFormValues(store)
    focusBtn.addEventListener('click', () => {
      chrome.storage.session.get('timer').then(status => {
        // if started already
        if(status?.timer) {
          print.log('Start -> ' + status)
          if(!isPaused && status.timer.status !== PAUSE) {
              // pause
              pause(status.timer)
            }else {
              // resume
              resume(status.timer)
            }
          }else {
            // initiate
            initiateTimer()
          }
        });
    })
    stopBtn.addEventListener('click', () => {
      stopTimer()
    })
    
    nextBtn.addEventListener('click', () => {
      nextTimer()
    })
  })



});

function nextTimer() {
  chrome.runtime.sendMessage({nextTimer: true}).catch((e) => {})
}

const getFocusText = (status) => {
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
  print.log('stop timer')
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

const pause = (timer) => {
  print.log('pause timer')
  isPaused = true
  chrome.storage.session.get('timer').then(timer => {
    chrome.runtime.sendMessage({pauseTimer: true, timer: timer.timer}).catch((e) => {})
  })
  focusBtn.innerText = 'Resume'
  focusTitle.innerText = timer.type
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
}

const resume = (timer) => {
  print.log('resume timer')
  isPaused = false
  focusBtn.innerText = 'Pause'
  focusTitle.innerText = timer?.type
  resumeTimer()
}

const initiateTimer = () => {
  chrome.storage.sync.get('settings').then(store=> {
    settingsObj = store
    let settings = store.settings
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const timerObj = {
        time: timerDuration(FOCUS, settings)*60,
        status: PLAY,
        type: FOCUS,
        counts: 0
      }
      chrome.runtime.sendMessage({startTimer: true, timer: timerObj}).catch((e) => {});
    });
  })
  focusBtn.innerText = 'Pause' 
  focusTitle.innerText = timer?.type ?? FOCUS 
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
  chrome.storage.session.get('timer').then(result => {
    timer.innerText = getTimeString(timerDuration(result.timer.type, settings)*60)
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