import { FOCUS, SHORTBREAK } from "./background"

const focusTitle = document.querySelector('.focus-tite')
const focusBtn = document.querySelector('.focus-btn')


chrome.storage.session.get('timer').then(timer => {
  console.log('------------||||||||||||||')
  console.log(timer)
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
})