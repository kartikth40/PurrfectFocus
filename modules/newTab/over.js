import { SETTINGSKEY, TIMERKEY, FOCUS, SHORTBREAK, LONGBREAK, PAUSE, PLAY, LIGHTTHEME, SIMPLETIMERSTYLE } from "../constants.js"
import { changeTextTo, createNewTabForHistory, createNewTabForSettings, getFocusText, getRandomBreakQuote, getRandomFocusQuote, getSessionStorage, getSyncStorage, getTimeString, printer, resumeTimer, timerDuration } from "../utils.js"

const container = document.querySelector('.container')
const focusTitle = document.querySelector('.focus-title')
const focusBtn = document.querySelector('.focus-btn')
const focusBtnText = document.querySelector('.focus-btn-text')
const timerTag = document.querySelector('.timer-tag')
const timerEle = document.querySelector('.timer')
const untilLongBreakCount = document.querySelector('#until-long-count')
const untilLongBreak = document.querySelector('.until-long')
const stopBtn = document.querySelector('.focus-btn-stop')
const nextBtn = document.querySelector('.focus-btn-next')
const quote = document.querySelector('.quote')
const breakActivitiesSuggestions = document.querySelector('.break-suggestions-container')
const settingsBtn = document.querySelector('.settings-tab-btn')
const historyBtn = document.querySelector('.history-tab-btn')

const print = printer()
let isPaused = false
document.addEventListener('DOMContentLoaded', async () => {
  handleNotificationTone(true)
  addEventListeners()
  await init()
})

async function init() {

  const timer = await getSessionStorage(TIMERKEY)
  if(!timer?.timer || timer?.timer?.type === FOCUS) {
    untilLongBreak.style.visibility = 'visible'
    focusTitle.innerText = 'Start Focusing'
    focusBtnText.innerText = 'Start Focusing'
    breakActivitiesSuggestions.classList.remove('show')
    updateFocusQuote()
  }
  else if(timer.timer.type === SHORTBREAK) {
    untilLongBreak.style.visibility = 'visible'
    focusTitle.innerText = 'Take a Short Break'
    focusBtnText.innerText = 'Start Short Break'
    breakActivitiesSuggestions.classList.add('show')
    updateBreakQuote()
  }else {
    untilLongBreak.style.visibility = 'hidden'
    focusTitle.innerText = 'Take a Long Break'
    focusBtnText.innerText = 'Start Long Break'
    breakActivitiesSuggestions.classList.add('show')
    updateBreakQuote()
  }
  const store = await getSyncStorage(SETTINGSKEY)
  let settings = store.settings
  loadSettings(settings)
  const interval = parseInt(settings.longBreak.interval)
  const timerCounts = timer.timer ? timer.timer.counts : 0
  untilLongBreakCount.innerText = interval - timerCounts + 1
  await handleUntilLongBreakCount(settings, timer.timer)
  if(timer?.timer?.type === LONGBREAK) changeTextTo( untilLongBreak, '')
  if(timer?.timer && (timer?.timer?.status === PLAY || timer?.timer?.status === PAUSE)) {
    changeTextTo(timerEle, getTimeString(timer.timer.time))
    changeTextTo(focusBtnText, getFocusText(timer.timer, settings))
    stopBtn.classList.add('active')
    nextBtn.classList.add('active')
  }
  if(timer?.timer && timer?.timer?.status === PAUSE) {
    isPaused = true
    chrome.action.setBadgeText({text: getTimeString(timer.timer.time)})
    chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
  }
  if(!timer?.timer) {
    stopBtn.classList.remove('active')
    nextBtn.classList.remove('active')
  }
  
}

