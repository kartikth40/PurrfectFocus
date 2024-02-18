import { FOCUS, SHORTBREAK, resumeTimer } from "./background.js"

const focusTitle = document.querySelector('.focus-title')
const focusBtn = document.querySelector('.focus-btn')
const reminderCount = document.querySelector('.reminder-count')
const reminder = document.querySelector('.reminder')

chrome.storage.session.get('timer').then(timer => {
  if(!timer?.timer || timer?.timer?.type === FOCUS) {
    reminder.style.visibility = 'visible'
    focusTitle.innerText = 'Start Focusing'
    focusBtn.innerText = 'Start Focusing'
  }
  else if(timer.timer.type === SHORTBREAK) {
    reminder.style.visibility = 'visible'
    focusTitle.innerText = 'Take a Short Break'
    focusBtn.innerText = 'Start Short Break'
  }else {
    reminder.style.visibility = 'hidden'
    focusTitle.innerText = 'Take a Long Break'
    focusBtn.innerText = 'Start Long Break'
  }
  chrome.storage.sync.get('settings').then(settings => {
    reminderCount.innerText = parseInt(settings.settings.longBreak.interval) - (timer.timer ? timer.timer.counts : 0) + 1
  })
})


focusBtn.addEventListener('click', () => {
  resumeTimer(function() {
    chrome.tabs.getCurrent(function(tab) {
      chrome.tabs.remove(tab.id, function() {
       }).catch(e=> console.log(e));
    });
  })
})
