export const startTimer = (chrome) => {
  chrome.storage.local.set({timerRunning: true});
  chrome.action.setBadgeText({text: '00:05'});
  chrome.action.setBadgeBackgroundColor({color: [255, 0, 0, 230]});
  var timer = 5;
  var intervalId = setInterval(function() {
    timer--;
    chrome.runtime.sendMessage({time: getTimeString(timer)}).catch((e) => {
      console.log(e.message)
    });
    chrome.action.setBadgeText({text: getTimeString(timer)});
    if (timer === 0) {
      clearInterval(intervalId);
      const notificationId = `my-notification-${Date.now()}`
      chrome.notifications.create(
        notificationId,
        {
          iconUrl:"assets/save.png",
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
      chrome.storage.local.set({timerRunning: false});
      chrome.action.setBadgeText({text: ''});
        // change text on complete
      
      chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
    }
  }, 1000);
}


export const getTimeString = (t) => {
  let minutes = Math.floor(t / 60);
  let seconds = t % 60;
  let time = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  return time
}