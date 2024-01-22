// status
export const STOP = 'Stop'
export const PLAY = 'Play'
export const PAUSE = 'Pause'

// type
export const FOCUS = 'Focus'
export const SHORTBREAK = 'Short Break'
export const LONGBREAK = 'Long Break'

let intervalId = ''



export const startTimer = (chrome, t) => {
  console.log('start timer started')
  let timer = 5
  intervalId = setInterval(function() {
    timer--;
    if (timer < 0) {
      console.log('start timer ends')
      clearInterval(intervalId);
      const notificationId = `my-notification-${Date.now()}`
      chrome.notifications.create(
        notificationId,
        {
          iconUrl:"assets/cat.png",
          message:"Your 5 sec timer is over!",
          title:"Time Over!",
          type:"basic",
          buttons:[
            {title: 'Restart'},
            {title: 'Dismiss'}
          ]
        },
        ()=> {console.log('notify')}
      )
      chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
        if(notifId === notificationId && btnIdx === 0){
          startTimer(chrome)
        } else if(notifId === notificationId && btnIdx === 1){
          // window.close()
        }
      })

      setNextTimer()
      chrome.action.setBadgeText({text: ''});
      chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
    }else {
      const timerString = getTimeString(timer)
      chrome.action.setBadgeText({text: timerString});
      chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
      chrome.runtime.sendMessage({time: timerString}).catch((e) => {});
      chrome.action.setBadgeText({text: timerString});
      chrome.storage.session.set({timer: timer})
    }
  }, 1000);
}
  
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.startTimer) {
    console.log('message received - start timer')
    console.log('current status -> ', request)
    chrome.storage.session.set({
      timerStatus: {
        started: true,
        status: PLAY,
        type: request.timerStatus.type === FOCUS ? FOCUS : request.timerStatus.type
      },
      timer: request.time,
    })
    startTimer(chrome, request.time)
  }
  else if(request.pauseTimer) {
    console.log('message received - pause timer')
    chrome.storage.session.set({
      timerStatus: {
        started: true,
          status: PAUSE,
          type: request.timerStatus.type
        },
        timer: request.time,
      })
      clearInterval(intervalId)
    }
    else if(request.stopTimer) {
    console.log('message received - stop timer')
      chrome.storage.session.set({
        timerStatus: {
          started: false,
          status: STOP,
          type: FOCUS
        },
        timer: 0,
        breakNo: 0
      })
      clearInterval(intervalId)
    }
    if(request.saveSettings) {
      chrome.storage.sync.set(request.newSettings).then(() => {
        chrome.runtime.sendMessage({status: 'saved'}).catch((e) => {})
      })
    }
  })

export const setNextTimer = () => {
  chrome.storage.sync.get('settings').then(settingsObj => {
    chrome.storage.session.get(['timerStatus', 'breakNo']).then(status => {
      console.log('setting next timer')
      console.log('current status -> ', status)
      if(!status?.timerStatus?.started) return
      if(status?.timerStatus?.type === FOCUS) {
        chrome.storage.sync.get('settings').then(result => {
          const interval = parseInt(result?.settings?.longBreak?.interval)
          if(!interval || (interval && status.breakNo < interval)) {
            chrome.storage.session.set({
              timerStatus: {
                started: true,
                status: PAUSE,
                type: SHORTBREAK
              },
              timer: settingsObj.settings.shortBreak.time,
              breakNo: interval > 0 ? status.breakNo + 1 : 0
            })
          } else if(interval && interval > 0) {
            chrome.storage.session.set({
              timerStatus: {
                started: true,
                status: PAUSE,
                type: LONGBREAK
              },
              timer: settingsObj.settings.longBreak.time,
              breakNo: 0
            })
          }
          chrome.runtime.sendMessage({nextTimer: true}).catch((e) => {})
        })
      } else if(status?.timerStatus?.type === SHORTBREAK) {
          chrome.storage.session.set({
            timerStatus: {
              started: true,
              status: PAUSE,
              type: FOCUS
            },
            timer: settingsObj.settings.focus.time,
            breakNo: status.breakNo + 1
          })
          chrome.runtime.sendMessage({nextTimer: true}).catch((e) => {})  
      } else if(status?.timerStatus?.type === LONGBREAK) {
        chrome.storage.session.set({
          timerStatus: {
            started: false,
            status: PAUSE,
            type: FOCUS
          },
          timer: settingsObj.settings.focus.timer,
        })
        chrome.runtime.sendMessage({nextTimer: true}).catch((e) => {}) 
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