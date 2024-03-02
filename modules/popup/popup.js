import {
  printer,
  timerDuration,
  getTimeString,
  changeTextTo,
  getSessionStorage,
  getSyncStorage,
  getFocusText,
  resumeTimer, 
  createNewTabForTimers,
  createNewTabForSettings,
  createNewTabForHistory} from "../utils.js"
import {
  PLAY,
  PAUSE,
  FOCUS,
  LONGBREAK,
  SIMPLETIMERSTYLE,
  LIGHTTHEME,
  TIMERKEY,
  SETTINGSKEY
 } from "../constants.js"

const container = document.querySelector('.container')
const timer = document.querySelector('.timer')
const focusBtn = document.querySelector('.focus-btn')
const focusBtnText = document.querySelector('#focus-btn-text')
const focusTitle = document.querySelector('.focus-title')
const untilLongBreakCount = document.querySelector('#until-long-count')
const untilLongBreak = document.querySelector('.until-long')
const stopBtn = document.querySelector('.focus-btn-stop')
const nextBtn = document.querySelector('.focus-btn-next')
const timerTag = document.querySelector('.timer-tag')

const settingsBtn = document.querySelector('.settings-tab-btn')
const historyBtn = document.querySelector('.history-tab-btn')
const supportBtn = document.querySelector('.support-tab-btn')
const rateBtn = document.querySelector('.rate-tab-btn')

let isPaused = false

const print = printer()

// listening messages
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  // tick with timer
  if (request.time) {
    changeTextTo(timer, request.time)
    print.log('UI --> ' + request.time)
  }

  if(request.updateNextTimer) {
    await updateNextTimer()
  }
  else if(request.resumeTimer) {
    const status = await getSessionStorage(TIMERKEY)
    resume(status.timer)
  }
  else if(request.saveSettings) {
    const store = await getSyncStorage(SETTINGSKEY)
    if(store?.settings?.theme === LIGHTTHEME) {
      container.classList.add('light')
    }else container.classList.remove('light')
    if(store?.settings?.timerStyle === SIMPLETIMERSTYLE) {
      timerTag.classList.remove('cat-walk')
      timerTag.classList.add('simple')
    }else {
      timerTag.classList.remove('simple')
      timerTag.classList.add('cat-walk')
    }
  }
})

const updateNextTimer = async () => {
  print.log('udateNextTimer (UI change)')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  const result = await getSessionStorage(TIMERKEY)
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  await handleUntilLongBreakCount(settingsObj.settings, result.timer)
  changeTextTo(timer, getTimeString(timerDuration(result.timer.type, settingsObj?.settings)*60))
  if(!result?.timer || result?.timer?.type === FOCUS) return
  changeTextTo(focusBtnText, 'Start ' + result.timer.type)
  changeTextTo(focusTitle, result.timer.type)
}

async function handleUntilLongBreakCount(settings, timer, tryOnce=false) {
  if(parseInt(settings.longBreak.interval) !== 0 && timer?.type !== LONGBREAK){
    changeTextTo(untilLongBreakCount, parseInt(settings.longBreak.interval) - (timer ? timer.counts : 0) + 1)
    untilLongBreak.style.visibility = 'visible'
  }else{
    untilLongBreak.style.visibility = 'hidden'
  }
  if(!timer && !tryOnce) {
    const sessionStore = await getSessionStorage(TIMERKEY)
    if(sessionStore.timer)
    await handleUntilLongBreakCount(settings, sessionStore.timer, true)
  }
}

