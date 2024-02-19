import { createNotification, createState, getSessionStorage, getSyncStorage, initBackgroundJs, printer, setSessionStorage, setSyncStorage, storageChangesLogger, getTimeString } from "./utils.js"
import {
  PLAY,
  PAUSE,
  FOCUS,
  SHORTBREAK,
  LONGBREAK,
  CATWALKTIMERSTYLE,
  SIMPLETIMERSTYLE,
  DARKTHEME,
  LIGHTTHEME,
  NEWTABIDKEY,
  TIMERKEY,
  SETTINGSKEY
 } from "./constants.js"

let intervalId = createState(0)
const print = printer()

await initBackgroundJs()
storageChangesLogger()

async function startActualTimer(timer) {
  print.log('message received - start timer')
  const timerObj = {
    timer: {
      time: timer?.time ?? 0,
      status: PLAY,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0
    }
  }
  await setSessionStorage(timerObj)
  startTimer(chrome, timer?.time ?? 0)
}

async function pauseActualTimer(timer) {
  print.log('message received - pause timer')
  print.log(intervalId.getState())
  clearInterval(intervalId.getState())
  const timerObj = {
    timer: {
      time: timer?.time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0
    }
  }
  await setSessionStorage(timerObj)
  print.it('session -> paused')

}

async function stopActualTimer() {
  print.log('message received - stop timer')
  clearInterval(intervalId.getState())
  await setSessionStorage({[TIMERKEY]: null})
  const res = await getSessionStorage(NEWTABIDKEY)
  if(res?.newTabId) {
    await chrome.tabs.remove(res.newTabId)
    try{
      await setSessionStorage({[NEWTABIDKEY]: null})
    }catch{e=> console.log(e)}
  }
}
  
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  if (request.startTimer) {
    await startActualTimer(request?.timer)
  }
  else if(request.pauseTimer) {
    await pauseActualTimer(request?.timer)
  }
  else if(request.stopTimer) {
    await stopActualTimer()
  }
  else if(request.nextTimer) {
    await setNextTimer()
  }
  if(request.saveSettings) {
    await setSyncStorage(request.newSettings)
    chrome.runtime.sendMessage({status: 'saved'}).catch((e) => {})
  }
})

export function startTimer(chrome, t){
  let timer = 5
  print.log('start timer started 🌠')
  let intId = setInterval(async function() {
    timer--
    if (timer < 0) {
      print.log('start timer 🔚')
      clearInterval(intervalId.getState())
      await setNextTimer(true)
      chrome.action.setBadgeText({text: getTimeString(0)})
      chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
    }else {
      const timerString = getTimeString(timer)
      print.log('⏲ -> ' + timer +' '+ getTimeString(timer))
      chrome.action.setBadgeText({text: timerString})
      chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'})
      try{
        chrome.runtime.sendMessage({time: timerString})
      } catch{(e) => print.helper('error -> '+e)}
      const result = await getSessionStorage(TIMERKEY)
      const timerToStore = {
        timer: {
          time: timer,
          status: result.timer.status,
          type: result.timer.type,
          counts: result.timer.counts
        }
      }
      await setSessionStorage(timerToStore)
    }
  }, 1000)
  print.helper('INTERVAL-ID -> ' + intId)
  intervalId.setState(intId)
}
  
export async function resumeTimer(callback) {
  const result = await getSessionStorage(['timer', 'newTabId'])
  if(result?.newTabId && typeof callback !== 'function') {
    await chrome.tabs.remove(result.newTabId)
    try{
      await setSessionStorage({[NEWTABIDKEY]: null})
    } catch{e => console.log(e)}
  }
  chrome.action.setBadgeText({text: getTimeString(result.timer.time)})
  chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'})
    print.log('====> ▶')
    const timerObj = {
        time:  result.timer.time,
        status: PLAY,
        type: result.timer.type,
        counts: result.timer.counts
    }
    print.log('new timer -> ')
    print.log(timerObj)
    await chrome.runtime.sendMessage({startTimer: true, timer: timerObj})
    
    try{
      if(typeof callback === 'function') {
        callback()
      }
    } catch{e => console.log(e)}
}

export async function setNextTimer(timerEnds=false) {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const status = await getSessionStorage(TIMERKEY)
  let nextTimer = FOCUS
  let prevTimer = FOCUS
  print.log('setting next timer --------->')
  if(!status?.timer) return

  print.helper('NEXT ID  => ' + intervalId.getState())
  clearInterval(intervalId.getState())
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
  if(status?.timer?.type === FOCUS) {
    const interval = parseInt(settingsObj?.settings?.longBreak?.interval)
    if(!interval || (interval && status.timer.counts < interval)) {
      nextTimer = SHORTBREAK
      print.log('next is short break')
      chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.shortBreak.time * 60)})
      const timerToStore = {
        timer: {
          time: settingsObj.settings.shortBreak.time * 60,
          status: PAUSE,
          type: SHORTBREAK,
          counts: interval > 0 ? status.timer.counts : 0
        }
      }
      await setSessionStorage(timerToStore)
      print.log('session -> focus -> short')
    } else if(interval && interval > 0) {
      nextTimer = LONGBREAK
      print.log('next is long break')
      chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.longBreak.time * 60)})
      const timerToStore = {
        timer: {
          time: settingsObj.settings.longBreak.time * 60,
          status: PAUSE,
          type: LONGBREAK,
          counts: 0
        }
      }
      await setSessionStorage(timerToStore)
      print.log('session -> focus -> long')
    }
    chrome.runtime.sendMessage({updateNextTimer: true}).catch((e) => {})
  } else if(status?.timer?.type === SHORTBREAK) {
    prevTimer = SHORTBREAK
    print.log('next is focus after short one')
    chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.focus.time * 60)})
    const timerToStore = {
      timer: {
        time: settingsObj.settings.focus.time * 60,
        status: PAUSE,
        type: FOCUS,
        counts: status.timer.counts + 1
      }
    }
    await setSessionStorage(timerToStore)
    print.log('session -> short -> focus')
    chrome.runtime.sendMessage({updateNextTimer: true}).catch((e) => {})  
  } else if(status?.timer?.type === LONGBREAK) {
    prevTimer = LONGBREAK
    print.log('next is focus after long one')
    chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.focus.time * 60)})
    const timerToStore = {
      timer: {
        time: settingsObj.settings.focus.time * 60,
        status: PAUSE,
        type: FOCUS,
        counts: 0
      }
    }
    await setSessionStorage(timerToStore)
    print.log('session -> long -> focus')
    chrome.runtime.sendMessage({updateNextTimer: true}).catch((e) => {}) 
  }
  if(timerEnds) {
    await createNotification(prevTimer, nextTimer)
  }
}