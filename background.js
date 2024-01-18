// chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
//   if (changeInfo.status === 'complete') {
//     chrome.storage.local.set({timerRunning: false});
//     chrome.action.setBadgeText({text: ''});
//     chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
//   }
// });

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.startTimer) {
    chrome.storage.local.set({timerRunning: true});
    chrome.action.setBadgeText({text: '00:05'});
    chrome.action.setBadgeBackgroundColor({color: [255, 0, 0, 230]});
    var timer = 5;
    var intervalId = setInterval(function() {
      timer--;
      chrome.action.setBadgeText({text: getTimeString(timer)});
      if (timer === 0) {
        clearInterval(intervalId);
        // chrome.windows.create({
        //   'url': 'alert.html',
        //   'type': 'popup',
        //   'width': 250,
        //   'height': 150
        // });
        chrome.notifications.create(
          'notif-create',
          {
            iconUrl:"assets/save.png",
            message:"Your 5 sec timer is over!",
            title:"Time Over!",
            type:"basic",
            buttons:[
              {title: 'Restart'}
            ]
          },
          ()=> {console.log('created')}
        )
        chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
          if(notifId === 'notif-create' && btnIdx === 0){
            chrome.runtime.sendMessage({restartTimer: true});
          } 
        })
        chrome.storage.local.set({timerRunning: false});
        chrome.action.setBadgeText({text: ''});
        chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
      }
    }, 1000);
  } else if (request.restartTimer) {
    chrome.storage.local.set({timerRunning: false});
    chrome.runtime.sendMessage({startTimer: true});
  }
});


function getTimeString(t) {
  let minutes = Math.floor(t / 60);
  let seconds = t % 60;
  let time = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  return time
}