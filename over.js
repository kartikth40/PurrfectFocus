import { FOCUS, SHORTBREAK } from "./background.js"

const focusTitle = document.querySelector('.focus-title')
const focusBtn = document.querySelector('.focus-btn')
const reminderCount = document.querySelector('.reminder-count')

chrome.storage.session.get('timer').then(timer => {
  if(!timer?.timer || timer?.timer?.type === FOCUS) {
    focusTitle.innerText = 'Start Focusing'
    focusBtn.innerText = 'Start Focusing'
  }
  else if(timer.timer.type === SHORTBREAK) {
    focusTitle.innerText = 'Take a Short Break'
    focusBtn.innerText = 'Start Short Break'
  }else {
    focusTitle.innerText = 'Take a Long Break'
    focusBtn.innerText = 'Start Long Break'
  }
  chrome.storage.sync.get('settings').then(settings => {
    reminderCount.innerText = parseInt(settings.settings.longBreak.interval) - (timer.timer ? timer.timer.counts : 0) + 1
  })
})

