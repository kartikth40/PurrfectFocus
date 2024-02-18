import { setNewSettings, setFormValues, getTimeString, PLAY, PAUSE, FOCUS, STOP, resumeTimer , timerDuration, printer, SHORTBREAK, LONGBREAK, SIMPLETIMERSTYLE, LIGHTTHEME} from "./background.js"

const container = document.querySelector('.container')
const timerContainer = document.querySelector('.time-container')
const timer = document.querySelector('.timer')
const focusBtn = document.querySelector('.focus-btn')
const focusBtnText = document.querySelector('#focus-btn-text')
const focusTitle = document.querySelector('.focus-title')
const untilLongBreakCount = document.querySelector('#until-long')
const focusText = document.querySelector('.focus-text')
const stopBtn = document.querySelector('.focus-btn-stop')
const nextBtn = document.querySelector('.focus-btn-next')
const timerTag = document.querySelector('.timer-tag')

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

function changeTextTo(element, text) {
  if(element.innerText.toString().toLowerCase() === text.toString().toLowerCase()) return
  if(element === timer) {
    timerContainer.classList.add('changingTimer')
    setTimeout(() => {
      element.innerText = text
    }, 100);
    setTimeout(() => {
      timerContainer.classList.remove('changingTimer')
    }, 200);
  }else {
    element.classList.add('changingText')
    setTimeout(() => {
      element.innerText = text
    }, 100);
    setTimeout(() => {
      element.classList.remove('changingText')
    }, 200);
  }
}

// listening messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  // tick with timer
  if (request.time) {
    changeTextTo(timer, request.time)
    print.log('UI --> ' + request.time)
  }
  // settings status change
  if(request.status === 'saved') {
    saveBtn.classList.add('saved')
    changeTextTo(saveBtn, 'Saved')
    settingsChanged = false
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      changeTextTo(saveBtn, 'Save')
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
    changeTextTo(focusBtnText, 'Start Focusing')
    changeTextTo(focusTitle, 'Start Focusing')
    chrome.storage.sync.get('settings').then(settingsObj => {
      handleUntilLongBreakCount(settingsObj.settings, result.timer)
      if(!result?.timer) return
      changeTextTo(focusBtnText, 'Start ' + result.timer.type)
      changeTextTo(focusTitle, result.timer.type)
      // to be continued
    })
  })
}

function handleUntilLongBreakCount(settings, timer, tryOnce=false) {
  if(parseInt(settings.longBreak.interval) !== 0 && timer?.type !== LONGBREAK){
    changeTextTo(untilLongBreakCount, parseInt(settings.longBreak.interval) - (timer ? timer.counts : 0) + 1)
    focusText.style.visibility = 'visible'
  }else if(parseInt(settings.longBreak.interval) === 0){
    focusText.style.visibility = 'hidden'
  }
  if(!timer && !tryOnce) {
    chrome.storage.session.get('timer').then(sessionStore => {
      if(sessionStore.timer)
      handleUntilLongBreakCount(settings, sessionStore.timer, true)
    }) 
  }
}



// on DOM loading
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('settings').then(store=> {
    settingsObj = store
    let settings = store.settings
    // updateNextTimer()
    if(settings?.theme === LIGHTTHEME) {
      container.classList.add('light')
    }else container.classList.remove('light')
    if(settings?.timerStyle === SIMPLETIMERSTYLE) {
      timerTag.classList.remove('cat-walk')
      timerTag.classList.add('simple')
    }else {
      timerTag.classList.remove('simple')
      timerTag.classList.add('cat-walk')
    }
    chrome.storage.session.get('timer').then(sessionStore => {
      changeTextTo(timer, getTimeString(timerDuration(sessionStore?.timer?.type, settings)*60))
      handleUntilLongBreakCount(settings, sessionStore.timer)
      if(sessionStore?.timer?.type === LONGBREAK) changeTextTo( focusText, '')
      if(sessionStore?.timer && (sessionStore?.timer?.status === PLAY || sessionStore?.timer?.status === PAUSE)) {
        changeTextTo(timer, getTimeString(sessionStore.timer.time))
        changeTextTo(focusBtnText, getFocusText(sessionStore.timer, settings))
        changeTextTo(focusTitle, sessionStore.timer.type)
        stopBtn.classList.add('active')
        nextBtn.classList.add('active')
      }
      if(sessionStore?.timer && sessionStore?.timer?.status === PAUSE) {
        isPaused = true
        chrome.action.setBadgeText({text: getTimeString(sessionStore.timer.time)});
        chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
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
      stopTimer(settings)
    })
    
    nextBtn.addEventListener('click', () => {
      nextTimer()
    })
  })



});

function nextTimer() {
  chrome.runtime.sendMessage({nextTimer: true}).catch((e) => {})
}

const getFocusText = (timer, settings) => {
  if(timer.status === STOP) {
    return 'Start Focusing'
  }else if(timer.status === PLAY) {
    return 'Pause'
  }else if(timer.status === PAUSE) {
    if(timer.type === FOCUS && timer.time === settings.focus.time*60) return 'Start Focusing'
    else if(timer.type === SHORTBREAK && timer.time === settings.shortBreak.time*60) return 'Start Short Break'
    else if(timer.type === LONGBREAK && timer.time === settings.longBreak.time*60) return 'Start Long Break'
    return 'Resume'
  }
}

const stopTimer = (settings) => {
  print.log('stop timer')
  isPaused = false
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  changeTextTo(timer, getTimeString(settings.focus.time * 60))
  chrome.runtime.sendMessage({stopTimer: true}).catch((e) => {})
  chrome.action.setBadgeText({text: ''})
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
  handleUntilLongBreakCount(settings, null)
}

const pause = (timer) => {
  print.log('pause timer')
  isPaused = true
  chrome.storage.session.get('timer').then(timer => {
    chrome.runtime.sendMessage({pauseTimer: true, timer: timer.timer}).catch((e) => {})
  })
  changeTextTo(focusBtnText, 'Resume')
  changeTextTo(focusTitle, timer.type)
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
}

const resume = (timer) => {
  print.log('resume timer')
  isPaused = false
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type)
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
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type ?? FOCUS)
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
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else container.classList.remove('light')
  if(settings?.timerStyle === SIMPLETIMERSTYLE) {
    timerTag.classList.remove('cat-walk')
    timerTag.classList.add('simple')
  }else {
    timerTag.classList.remove('simple')
    timerTag.classList.add('cat-walk')
  }
  chrome.storage.session.get('timer').then(result => {
    changeTextTo(timer, getTimeString(timerDuration(result.timer?.type ?? FOCUS, settings)*60))
  })
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.runtime.sendMessage({saveSettings: true, newSettings: settingsObj}).then(res => {
      chrome.storage.sync.get('settings').then(settingsObj => stopTimer(settingsObj.settings))
    }).catch((e) => {});
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