import {
  CATWALKTIMERSTYLE,
  DARKTHEME,
  FOCUS,
  LIGHTTHEME,
  LONGBREAK,
  NEWTABTIMERIDKEY,
  SETTINGSKEY,
  SHORTBREAK,
  SIMPLETIMERSTYLE,
  TIMERKEY,
  STOP,
  PLAY,
  PAUSE,
  defaultSettings, 
  ALLLOGTYPE,
  STEPSLOGTYPE,
  HELPERLOGTYPE,
  STACKTRACELOGTYPE,
  DEVELOPING,
  breakQuotes,
  focusQuotes,
  NEWTABSETTINGSIDKEY,
  NEWTABHISTORYIDKEY} from "./constants.js"

const print = printer()

export function printer() {
  function print(message) {
    if(!DEVELOPING) return
    if(!STACKTRACELOGTYPE) console.log(message)
    else {
      const stackTrace = new Error().stack.split("\n")[3].trim()
      const time = getTime()
      if(typeof message === 'object') {
        console.log(`${JSON.stringify(message)} \n - ${stackTrace} - |${time}|`)
      }else{
        console.log(`${message} \n - ${stackTrace} - |${time}|`)
      }
    }
  }
  return {
    log: (message) => {
      if(ALLLOGTYPE || STEPSLOGTYPE) print(message)
    },
    helper: (message) => {
      if(ALLLOGTYPE || HELPERLOGTYPE) print(message)
    },
    it: (message) => {
      if(ALLLOGTYPE) print(message)
    }
  }
}