// on DOM loading
document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  let settingsObj = store
  let settings = store.settings
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
  const sessionStore = await getSessionStorage(TIMERKEY)
  changeTextTo(timer, getTimeString(timerDuration(sessionStore?.timer?.type, settings)*60))
  await handleUntilLongBreakCount(settings, sessionStore.timer)
  if(sessionStore?.timer?.type === LONGBREAK) changeTextTo( untilLongBreak, '')
  if(sessionStore?.timer && (sessionStore?.timer?.status === PLAY || sessionStore?.timer?.status === PAUSE)) {
    changeTextTo(timer, getTimeString(sessionStore.timer.time))
    changeTextTo(focusBtnText, getFocusText(sessionStore.timer, settings))
    changeTextTo(focusTitle, sessionStore.timer.type)
    stopBtn.classList.add('active')
    nextBtn.classList.add('active')
  }
  if(sessionStore?.timer && sessionStore?.timer?.status === PAUSE) {
    isPaused = true
    chrome.action.setBadgeText({text: getTimeString(sessionStore.timer.time)})
    chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
  }
  focusBtn.addEventListener('click', async () => {
    const timer = await getSessionStorage(TIMERKEY)
    // if started already
    if(timer?.timer) {
      print.log('Start -> ' + timer)
      if(!isPaused && timer.timer.status !== PAUSE) {
          // pause
          await pause(timer.timer)
        }else {
          // resume
          await resume(timer.timer)
        }
    }else {
      // initiate
      await initiateTimer()
    }
  })
  stopBtn.addEventListener('click',async () => {
    const store = await getSyncStorage(SETTINGSKEY)
    stopTimer(store.settings)
  })
  
  nextBtn.addEventListener('click', async () => {
    await nextTimer()
  })

  timerTag.addEventListener('click', async () => {
    await createNewTabForTimers(false)
  })

  settingsBtn.addEventListener('click',async () => {
    await createNewTabForSettings()
  })
  historyBtn.addEventListener('click',async () => {
    await createNewTabForHistory()
  })
  supportBtn.addEventListener('click',async function(event){
    event.preventDefault()
    chrome.tabs.create({ url: this.href, active: true })
  })
  rateBtn.addEventListener('click',async function(event){
    event.preventDefault()
    chrome.tabs.create({ url: this.href, active: true })
  })
})

async function nextTimer() {
  try{
    await chrome.runtime.sendMessage({nextTimer: true})
  }catch{e=>console.warn(e)}
}

const stopTimer = async (settings) => {
  print.log('stop timer')
  isPaused = false
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  changeTextTo(timer, getTimeString(settings.focus.time * 60))
  chrome.action.setBadgeText({text: ''})
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
  await handleUntilLongBreakCount(settings, null)
  try{
    await chrome.runtime.sendMessage({stopTimer: true})
  }catch{e=>console.warn(e)}
}

const pause = async (timer) => {
  print.log('pause timer')
  isPaused = true
  const timerObj = await getSessionStorage(TIMERKEY)
  try{
    await chrome.runtime.sendMessage({pauseTimer: true, timer: timerObj.timer})
  }catch{e=>console.warn(e)}
  changeTextTo(focusBtnText, 'Resume')
  changeTextTo(focusTitle, timer.type)
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
}

const resume = async (timer) => {
  print.log('resume timer')
  isPaused = false
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type)
  await resumeTimer()
}

const initiateTimer = async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  let settingsObj = store
  let settings = store.settings
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const timerObj = {
      time: timerDuration(FOCUS, settings)*60,
      status: PLAY,
      type: FOCUS,
      counts: 0
    }
    try{
      await chrome.runtime.sendMessage({startTimer: true, timer: timerObj})
    }catch{e=>console.warn(e)}
  })
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type ?? FOCUS)
  stopBtn.classList.add('active')
  nextBtn.classList.add('active')
}

 



// function setupTabsSystem() {
//   tabs.forEach(({tab, btn}) => {
//     btn.addEventListener('click', () => {
//       if(btn.classList.contains('active')) return
//       tabs.forEach(curTab => {
//         if(curTab.btn.classList.contains('active')) {
//           curTab.btn.classList.remove('active')
//         }
//         if(curTab.tab.classList.contains('active')) {
//           curTab.tab.classList.remove('active')
//         }
//       })
//       btn.classList.add('active')
//       tab.classList.add('active')
//     })
//   })
//   }