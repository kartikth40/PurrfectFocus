// status
export const STOP = 'Stop'
export const PLAY = 'Play'
export const PAUSE = 'Pause'

// type
export const FOCUS = 'Focus'
export const SHORTBREAK = 'Short Break'
export const LONGBREAK = 'Long Break'

// defaults
const defaultFocusTime = 25
const defaultShortBreakTime = 5
const defaultLongBreakTime = 15
const defaultInterval = 3

// timer styles
export const CATWALKTIMERSTYLE = 'catWalk'
export const SIMPLETIMERSTYLE = 'simple'

let intervalId = createState(0)

const settings = {
  settings: {
    focus: {
      time: defaultFocusTime,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    shortBreak: {
      time: defaultShortBreakTime,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    longBreak: {
      time: defaultLongBreakTime,
      interval: defaultInterval.toString(),
      desktopNotifcations: true,
      newTabNotifications: true
    },
    timerStyle: CATWALKTIMERSTYLE
  }
}

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
const print = printer()

function createState(initialState) {
  let state = initialState;

  return {
    getState: () => state,
    setState: (newState) => {
      state = newState;
      print.helper("State updated: " + state);
    },
  };
}

chrome.storage.sync.get('settings').then(store => {
  if(!Object.keys(store).length) {
    chrome.storage.sync.set(settings)
  }
})

chrome.storage.onChanged.addListener(
  (changes, storageType) => {
    if(storageType === 'session') {
      if(changes?.timer) {
        print.helper('TIMER UPDATED -> ')
        print.helper(changes.timer.oldValue)
        print.helper(changes.timer.newValue)
      }
    }
    else if(storageType === 'sync') {
      if(changes.settings) {
        print.helper('SETTINGS UPDATED -> ')
        print.helper(changes.settings.oldValue)
        print.helper(changes.settings.newValue)
      }
    }
  }
)

function startActualTimer(timer) {
  print.log('message received - start timer')
  chrome.storage.session.set({
    timer: {
      time: timer?.time ?? 0,
      status: PLAY,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0
    },
  })
  startTimer(chrome, timer?.time ?? 0)
}

function pauseActualTimer(timer) {
  print.log('message received - pause timer')
  print.log(intervalId.getState())
  clearInterval(intervalId.getState())
  chrome.storage.session.set({
    timer: {
      time: timer?.time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0
    },
  }).then(res => print.it('session -> paused'))
}

function stopActualTimer() {
  print.log('message received - stop timer')
  clearInterval(intervalId.getState())
  chrome.storage.session.set({timer: null})
  chrome.storage.session.get('newTabId').then(res => {
    if(res.newTabId) {
      chrome.tabs.remove(res.newTabId).then(()=> {
        chrome.storage.session.set({newTabId: null})
      }).catch(e=> console.log(e))
    }
  })
}

  
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.startTimer) {
    startActualTimer(request?.timer)
  }
  else if(request.pauseTimer) {
    pauseActualTimer(request?.timer)
  }
  else if(request.stopTimer) {
    stopActualTimer()
  }
  else if(request.nextTimer) {
    setNextTimer()
  }
  if(request.saveSettings) {
    chrome.storage.sync.set(request.newSettings).then(() => {
      chrome.runtime.sendMessage({status: 'saved'}).catch((e) => {})
    })
  }
})

export function startTimer(chrome, timer){
  print.log('start timer started 🌠')
  let intId = setInterval(function() {
    timer--;
    if (timer < 0) {
      print.log('start timer 🔚')
      clearInterval(intervalId.getState());
      setNextTimer(true)
      chrome.action.setBadgeText({text: getTimeString(0)});
      chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
    }else {
      const timerString = getTimeString(timer)
      print.log('⏲ -> ' + timer +' '+ getTimeString(timer))
      chrome.action.setBadgeText({text: timerString});
      chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
      chrome.runtime.sendMessage({time: timerString}).then(res => {}).catch((e) => {print.helper('error -> '+e)});
      chrome.storage.session.get('timer').then(result => {
        chrome.storage.session.set({
          timer: {
            time: timer,
            status: result.timer.status,
            type: result.timer.type,
            counts: result.timer.counts
          }
        })
      })
    }
  }, 1000);
  print.helper('INTERVAL-ID -> ' + intId)
  intervalId.setState(intId)
}
  
