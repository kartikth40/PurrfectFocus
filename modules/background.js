import {
  createNotification,
  createState,
  getSessionStorage,
  getSyncStorage,
  initBackgroundJs,
  printer,
  setSessionStorage,
  setSyncStorage,
  storageChangesLogger,
  getTimeString, 
  setLocalStorage,
  getLocalStorage,
  getCurrentTimeString,
  checkUserActivity} from "./utils.js"
import {
  PLAY,
  PAUSE,
  FOCUS,
  SHORTBREAK,
  LONGBREAK,
  TIMERKEY,
  SETTINGSKEY,
  TASKS,
  DEVELOPING,
  BREAK
 } from "./constants.js"

let intervalId = createState(0)
const print = printer()


chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.tabs.create({url:"modules/userGuide/userGuide.html", active: true})
  }
  await initBackgroundJs();
  storageChangesLogger();
  const alarms = await chrome.alarms.getAll();
  if (!alarms.some(alarm => alarm.name === "checkActivity")) {
    chrome.alarms.create("checkActivity", { periodInMinutes: 1440 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkActivity") {
    await checkUserActivity();
  }
});

chrome.runtime.setUninstallURL("https://chromewebstore.google.com/detail/purrfect-pomodoro-timer-p/aobapnhgpjlldncjopmbbfeoomombhel/support?hl=en-GB")

async function startActualTimer(timer) {
  print.log('message received - start timer')
  const timerObj = {
    [TIMERKEY]: {
      time: timer?.time ?? 0,
      status: PLAY,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: getCurrentTimeString(),
      endTime: null,
      task: timer?.task ?? TASKS.WORK
    }
  }
  await setSessionStorage(timerObj)
  startTimer(chrome, timer?.time ?? 0)
  try{
    await chrome.runtime.sendMessage({timerStarted: true})
  }catch{e=>console.warn(e)}
}

async function pauseActualTimer(timer) {
  print.log('message received - pause timer')
  print.log(intervalId.getState())
  clearInterval(intervalId.getState())
  const timerObj = {
    [TIMERKEY]: {
      time: timer?.time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: timer?.startTime ?? getCurrentTimeString(),
      endTime: null,
      task: timer?.task ?? TASKS.WORK
    }
  }
  await setSessionStorage(timerObj)
  print.it('session -> paused')

}

async function stopActualTimer() {
  print.log('message received - stop timer')
  clearInterval(intervalId.getState())
  await setSessionStorage({[TIMERKEY]: null})
}
  
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  if (request.startTimer) {
    await startActualTimer(request?.timer)
  }
  else if(request.pauseTimer) {
    await pauseActualTimer(request?.timer)
    try{
      await chrome.runtime.sendMessage({timerPaused: true})
    }catch{e=>console.warn(e)}
  }
  else if(request.stopTimer) {
    await stopActualTimer()
    try{
      await chrome.runtime.sendMessage({timerStopped: true})
    }catch{e=>console.warn(e)}
  }
  else if(request.nextTimer) {
    await setNextTimer()
    try{
      await chrome.runtime.sendMessage({timerNext: true})
    }catch{e=>console.warn(e)}
  }
  if(request.saveSettings) {
    await setSyncStorage(request.newSettings)
    try{
      await chrome.runtime.sendMessage({settingsSaved: true})
    }catch{e=>console.warn(e)}
  }
})

const startTimer = async (chrome, timer) => {
  if(DEVELOPING) timer = 70
  print.log('start timer started 🌠')
  let intId = setInterval(async function() {
    timer--
    if (timer < 0) {
      print.log('start timer 🔚')
      clearInterval(intervalId.getState())
      chrome.action.setBadgeText({text: getTimeString(0)})
      chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
      const currentDate = new Date()
      const oldHistoryObj = await getLocalStorage(currentDate.getFullYear().toString())
      const oldHistory = oldHistoryObj[currentDate.getFullYear().toString()]
      const timerObj = await getSessionStorage(TIMERKEY)
      const settingsObj = await getSyncStorage(SETTINGSKEY)
      const currentDateWithMonth = currentDate.getDate()+'-'+(currentDate.getMonth()+1)
      const task = timerObj?.timer?.type !== FOCUS ? TASKS.REST : (timerObj?.timer?.task ?? TASKS.WORK)
      if(!oldHistory) {
        let startTime = timerObj?.timer?.startTime
        let endTime = getCurrentTimeString()
        let duration = timerObj?.timer?.type === SHORTBREAK 
                        ? settingsObj?.settings?.shortBreak?.time
                        : timerObj?.timer?.type === LONGBREAK
                        ? settingsObj?.settings?.longBreak?.time
                        : settingsObj?.settings?.focus?.time
        if(startTime && endTime) await setLocalStorage({[currentDate.getFullYear().toString()]: {
          [currentDateWithMonth]: [{
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            type: timerObj?.timer?.type === FOCUS ? FOCUS : BREAK,
            task: task
            }]
          } 
        })
      } else if(oldHistory[currentDateWithMonth]){
        let startTime = timerObj?.timer?.startTime
        let endTime = getCurrentTimeString()
        let duration = timerObj?.timer?.type === SHORTBREAK 
                        ? settingsObj?.settings?.shortBreak?.time
                        : timerObj?.timer?.type === LONGBREAK
                        ? settingsObj?.settings?.longBreak?.time
                        : settingsObj?.settings?.focus?.time
        let todaysPomodoros = oldHistory[currentDateWithMonth]
        todaysPomodoros.push({
          startTime: startTime,
          endTime: endTime,
          duration: duration,
          type: timerObj?.timer?.type === FOCUS ? FOCUS : BREAK,
          task: task
          })
        if(startTime && endTime) await setLocalStorage({[currentDate.getFullYear().toString()]: {
          [currentDateWithMonth]: todaysPomodoros,
            ...oldHistory
          } 
        })
      }
      else {
        let startTime = timerObj?.timer?.startTime
        let endTime = getCurrentTimeString()
        let duration = timerObj?.timer?.type === SHORTBREAK 
                        ? settingsObj?.settings?.shortBreak?.time
                        : timerObj?.timer?.type === LONGBREAK
                        ? settingsObj?.settings?.longBreak?.time
                        : settingsObj?.settings?.focus?.time
        if(startTime && endTime) await setLocalStorage({[currentDate.getFullYear().toString()]: {
          [currentDateWithMonth]: [{
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            type: timerObj?.timer?.type === FOCUS ? FOCUS : BREAK,
            task: task
            }],
            ...oldHistory
          } 
        })
      }
      await setNextTimer(true)
    }else {
      print.log('⏲ -> ' + timer +' '+ getTimeString(timer))
      chrome.action.setBadgeText({text: getTimeString(timer)})
      chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'})
      try{
        await chrome.runtime.sendMessage({time: getTimeString(timer, false)})
      } catch{(e) => console.warn(e)}
      const result = await getSessionStorage(TIMERKEY)
      const timerToStore = {
        [TIMERKEY]: {
          time: timer,
          status: result?.timer?.status,
          type: result?.timer?.type,
          counts: result?.timer?.counts,
          startTime: result?.timer?.startTime,
          endTime: null,
          task: result?.timer?.task ?? TASKS.WORK
        }
      }
      await setSessionStorage(timerToStore)
    }
  }, 1000)
  print.helper('INTERVAL-ID -> ' + intId)
  intervalId.setState(intId)
}
  


