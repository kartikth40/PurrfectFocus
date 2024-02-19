import { DARKTHEME, FOCUS, LIGHTTHEME, LONGBREAK, SETTINGSKEY, SHORTBREAK, defaultSettings } from "./constants"

export function printer() {
  const allLogs = false
  const steps = true
  const helper = true

  return {
    log: (value) => {
      if(allLogs || steps) console.log(value)
    },
    helper: (value) => {
      if(allLogs || helper) console.log(value)
    },
    it: (value) => console.log(value)
  }
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
  const store = await getSettingsFromSyncStorage()
  if(!Object.keys(store).length) {
    await setSettingsToSyncStorage(defaultSettings)
  }
}

export function storageChangesLogger() {
  chrome.storage.onChanged.addListener(
    (changes, storageType) => {
      if(storageType === 'session') {
        if(changes?.timer) {
          print.helper('-> TIMER UPDATED -> ')
          print.helper("OLD VALUE" + changes.timer.oldValue)
          print.helper("NEW VALUE" + changes.timer.newValue)
        }
      }
      else if(storageType === 'sync') {
        if(changes.settings) {
          print.helper('-> SETTINGS UPDATED -> ')
          print.helper("OLD VALUE" + changes.settings.oldValue)
          print.helper("NEW VALUE" + changes.settings.newValue)
        }
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
    console.error('Error storing '+ Object.keys() +' in session storage: ', error)
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
    console.error('Error storing '+ Object.keys() +' in sync storage: ', error)
    return null
  }
}

export async function createNotification(prevTimer=FOCUS, nextTimer=FOCUS) {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  if(prevTimer === FOCUS) {
    if(settingsObj.settings.focus.desktopNotifcations) {
      const notificationId = `my-notification-${Date.now()}`
      chrome.notifications.create(
        notificationId,
        {
          iconUrl:"../assets/cat.png",
          message:"Take a " + nextTimer,
          title:"Break Time!",
          type:"basic"
        },
        ()=> {print.it('notify')}
      )
    }
    if(settingsObj.settings.focus.newTabNotifications) {
      chrome.tabs.create({url:"modules/newTab/over.html"},async function(tab){
        await setSessionStorage({[newTabId]: tab.id})
      })
    }
  }else if(prevTimer === SHORTBREAK) {
    if(settingsObj.settings.shortBreak.desktopNotifcations) {
      const notificationId = `my-notification-${Date.now()}`
      chrome.notifications.create(
        notificationId,
        {
          iconUrl:"../assets/cat.png",
          message:"Start Focusing Again",
          title:"FOCUS!",
          type:"basic"
        },
        ()=> {print.it('notify')}
      )
    }
    if(settingsObj.settings.shortBreak.newTabNotifications) {
      chrome.tabs.create({url:"modules/newTab/over.html"},async function(tab){
        await setSessionStorage({[newTabId]: tab.id})
      })
    }
    
  }else if(prevTimer === LONGBREAK) {
    if(settingsObj.settings.longBreak.desktopNotifcations) {
      const notificationId = `my-notification-${Date.now()}`
      chrome.notifications.create(
        notificationId,
        {
          iconUrl:"../assets/cat.png",
          message:"Good work you completed a set.",
          title:"Well Done!",
          type:"basic"
        },
        ()=> {print.it('notify')}
      )
    }
    if(settingsObj.settings.longBreak.newTabNotifications) {
      chrome.tabs.create({url:"modules/newTab/over.html"}, async function(tab){
        await setSessionStorage({[newTabId]: tab.id})
      })
    }
  }
}

export const timerDuration = (type, settings) => {
  return type === SHORTBREAK ? settings.shortBreak.time
          : type === LONGBREAK ? settings.longBreak.time
          : settings.focus.time
}

export const getTimeString = (t) => {
  let minutes = Math.floor(t / 60)
  let seconds = t % 60
  let minutesString = (minutes < 10 ? '0' : '') + minutes
  let secondsString = (seconds < 10 ? '0' : '') + seconds
  let time = minutesString + ':' + secondsString
  return time
}

export const setNewSettings = (formValues) => {
  return {
    settings: {
      focus: {
        time: parseInt(formValues.focusDuration),
        desktopNotifcations: formValues.focusDesktopNotification === 'on' ? true : false,
        newTabNotifications: formValues.focusNewTabNotification === 'on' ? true : false
      },
      shortBreak: {
        time: parseInt(formValues.shortBreakDuration),
        desktopNotifcations: formValues.shortBreakDesktopNotification === 'on' ? true : false,
        newTabNotifications: formValues.shortBreakNewTabNotification === 'on' ? true : false
      },
      longBreak: {
        time: parseInt(formValues.longBreakDuration),
        interval: formValues.longBreakInterval,
        desktopNotifcations: formValues.longBreakDesktopNotification === 'on' ? true : false,
        newTabNotifications: formValues.longBreakNewTabNotification === 'on' ? true : false
      },
      timerStyle: formValues.timerStyle,
      theme: formValues.theme === 'on' ? LIGHTTHEME : DARKTHEME
    }
  }
}

export const setFormValues = (data) => {
  const settings = data.settings
  document.querySelector('#focus-duration-input').value = settings.focus.time
  document.querySelector('#focus-desktop-notification').checked = settings.focus.desktopNotifcations
  document.querySelector('#focus-new-tab-notification').checked = settings.focus.newTabNotifications
  document.querySelector('#short-break-duration-input').value = settings.shortBreak.time
  document.querySelector('#short-break-desktop-notification').checked = settings.shortBreak.desktopNotifcations
  document.querySelector('#short-break-new-tab-notification').checked = settings.shortBreak.newTabNotifications
  document.querySelector('#interval-input').value = settings.longBreak.interval
  document.querySelector('#long-break-duration-input').value = settings.longBreak.time
  document.querySelector('#long-break-desktop-notification').checked = settings.longBreak.desktopNotifcations
  document.querySelector('#long-break-new-tab-notification').checked = settings.longBreak.newTabNotifications
  document.querySelector('#cat-walk-style').checked = settings.timerStyle === CATWALKTIMERSTYLE 
  document.querySelector('#simple-style').checked = settings.timerStyle === SIMPLETIMERSTYLE || settings.timerStyle !== CATWALKTIMERSTYLE
  document.querySelector('#app-theme').checked = settings.theme === LIGHTTHEME
}

export function changeTextTo(element, text) {
  if(element.innerText.toString().toLowerCase() === text.toString().toLowerCase()) return
  if(element === timer) {
    timerContainer.classList.add('changingTimer')
    setTimeout(() => {
      element.innerText = text
    }, 100)
    setTimeout(() => {
      timerContainer.classList.remove('changingTimer')
    }, 200)
  }else {
    element.classList.add('changingText')
    setTimeout(() => {
      element.innerText = text
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