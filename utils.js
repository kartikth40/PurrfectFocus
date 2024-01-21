

export const startTimer = (chrome, timer) => {
  chrome.storage.session.set({
    timerStatus: {
      started: true,
      timer: timer,
      status: 'play',
      type: {
        focus: true,
        shortBreak: false,
        longBreak: false
      }
    }
  })
  var intervalId = setInterval(function() {
    timer--;
    const timerString = getTimeString(timer)
    chrome.action.setBadgeText({text: timerString});
    chrome.action.setBadgeBackgroundColor({color: 'rgb(202, 250, 197)'});
    chrome.runtime.sendMessage({time: timerString}).catch((e) => {
    });
    chrome.action.setBadgeText({text: timerString});
    chrome.storage.sync.set({timer: timer})
    if (timer === 0) {
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
        ()=> {console.log('created')}
      )
      chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
        if(notifId === notificationId && btnIdx === 0){
          startTimer(chrome)
        } else if(notifId === notificationId && btnIdx === 1){
          // window.close()
        }
      })
      chrome.storage.session.set({
        timerStatus: {
          started: false,
          timer: 0,
          status: 'off',
          type: {
            focus: false,
            shortBreak: false,
            longBreak: false
          }
        }
      })
      chrome.action.setBadgeText({text: ''});
        // change text on complete
      
      chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
    }
  }, 1000);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.pauseTimer) {
      chrome.storage.session.set({
        timerStatus: {
          started: true,
          status: 'pause',
          timer: timer,
          type: {
            focus: true,
            shortBreak: false,
            longBreak: false
          }
        }
      })
      clearInterval(intervalId)
    }
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
  console.log('set')
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