const setNextTimer = async (timerEnds=false) => {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const status = await getSessionStorage(TIMERKEY)
  let nextTimer = FOCUS
  let prevTimer = FOCUS
  print.log('setting next timer --------->')
  if(!status?.timer) return

  print.helper('NEXT ID  => ' + intervalId.getState())
  clearInterval(intervalId.getState())
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
  let timerToStore = {}
  if(status?.timer?.type === FOCUS) {
    const interval = parseInt(settingsObj?.settings?.longBreak?.interval)
    if(!interval || (interval && status.timer.counts < interval)) {
      nextTimer = SHORTBREAK
      print.log('next is short break')
      chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.shortBreak.time * 60)})
      timerToStore = {
        [TIMERKEY]: {
          time: settingsObj.settings.shortBreak.time * 60,
          status: PAUSE,
          type: SHORTBREAK,
          counts: interval > 0 ? status.timer.counts : 0,
          task: status?.timer?.task ?? TASKS.WORK
        }
      }
      await setSessionStorage(timerToStore)
      print.log('session -> focus -> short')
    } else if(interval && interval > 0) {
      nextTimer = LONGBREAK
      print.log('next is long break')
      chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.longBreak.time * 60)})
      timerToStore = {
        [TIMERKEY]: {
          time: settingsObj.settings.longBreak.time * 60,
          status: PAUSE,
          type: LONGBREAK,
          counts: 0,
          task: status?.timer?.task ?? TASKS.WORK
        }
      }
      await setSessionStorage(timerToStore)
      print.log('session -> focus -> long')
    }
    try{
      await chrome.runtime.sendMessage({updateNextTimer: true})
    }catch{e=>console.warn(e)}
  } else if(status?.timer?.type === SHORTBREAK) {
    prevTimer = SHORTBREAK
    print.log('next is focus after short one')
    chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.focus.time * 60)})
    timerToStore = {
      [TIMERKEY]: {
        time: settingsObj.settings.focus.time * 60,
        status: PAUSE,
        type: FOCUS,
        counts: status.timer.counts + 1,
        task: status?.timer?.task ?? TASKS.WORK
      }
    }
    await setSessionStorage(timerToStore)
    print.log('session -> short -> focus')
    try{
      await chrome.runtime.sendMessage({updateNextTimer: true})
    }catch{e=>console.warn(e)}
  } else if(status?.timer?.type === LONGBREAK) {
    prevTimer = LONGBREAK
    print.log('next is focus after long one')
    chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.focus.time * 60)})
    timerToStore = {
      [TIMERKEY]: {
        time: settingsObj.settings.focus.time * 60,
        status: PAUSE,
        type: FOCUS,
        counts: 0,
        task: status?.timer?.task ?? TASKS.WORK
      }
    }
    await setSessionStorage(timerToStore)
    print.log('session -> long -> focus')
    try{
      await chrome.runtime.sendMessage({updateNextTimer: true})
    }catch{e=>console.warn(e)}
  }
  if(timerEnds) {
    await createNotification(prevTimer, nextTimer)
  }
  if(nextTimer === SHORTBREAK && settingsObj?.settings?.shortBreak?.autoStart) {
    await startActualTimer(timerToStore.timer)
  } else if(nextTimer === LONGBREAK && settingsObj?.settings?.longBreak?.autoStart) {
    await startActualTimer(timerToStore.timer)
  } else if(nextTimer === FOCUS && settingsObj?.settings?.focus?.autoStart) {
    await startActualTimer(timerToStore.timer)
  }
}