function createNotification(prevTimer=FOCUS, nextTimer=FOCUS) {
  console.log('PREV TIMER -> ', prevTimer, 'NEXT TIMER -> ', nextTimer)
  chrome.storage.sync.get('settings').then(settingsObj => {
    if(prevTimer === FOCUS) {
      if(settingsObj.settings.focus.desktopNotifcations) {
        const notificationId = `my-notification-${Date.now()}`
        chrome.notifications.create(
          notificationId,
          {
            iconUrl:"assets/cat.png",
            message:"Take a " + nextTimer,
            title:"Break Time!",
            type:"basic"
          },
          ()=> {print.it('notify')}
        )
      }
      if(settingsObj.settings.focus.newTabNotifications) {
        chrome.tabs.create({url:"over.html"},function(tab){
          chrome.storage.session.set({newTabId: tab.id}).then(()=> console.log(tab.id))
        })
      }
    }else if(prevTimer === SHORTBREAK) {
      if(settingsObj.settings.shortBreak.desktopNotifcations) {
        const notificationId = `my-notification-${Date.now()}`
        chrome.notifications.create(
          notificationId,
          {
            iconUrl:"assets/cat.png",
            message:"Start Focusing Again",
            title:"FOCUS!",
            type:"basic"
          },
          ()=> {print.it('notify')}
        )
      }
      if(settingsObj.settings.shortBreak.newTabNotifications) {
        chrome.tabs.create({url:"over.html"}, function(tab){
          chrome.storage.session.set({newTabId: tab.id})
        })
      }
      
    }else if(prevTimer === LONGBREAK) {
      if(settingsObj.settings.longBreak.desktopNotifcations) {
        const notificationId = `my-notification-${Date.now()}`
        chrome.notifications.create(
          notificationId,
          {
            iconUrl:"assets/cat.png",
            message:"Good work you completed a set.",
            title:"Well Done!",
            type:"basic"
          },
          ()=> {print.it('notify')}
        )
      }
      if(settingsObj.settings.longBreak.newTabNotifications) {
        chrome.tabs.create({url:"over.html"}, function(tab){
          chrome.storage.session.set({newTabId: tab.id})
        })
      }
    }
  })
}
  
export const resumeTimer = (callback) => {
  chrome.storage.session.get(['timer', 'newTabId']).then(result => {
    if(result?.newTabId && typeof callback !== 'function') {
      chrome.tabs.remove(result.newTabId).then(()=> {
        chrome.storage.session.set({newTabId: null})
      })
    }
    chrome.action.setBadgeText({text: getTimeString(result.timer.time)});
    chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
      print.log('====> ▶')
      const timerObj = {
          time:  result.timer.time,
          status: PLAY,
          type: result.timer.type,
          counts: result.timer.counts
      }
      print.log('new timer -> ')
      print.log(timerObj)
      chrome.runtime.sendMessage({startTimer: true, timer: timerObj}).then(()=> {
        if(typeof callback === 'function') {
          callback()
        }
      }).catch((e) => {});
  })
}

export const timerDuration = (type, settings) => {
  return type === SHORTBREAK ? settings.shortBreak.time
          : type === LONGBREAK ? settings.longBreak.time
          : settings.focus.time
}

export function setNextTimer(timerEnds=false) {
  chrome.storage.sync.get('settings').then(settingsObj => {
    chrome.storage.session.get('timer').then(status => {
      let nextTimer = FOCUS
      let prevTimer = FOCUS
      print.log('setting next timer --------->')
      if(!status?.timer) return
      print.helper('NEXT ID  => ' + intervalId.getState())
      clearInterval(intervalId.getState())
      chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'});
      if(status?.timer?.type === FOCUS) {
          const interval = parseInt(settingsObj?.settings?.longBreak?.interval)
          if(!interval || (interval && status.timer.counts < interval)) {
            nextTimer = SHORTBREAK
          print.log('next is short break')
            chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.shortBreak.time * 60)});
            chrome.storage.session.set({
              timer: {
                time: settingsObj.settings.shortBreak.time * 60,
                status: PAUSE,
                type: SHORTBREAK,
                counts: interval > 0 ? status.timer.counts : 0
              }
            }).then(res => print.log('session -> focus -> short'))
          } else if(interval && interval > 0) {
            nextTimer = LONGBREAK
          print.log('next is long break')
            chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.longBreak.time * 60)});
            chrome.storage.session.set({
              timer: {
                time: settingsObj.settings.longBreak.time * 60,
                status: PAUSE,
                type: LONGBREAK,
                counts: 0
              },
            }).then(res => print.log('session -> focus -> long'))
          }
          chrome.runtime.sendMessage({updateNextTimer: true}).catch((e) => {})
      } else if(status?.timer?.type === SHORTBREAK) {
        prevTimer = SHORTBREAK
        print.log('next is focus after short one')
        chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.focus.time * 60)});
        chrome.storage.session.set({
          timer: {
            time: settingsObj.settings.focus.time * 60,
            status: PAUSE,
            type: FOCUS,
            counts: status.timer.counts + 1
          },
        }).then(res => print.log('session -> short -> focus'))
        chrome.runtime.sendMessage({updateNextTimer: true}).catch((e) => {})  
      } else if(status?.timer?.type === LONGBREAK) {
        prevTimer = LONGBREAK
        print.log('next is focus after long one')
        chrome.action.setBadgeText({text: getTimeString(settingsObj.settings.focus.time * 60)});
        chrome.storage.session.set({
          timer: {
            time: settingsObj.settings.focus.time * 60,
            status: PAUSE,
            type: FOCUS,
            counts: 0
          },
        }).then(res => print.log('session -> long -> focus'))
        chrome.runtime.sendMessage({updateNextTimer: true}).catch((e) => {}) 
      }
      if(timerEnds) {
        createNotification(prevTimer, nextTimer)
      }
    })
  })
}


export const getTimeString = (t) => {
  let minutes = Math.floor(t / 60);
  let seconds = t % 60;
  let time = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  return time
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
  document.querySelector('#cat-walk-style').checked = settings.timerStyle === CATWALKTIMERSTYLE || settings.timerStyle !== SIMPLETIMERSTYLE
  document.querySelector('#simple-style').checked = settings.timerStyle === SIMPLETIMERSTYLE
  console.log(settings.timerStyle, settings.timerStyle === CATWALKTIMERSTYLE)
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
      timerStyle: formValues.timerStyle
    }
  }
}