function addEventListeners() {
  chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    const timer = await getSessionStorage(TIMERKEY)
    // tick with timer
    if (request.time) {
      changeTextTo(timerEle, request.time)
    }
    if(request.notificationTriggered) {
      handleNotificationTone()
    }
    if(request.timerStarted){
      changeTextTo(focusBtnText, 'Pause')
      if(timer?.timer) changeTextTo(focusTitle, timer?.timer?.type)
    }
    else if(request.timerPaused){
      changeTextTo(focusBtnText, 'Resume')
      changeTextTo(focusTitle, timer.timer.type)
    }
    else if(request.updateNextTimer) {
      await updateNextTimer()
    }
    else if(request.timerStopped){
      changeTextTo(focusBtnText, 'Start Focusing')
      changeTextTo(focusTitle, 'Start Focusing')
      stopBtn.classList.remove('active')
      nextBtn.classList.remove('active')
      const store = await getSyncStorage(SETTINGSKEY)
      changeTextTo(timerEle, getTimeString(store.settings.focus.time * 60))
      await handleUntilLongBreakCount(store.settings, null)
    }
    else if(request.saveSettings){
      const store = await getSyncStorage(SETTINGSKEY)
      loadSettings(store.settings)
    }
  })

  focusBtn.addEventListener('click', async (event) => {
    event.stopPropagation()
    const timer = await getSessionStorage(TIMERKEY)
    // if started already
    if(timer?.timer) {
      print.log('Start -> ' + timer.timer.status)
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

  settingsBtn.addEventListener('click',async () => {
    await createNewTabForSettings()
  })
  historyBtn.addEventListener('click',async () => {
    await createNewTabForHistory()
  })

}

function loadSettings(settings) {
  if(settings?.theme === LIGHTTHEME) {
    document.body.classList.add('light')
    container.classList.add('light')
  }else {
    document.body.classList.remove('light')
    container.classList.remove('light')
  } 
  if(settings?.timerStyle === SIMPLETIMERSTYLE) {
    timerTag.classList.remove('cat-walk')
    timerTag.classList.add('simple')
  }else {
    timerTag.classList.remove('simple')
    timerTag.classList.add('cat-walk')
  }
  changeTextTo(timerEle, getTimeString(timerDuration(timer?.timer?.type, settings)*60))
}
const initiateTimer = async () => {
  const store = await getSyncStorage(SETTINGSKEY)
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

async function nextTimer() {
  try{
    await chrome.runtime.sendMessage({nextTimer: true})
  }catch{e=>console.warn(e)}
}


const stopTimer = async (settings) => {
  isPaused = false
  print.log('stop timer - new tab')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  changeTextTo(timerEle, getTimeString(settings.focus.time * 60))
  chrome.action.setBadgeText({text: ''})
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
  await handleUntilLongBreakCount(settings, null)
  try{
    await chrome.runtime.sendMessage({stopTimer: true})
  }catch{e=>console.warn(e)}
}

const updateNextTimer = async () => {
  print.log('udateNextTimer (new Tab UI change)')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  const result = await getSessionStorage(TIMERKEY)
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  await handleUntilLongBreakCount(settingsObj.settings, result.timer)
  changeTextTo(timerEle, getTimeString(timerDuration(result.timer.type, settingsObj?.settings)*60))
  if(!result?.timer || result?.timer?.type === FOCUS) {
    updateFocusQuote()
    return
  }
  updateBreakQuote()
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

const pause = async (timer) => {
  isPaused = true
  print.log('pause timer - new tab')
  changeTextTo(focusBtnText, 'Resume')
  changeTextTo(focusTitle, timer.type)
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
  try{
    await chrome.runtime.sendMessage({pauseTimer: true, timer: timer})
  }catch{e=>console.warn(e)}
}

const resume = async (timer) => {
  isPaused = false
  print.log('resume timer - new tab')
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type)
  await resumeTimer()
}

const updateBreakQuote = () => {
  // console.log('break')
  breakActivitiesSuggestions.classList.add('show')
  quote.innerText = getRandomBreakQuote()
}

const updateFocusQuote = () => {
  // console.log('focus')
  breakActivitiesSuggestions.classList.remove('show')
  quote.innerText = getRandomFocusQuote()
}

async function handleNotificationTone(fromSession=false) {
  let stopHere = false
  let timer = null
  let sound = 'Alarm Clock Old'
  await chrome.storage.session.get(['notificationTriggered', 'timer']).then( async res => {
    if(fromSession) {
      if(res.notificationTriggered) {
        await chrome.storage.session.set({notificationTriggered:false})
      }
      else stopHere = true
    }
    if(res?.timer) {
      timer = res.timer
    }
  })
  if(stopHere) return
  
  await chrome.storage.sync.get('settings').then( async res => {
    if(timer.type === FOCUS && res.settings.focus.notifications) {
      sound = res.settings.focus.sound
    }else if(timer.type === SHORTBREAK && res.settings.shortBreak.notifications) {
      sound = res.settings.shortBreak.sound
    }else if(timer.type === LONGBREAK && res.settings.longBreak.notifications) {
      sound = res.settings.longBreak.sound
    }
    else stopHere = true
  }) 
  if(stopHere || sound === 'None') return

  const notificationTone = new Audio(`/assets/audio/${sound}.mp3`)
  notificationTone.play()

  window.addEventListener('focus', function() {
    notificationTone.pause()
    notificationTone.currentTime = 0
  })

}