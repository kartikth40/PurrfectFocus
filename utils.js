export const startTimer = (chrome) => {
  chrome.storage.local.set({timerRunning: true});
  chrome.action.setBadgeText({text: '00:05'});
  chrome.action.setBadgeBackgroundColor({color: [255, 0, 0, 230]});
  var timer = 5;
  var intervalId = setInterval(function() {
    timer--;
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.runtime.sendMessage({time: getTimeString(timer)});
    });
    chrome.action.setBadgeText({text: getTimeString(timer)});
    if (timer === 0) {
      clearInterval(intervalId);
      chrome.notifications.create(
        'notif-create',
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
        if(notifId === 'notif-create' && btnIdx === 0){
          startTimer(chrome)
        } else if(notifId === 'notif-create' && btnIdx === 1){
          // window.close()
        }
      })
      chrome.storage.local.set({timerRunning: false});
      chrome.action.setBadgeText({text: ''});
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