function getTime(concise=false) {
  let date = new Date();
  let hours = date.getHours().toString().padStart(2, '0')
  let minutes = date.getMinutes().toString().padStart(2, '0')
  if(concise) return `${hours}:${minutes}`
  let seconds = date.getSeconds().toString().padStart(2, '0')
  let milliseconds = date.getMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

export function createState(initialState) {
  let state = initialState

  return {
    getState: () => state,
    setState: (newState) => {
      state = newState
      print.helper("State updated: " + state)
    },
  }
}

export async function initBackgroundJs() {
  const store = await getSyncStorage(SETTINGSKEY)
  if(!Object.keys(store).length) {
    await setSyncStorage(defaultSettings)
  }
}

export function storageChangesLogger() {
  if(!DEVELOPING) return
  chrome.storage.onChanged.addListener(
    (changes, storageType) => {
      let oldValue = null
      let newValue = null
      if(storageType === 'session') {
        if(changes?.timer) {
          print.helper('-> TIMER UPDATED -> ')
          oldValue = changes.timer.oldValue
          newValue = changes.timer.newValue
        }
      }
      else if(storageType === 'sync') {
        if(changes?.settings) {
          print.helper('-> SETTINGS UPDATED -> ')
          oldValue = changes.settings.oldValue
          newValue = changes.settings.newValue
        }
      }
      if(oldValue) {
        oldValue.which = 'OLD VALUE'
        print.helper(oldValue)
      } 
      if(newValue) {
        newValue.which = 'NEW VALUE'
        print.helper(newValue)
      }
    }
  )
}

export async function getSessionStorage(key) {
  try {
    return await chrome.storage.session.get(key)
  } catch (error) {
    console.error('Error retrieving session storage for '+ key +': ', error)
    return null
  }
}

export async function setSessionStorage(obj) {
  try {
    return await chrome.storage.session.set(obj)
  } catch (error) {
    console.error('Error storing in session storage: ', error)
    return null
  }
}

export async function getSyncStorage(key) {
  try {
    return await chrome.storage.sync.get(key)
  } catch (error) {
    console.error('Error retrieving sync storage for '+ key +': ', error)
    return null
  }
}

export async function setSyncStorage(obj) {
  try {
    return await chrome.storage.sync.set(obj)
  } catch (error) {
    console.error('Error storing in sync storage: ', error)
    return null
  }
}

export async function getLocalStorage(key) {
  try {
    return await chrome.storage.local.get(key)
  } catch (error) {
    console.error('Error retrieving local storage for '+ key +': ', error)
    return null
  }
}

export async function setLocalStorage(obj) {
  try {
    return await chrome.storage.local.set(obj)
  } catch (error) {
    console.error('Error storing in local storage: ', error)
    return null
  }
}

export async function createNotification(prevTimer=FOCUS, nextTimer=FOCUS) {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  if(prevTimer === FOCUS) {
    if(settingsObj.settings.focus.notifications) {
      await createNewTabForTimers()
      const notificationId = `my-notification-${Date.now()}`
      await chrome.notifications.create(
        notificationId,
        {
          iconUrl:"../assets/cat.png",
          message:"Take a " + nextTimer,
          title:"Break Time!",
          type:"basic",
          silent: true,
          buttons:[
           { title: "Take a Break"}
          ]
        },
        ()=> {print.it('notify')}
      )
      await chrome.notifications.onButtonClicked.addListener(async function(notifId, btnIdx) {
        if (notifId === notificationId) {
            if (btnIdx === 0) {
              await chrome.windows.getCurrent({ populate: true },async function(currentWindow) {
                await chrome.windows.update(currentWindow.id, { focused: true }, async function() {})
              })
            }
        }
    })
    }
  }else if(prevTimer === SHORTBREAK) {
    if(settingsObj.settings.shortBreak.notifications) {
      await createNewTabForTimers()
      const notificationId = `my-notification-${Date.now()}`
      await chrome.notifications.create(
        notificationId,
        {
          iconUrl:"../assets/cat.png",
          message:"Start Focusing Again",
          title:"FOCUS!",
          type:"basic",
          silent: true,
          buttons:[
            { title: "Start Focusing"}
           ]
        },
        ()=> {print.it('notify')}
      )
      await chrome.notifications.onButtonClicked.addListener(async function(notifId, btnIdx) {
        if (notifId === notificationId) {
            if (btnIdx === 0) {
              await chrome.windows.getCurrent({ populate: true }, async function(currentWindow) {
                await chrome.windows.update(currentWindow.id, { focused: true }, async function() {})
              })
            }
        }
    })
    }
  }else if(prevTimer === LONGBREAK) {
    if(settingsObj.settings.longBreak.notifications) {
      await createNewTabForTimers()
      const notificationId = `my-notification-${Date.now()}`
      await chrome.notifications.create(
        notificationId,
        {
          iconUrl:"../assets/cat.png",
          message:"Good work you completed a set.",
          title:"Well Done!",
          type:"basic",
          silent: true,
          buttons:[
            { title: "Take a Break"}
           ]
        },
        ()=> {print.it('notify')}
      )
      await chrome.notifications.onButtonClicked.addListener(async function(notifId, btnIdx) {
        if (notifId === notificationId) {
            if (btnIdx === 0) {
              await chrome.windows.getCurrent({ populate: true }, async function(currentWindow) {
                await chrome.windows.update(currentWindow.id, { focused: true }, async function() {})
              })
            }
        }
    })
    }
  }
}

export async function createNewTabForTimers(notify=true) {
  const res = await getSessionStorage(NEWTABTIMERIDKEY)
  async function callback() {
    if (chrome.runtime.lastError) {
      await chrome.tabs.create({url:"modules/newTab/over.html", active: true}, async function(tab){
        await setSessionStorage({[NEWTABTIMERIDKEY]: tab.id})
        if(notify) {
          await chrome.storage.session.set({notificationTriggered:true})
          try {
            await chrome.runtime.sendMessage({notificationTriggered: true})
          }catch{e=>console.warn(e)}
        }
      })
    } else {
      // Tab exists
      await chrome.tabs.update(res[NEWTABTIMERIDKEY], {active: true}, async (tab) => { 
        if(notify) {
          try {
              await chrome.runtime.sendMessage({notificationTriggered: true})
            }catch{e=>console.warn(e)}
          }
        })
      }
    } 
    if(res[NEWTABTIMERIDKEY]) {
      await chrome.tabs.get(res[NEWTABTIMERIDKEY],callback);
    }else {
      await chrome.tabs.create({url:"modules/newTab/over.html", active: true}, async function(tab){
        await setSessionStorage({[NEWTABTIMERIDKEY]: tab.id})
        if(notify) {
          await chrome.storage.session.set({notificationTriggered:true})
          try {
            await chrome.runtime.sendMessage({notificationTriggered: true})
          }catch{e=>console.warn(e)}
        }
      })
    }
}

export async function createNewTabForSettings() {
  const res = await getSessionStorage(NEWTABSETTINGSIDKEY)
  if(res[NEWTABSETTINGSIDKEY]) {
    await chrome.tabs.get(res[NEWTABSETTINGSIDKEY],callback);
  }else {
    await chrome.tabs.create({url:"modules/settings/settings.html", active: true}, async function(tab){
      await setSessionStorage({[NEWTABSETTINGSIDKEY]: tab.id})
    })
  }
  async function callback() {
    if (chrome.runtime.lastError) {
      await chrome.tabs.create({url:"modules/settings/settings.html", active: true}, async function(tab){
        await setSessionStorage({[NEWTABSETTINGSIDKEY]: tab.id})
      })
    } else {
      // Tab exists
      await chrome.tabs.update(res[NEWTABSETTINGSIDKEY], {active: true}, async (tab) => {})
      }
    } 
}

export async function createNewTabForHistory() {
  const res = await getSessionStorage(NEWTABHISTORYIDKEY)
  if(res[NEWTABHISTORYIDKEY]) {
    await chrome.tabs.get(res[NEWTABHISTORYIDKEY],callback);
  }else {
    await chrome.tabs.create({url:"modules/history/history.html", active: true}, async function(tab){
      await setSessionStorage({[NEWTABHISTORYIDKEY]: tab.id})
    })
  }
  async function callback() {
    if (chrome.runtime.lastError) {
      await chrome.tabs.create({url:"modules/history/history.html", active: true}, async function(tab){
        await setSessionStorage({[NEWTABHISTORYIDKEY]: tab.id})
      })
    } else {
      // Tab exists
      await chrome.tabs.update(res[NEWTABHISTORYIDKEY], {active: true}, async (tab) => {})
      }
    } 
}

export async function resumeTimer (callback) {
  const result = await getSessionStorage([TIMERKEY, NEWTABTIMERIDKEY])
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
    try {
      await chrome.runtime.sendMessage({startTimer: true, timer: timerObj})
    }catch{e=>console.warn(e)}
    if(typeof callback === 'function') {
      try{callback()}
      catch{e => print.log(e)}
    }
}

export const timerDuration = (type, settings) => {
  return type === SHORTBREAK ? settings.shortBreak.time
          : type === LONGBREAK ? settings.longBreak.time
          : settings.focus.time
}

export function getTimeString(t) {
  // 00:00
  let minutes = Math.floor(t / 60)
  let seconds = t % 60
  let minutesString = (minutes < 10 ? '0' : '') + minutes
  let secondsString = (seconds < 10 ? '0' : '') + seconds
  let time = minutesString + ':' + secondsString
  return time
}

export function getCurrentTimeString() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export const setNewSettings = (formValues) => {
  return {
    settings: {
      focus: {
        time: parseInt(formValues.focusDuration),
        notifications: formValues.focusDesktopNotification === 'on' ? true : false,
        sound: formValues.focusTimerSound
      },
      shortBreak: {
        time: parseInt(formValues.shortBreakDuration),
        notifications: formValues.shortBreakDesktopNotification === 'on' ? true : false,
        sound: formValues.shortBreakTimerSound
      },
      longBreak: {
        time: parseInt(formValues.longBreakDuration),
        interval: formValues.longBreakInterval,
        notifications: formValues.longBreakDesktopNotification === 'on' ? true : false,
        sound: formValues.longBreakTimerSound
      },
      timerStyle: formValues.timerStyle,
      theme: formValues.theme === 'light' ? LIGHTTHEME : DARKTHEME
    }
  }
}

export const setFormValues = (data) => {
  const settings = data.settings
  document.querySelector('#focus-duration-input').value = settings.focus.time
  document.querySelector('#focus-desktop-notification').checked = settings.focus.notifications
  document.querySelector('#focus-timer-sound').value = settings.focus.sound
  document.querySelector('#short-break-duration-input').value = settings.shortBreak.time
  document.querySelector('#short-break-desktop-notification').checked = settings.shortBreak.notifications
  document.querySelector('#short-break-timer-sound').value = settings.shortBreak.sound
  document.querySelector('#interval-input').value = settings.longBreak.interval
  document.querySelector('#long-break-duration-input').value = settings.longBreak.time
  document.querySelector('#long-break-desktop-notification').checked = settings.longBreak.notifications
  document.querySelector('#long-break-timer-sound').value = settings.longBreak.sound
  document.querySelector('#cat-walk-style').checked = settings.timerStyle === CATWALKTIMERSTYLE 
  document.querySelector('#simple-style').checked = settings.timerStyle === SIMPLETIMERSTYLE || settings.timerStyle !== CATWALKTIMERSTYLE
  document.querySelector('#app-theme-light').checked = settings.theme === LIGHTTHEME
  document.querySelector('#app-theme-dark').checked = settings.theme === DARKTHEME
}

export function changeTextTo(element, text) {
  if(element.innerText.toString().toLowerCase() === text.toString().toLowerCase()) return
  const timerContainer = document.querySelector('.time-container')
  if(typeof timer !== 'undefined' && element === timer) {
    element.innerText = text
    timerContainer.classList.add('changingTimer')
    setTimeout(() => {
    }, 100)
    setTimeout(() => {
      timerContainer.classList.remove('changingTimer')
    }, 200)
  }else {
    element.innerText = text
    element.classList.add('changingText')
    setTimeout(() => {
    }, 100)
    setTimeout(() => {
      element.classList.remove('changingText')
    }, 200)
  }
}

export const getFocusText = (timer, settings) => {
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

export const getRandomBreakQuote = () => {
  const quotes = breakQuotes
  return quotes[Math.floor(Math.random()*quotes.length)]
}

export const getRandomFocusQuote = () => {
  const quotes = focusQuotes
  return quotes[Math.floor(Math.random()*quotes.length)]
}

export const setSampleHistory = async () => {
  const currentFullDate = new Date()
  const currentYear = currentFullDate.getFullYear().toString()
  const currentMonth = currentFullDate.getMonth() + 1

  const firstDayOfNextMonth = new Date(currentYear, currentMonth, 1)
  const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
  const monthData = {}

  for(let i = 1; i < lastDateOfCurrentMonth; i++) {
    const date = new Date(currentYear, currentMonth - 1, i)
    const currentDateWithMonth = date.getDate() + '-' + (date.getMonth() + 1)

    let noOfTimers = getRandomNumber(0, 10)
    let noOfFocusTimers = getRandomNumber(0, noOfTimers)
    let start = getRandomNumber(0, 720)
    const currentDayData = []
    for(let j = 0; j < noOfTimers; j++) {
      let type = 'focus' 
      let duration = 0
      let startTime = "00:00"
      let endTime = "00:00"
      if(noOfFocusTimers > 0 && getRandomNumber(0,1) === 0) {
        noOfFocusTimers--
        duration = getRandomNumber(10, 180)
      }else {
        type = 'break'
        duration = getRandomNumber(5, 120)
      }
      startTime = getTimeString(start)
      endTime = getTimeString(start+duration)
      start+= duration + getRandomNumber(0, 60)
      currentDayData.push({startTime: startTime, endTime: endTime, duration: duration, type: type})
    }
    monthData[currentDateWithMonth] = currentDayData
  }

  const sampleHistory = {[currentYear] : monthData}

  console.log(sampleHistory)

  await setSessionStorage(sampleHistory)
}

export async function clearHistory() {
  const currentFullDate = new Date()
  const currentYear = currentFullDate.getFullYear().toString()
  await setLocalStorage({[currentYear]: null})
}


export function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
  }
}

export function formatDateWithOrdinal(date) {
  const day = date.toLocaleString('default', { day: 'numeric' })
  const month = date.toLocaleString('default', { month: 'long' })
  const year = date.toLocaleString('default', { year: 'numeric' })

  const ordinalSuffix = getOrdinalSuffix(day)

  return `${month} ${day}${ordinalSuffix}, ${year}`
}