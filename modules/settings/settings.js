import { CONFIG } from "../config.js"
import { LIGHTTHEME, modes, SETTINGSKEY } from "../constants.js"
import { changeTextTo, createNewTabForHistory, createNewTabForTimers, getSyncStorage, setFormValues, setNewSettings } from "../utils.js"

const container = document.querySelector('.container')
const durationDivs = document.querySelectorAll('.duration')
const notificationCheckboxes = document.querySelectorAll('.notification-checkbox')
const soundSelects = document.querySelectorAll('.sound-select')
const intervalSelect = document.querySelector('#interval-input')
const intervalSelectDiv = document.querySelector('.long-break-interval')
const autoStartCheckbox = document.querySelectorAll('.auto-start-checkbox')

const lightCard = document.querySelector('.theme-card-light')
const lightCardRadio = document.querySelector('#app-theme-light')
const darkCard = document.querySelector('.theme-card-dark')
const darkCardRadio = document.querySelector('#app-theme-dark')

const settingsForm = document.querySelector('#settings-form')
const saveBtn = document.querySelector('.submit-btn')

const musicPlayerCheckbox = document.getElementById("music-player");
const autoStartMusicCheckbox = document.getElementById("music-auto-start");

const loadingScreen = document.querySelector('.loading-screen')
const historyBtn = document.querySelector('.history-tab-btn')
const timerBtn = document.querySelector('.timer-tab-btn')
const versionTag = document.querySelector('#version')
const supportBtn = document.querySelector('.support-tab-btn')

supportBtn.href = CONFIG.SUPPORT_URL


let settingsChanged = false

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  // settings status change
  if(request.settingsSaved) {
    if(request.reload) location.reload()
    saveBtn.classList.add('saved')
    changeTextTo(saveBtn, 'Saved')
    saveBtn.disabled = true
    settingsChanged = false
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      changeTextTo(saveBtn, 'Save')
    }, 1500)
  }else if(request.updateNextTimer) {
    location.reload()
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  if(store.settings?.theme === LIGHTTHEME) {
    lightCard.classList.add('checked')
    darkCard.classList.remove('checked')
    document.body.classList.add('light')
  }else {
    darkCard.classList.add('checked')
    lightCard.classList.remove('checked')
    document.body.classList.remove('light')
  }
  setFormValues(store)

  const isPomodoro = store.settings.mode === modes.POMODORO

  autoStartMusicCheckbox.disabled = !musicPlayerCheckbox.checked;
  
  evaluateSettingsAppearance(isPomodoro)
  
  lightCardRadio.addEventListener('click', () => {
    lightCard.classList.add('checked')
    darkCard.classList.remove('checked')
  })
  darkCardRadio.addEventListener('click', () => {
    darkCard.classList.add('checked')
    lightCard.classList.remove('checked')
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
    const oldSettingsObj = await getSyncStorage(SETTINGSKEY)
    const formData = new FormData(e.target)
    const formValues = Object.fromEntries(formData)
    const settingsObj = await setNewSettings(formValues)
    const settings = settingsObj.settings
    if(settings?.theme === LIGHTTHEME) {
      document.body.classList.add('light')
    }else document.body.classList.remove('light')
    chrome.action.setBadgeText({text: ''})
    chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
      try{
        await chrome.runtime.sendMessage({resetCurrentTimer: true})
        await chrome.runtime.sendMessage({saveSettings: true, newSettings: settingsObj})
        if(settings.mode === modes.STOPWATCH) {
          await chrome.runtime.sendMessage({switchToStopwatch: true})
        }else {
          await chrome.runtime.sendMessage({switchToPomodoro: true})
        }
        evaluateSettingsAppearance(settings.mode === modes.POMODORO)
      }catch (e) {
        console.warn(e);
      }
  })

  musicPlayerCheckbox.addEventListener("change", () => {
    autoStartMusicCheckbox.disabled = !musicPlayerCheckbox.checked;
  });
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove()
    }, 500)
  }, 200)

  historyBtn.addEventListener('click',async () => {
      await createNewTabForHistory()
    })
  timerBtn.addEventListener('click', async () => {
      await createNewTabForTimers(false, true)
    })

  const manifestData = chrome.runtime.getManifest();
  versionTag.textContent = `~ v${manifestData.version}`;
})


function evaluateSettingsAppearance(isPomodoro) {
  if(!isPomodoro) {
    soundSelects.forEach(soundSelect => {
      soundSelect.disabled = true
    })
    intervalSelect.disabled = true
    intervalSelectDiv.classList.add('disabled')
    durationDivs.forEach(durationDiv => {
      durationDiv.querySelector('input').disabled = true
      durationDiv.classList.add('disabled')
    })
    autoStartCheckbox.forEach(checkbox => {
      checkbox.disabled = true
    })
  }else {
    soundSelects.forEach(soundSelect => {
      soundSelect.disabled = false
    })
    intervalSelect.disabled = false
    intervalSelectDiv.classList.remove('disabled')
    durationDivs.forEach(durationDiv => {
      durationDiv.querySelector('input').disabled = false
      durationDiv.classList.remove('disabled')
    })
    autoStartCheckbox.forEach(checkbox => {
      checkbox.disabled = false
    })
  }
  notificationCheckboxes.forEach((notificationCheckbox, index) => {
    if(!isPomodoro) {
      notificationCheckbox.disabled = true
      return
    } 
    notificationCheckbox.disabled = false
    
    if(notificationCheckbox.checked) {
      soundSelects[index].disabled = false
    }else{
      soundSelects[index].disabled = true
    }
    notificationCheckbox.addEventListener('change', function() {
      if(this.checked) {
        soundSelects[index].disabled = false
      }else{
        soundSelects[index].disabled = true
      }
  })
})
}