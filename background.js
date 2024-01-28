// status
export const STOP = 'Stop'
export const PLAY = 'Play'
export const PAUSE = 'Pause'

// type
export const FOCUS = 'Focus'
export const SHORTBREAK = 'Short Break'
export const LONGBREAK = 'Long Break'

let intervalId = createState(0)

const settings = {
  settings: {
    focus: {
      time: 25,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    shortBreak: {
      time: 5,
      desktopNotifcations: true,
      newTabNotifications: true
    },
    longBreak: {
      time: 15,
      interval: '3',
      desktopNotifcations: true,
      newTabNotifications: true
    }
  }
}

export function printer() {
  const allLogs = false
  const steps = false
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
  // let timer = 5
  let intId = setInterval(function() {
    timer--;
    if (timer < 0) {
      print.log('start timer 🔚')
      clearInterval(intervalId.getState());
      createNotification()
      setNextTimer()
      chrome.action.setBadgeText({text: ''});
      chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
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
  
const createNotification = () => {
  chrome.storage.sync.get('settings').then(settingsObj => {
    chrome.storage.session.get('timer').then(status => {
      const notificationId = `my-notification-${Date.now()}`
      chrome.notifications.create(
        notificationId,
        {
          iconUrl:"assets/cat.png",
          message:"Take a short break",
          title:"Break Time!",
          type:"basic",
          buttons:[
            {title: 'Start'}
          ]
        },
        ()=> {print.it('notify')}
      )
      chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
        if(notifId === notificationId && btnIdx === 0){
          resumeTimer()
        }
      })
    })
  })
}
  
export const resumeTimer = () => {
  chrome.storage.session.get('timer').then(result => {
    chrome.action.setBadgeText({text: getTimeString(result.timer.time)});
    chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
    chrome.storage.sync.get('settings').then(store=> {
      print.log('====> ▶')
      const timerObj = {
          time:  result.timer.time,
          status: PLAY,
          type: result.timer.type,
          counts: result.timer.counts
      }
      print.log('new timer -> ')
      print.log(timerObj)
      chrome.runtime.sendMessage({startTimer: true, timer: timerObj}).catch((e) => {});
    })
  })
}

export const timerDuration = (type, settings) => {
  return type === SHORTBREAK ? settings.shortBreak.time
          : type === LONGBREAK ? settings.longBreak.time
          : settings.focus.time
}

export function setNextTimer() {
  chrome.storage.sync.get('settings').then(settingsObj => {
    chrome.storage.session.get('timer').then(status => {
      print.log('setting next timer --------->')
      if(!status?.timer) return
      print.helper('NEXT ID  => ' + intervalId.getState())
      clearInterval(intervalId.getState())
      if(status?.timer?.type === FOCUS) {
          const interval = parseInt(settingsObj?.settings?.longBreak?.interval)
          if(!interval || (interval && status.timer.counts < interval)) {
          print.log('next is short break')
            chrome.storage.session.set({
              timer: {
                time: settingsObj.settings.shortBreak.time * 60,
                status: PAUSE,
                type: SHORTBREAK,
                counts: interval > 0 ? status.timer.counts : 0
              }
            }).then(res => print.log('session -> focus -> short'))
          } else if(interval && interval > 0) {
          print.log('next is long break')
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
        print.log('next is focus after short one')
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
        print.log('next is focus after long one')
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
      }
    }
  }
}