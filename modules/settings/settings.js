import { LIGHTTHEME, SETTINGSKEY } from "../constants.js"
import { changeTextTo, getSyncStorage, setFormValues, setNewSettings, timerDuration } from "../utils.js"

const container = document.querySelector('.container')
const notificationCheckboxes = document.querySelectorAll('.notification-checkbox')
const soundSelects = document.querySelectorAll('.sound-select')

const settingsForm = document.querySelector('#settings-form')
const saveBtn = document.querySelector('.submit-btn')

let settingsChanged = false

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  // settings status change
  if(request.settingsSaved) {
    saveBtn.classList.add('saved')
    changeTextTo(saveBtn, 'Saved')
    saveBtn.disabled = true
    settingsChanged = false
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      changeTextTo(saveBtn, 'Save')
    }, 1500)
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  if(store.settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else container.classList.remove('light')
  setFormValues(store)
})


notificationCheckboxes.forEach((notificationCheckbox, index) => {
  notificationCheckbox.addEventListener('change', function() {
    if(this.checked) {
      soundSelects[index].disabled = false
    }else{
      soundSelects[index].disabled = true
    }
  })
})

soundSelects.forEach(soundSelect => {
  let notificationTone = null
  soundSelect.addEventListener('change', async function(e) {
    if(notificationTone) {
      notificationTone.pause()
      notificationTone.currentTime = 0
    }
    if(e.target.value === 'None') return
    notificationTone = new Audio(`/assets/audio/${e.target.value}.mp3`)
    notificationTone.play()
  })
  soundSelect.addEventListener('blur', async function(e) {
    if(notificationTone) {
      notificationTone.pause()
      notificationTone.currentTime = 0
    }
  })
})


// on settings change
settingsForm.addEventListener('change', (e) => {
  settingsChanged = true
  saveBtn.disabled = false
})

// on settings submit
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  if(!settingsChanged) return
  const formData = new FormData(e.target)
  const formValues = Object.fromEntries(formData)
  const settingsObj = setNewSettings(formValues)
  const settings = settingsObj.settings
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else container.classList.remove('light')
  chrome.action.setBadgeText({text: ''})
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
    try{
      await chrome.runtime.sendMessage({stopTimer: true})
      await chrome.runtime.sendMessage({saveSettings: true, newSettings: settingsObj})
    }catch{e=>console.warn(e)}
})