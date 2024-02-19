import { SETTINGSKEY, TIMERKEY, FOCUS, SHORTBREAK } from "../constants.js"
import { getSessionStorage, getSyncStorage, resumeTimer } from "../utils.js"

const focusTitle = document.querySelector('.focus-title')
const focusBtn = document.querySelector('.focus-btn')
const reminderCount = document.querySelector('.reminder-count')
const reminder = document.querySelector('.reminder')

await init()

async function init() {
  const timer = await getSessionStorage(TIMERKEY)
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
  const settings = await getSyncStorage(SETTINGSKEY)
  const interval = parseInt(settings.settings.longBreak.interval)
  const timerCounts = timer.timer ? timer.timer.counts : 0
  reminderCount.innerText = interval - timerCounts + 1
  
  focusBtn.addEventListener('click', async () => {
    await resumeTimer(function() {
      chrome.tabs.getCurrent(function(tab) {
        chrome.tabs.remove(tab.id, function() {
         }).catch(e=> console.log(e))
      })
    })
  })
}


