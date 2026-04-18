import { CONFIG } from '../config.js'
import { BLOCKEDLISTKEY, LIGHTTHEME, modes, SETTINGSKEY, TOASTIFY } from '../constants.js'
import {
  changeTextTo,
  createNewTabForHistory,
  createNewTabForTimers,
  createNewTabForStreak,
  getSyncStorage,
  setFormValues,
  setNewSettings,
  setSyncStorage,
  showToast,
  unSetBlockRules,
} from '../utils.js'

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
const saveBtn = document.querySelector('.settings-save-btn')

const musicPlayerCheckbox = document.getElementById('music-player')
const autoStartMusicCheckbox = document.getElementById('music-auto-start')

const loadingScreen = document.querySelector('.loading-screen')
const historyBtn = document.querySelector('.history-tab-btn')
const streakBtn = document.querySelector('.streak-tab-btn')
const timerBtn = document.querySelector('.timer-tab-btn')
const versionTag = document.querySelector('#version')
const supportBtn = document.querySelector('.support-tab-btn')

const blockSitesForm = document.querySelector('.block-list-form')
const blockedSitesList = document.getElementById('blocked-sites-list')
const addBlockedListBtn = document.getElementById('add-block-site')
const newBlockListItemInput = document.getElementById('new-block-site')

let blockedSites = []

supportBtn.href = CONFIG.SUPPORT_URL

let settingsChanged = false

const sendRuntimeMessageSafely = async (message) => {
  try {
    await chrome.runtime.sendMessage(message)
  } catch (e) {
    console.warn(e)
  }
}

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  // settings status change
  if (request.settingsSaved) {
    if (request.reload) location.reload()
    saveBtn.classList.add('saved')
    changeTextTo(saveBtn, 'Saved')
    saveBtn.disabled = true
    settingsChanged = false
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      changeTextTo(saveBtn, 'Save Settings')
    }, 1500)
  } else if (request.updateNextTimer) {
    location.reload()
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  if (store.settings?.theme === LIGHTTHEME) {
    lightCard.classList.add('checked')
    darkCard.classList.remove('checked')
    document.body.classList.add('light')
  } else {
    darkCard.classList.add('checked')
    lightCard.classList.remove('checked')
    document.body.classList.remove('light')
  }
  setFormValues(store)

  const isPomodoro = store.settings.mode === modes.POMODORO

  autoStartMusicCheckbox.disabled = !musicPlayerCheckbox.checked

  evaluateSettingsAppearance(isPomodoro)

  if (!store?.settings?.blockSites) {
    blockSitesForm.classList.add('disabled')
    await unSetBlockRules()
  } else {
    blockSitesForm.classList.remove('disabled')
  }

  lightCardRadio.addEventListener('click', () => {
    lightCard.classList.add('checked')
    darkCard.classList.remove('checked')
  })
  darkCardRadio.addEventListener('click', () => {
    darkCard.classList.add('checked')
    lightCard.classList.remove('checked')
  })

  soundSelects.forEach((soundSelect) => {
    let notificationTone = null
    soundSelect.addEventListener('change', async function (e) {
      if (notificationTone) {
        notificationTone.pause()
        notificationTone.currentTime = 0
      }
      if (e.target.value === 'None') return
      notificationTone = new Audio(`/audio/${e.target.value}.mp3`)
      notificationTone.play()
    })
    soundSelect.addEventListener('blur', async function (e) {
      if (notificationTone) {
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
    if (!settingsChanged) return
    const oldSettingsObj = await getSyncStorage(SETTINGSKEY)
    const formData = new FormData(e.target)
    const formValues = Object.fromEntries(formData)
    const settingsObj = await setNewSettings(formValues)
    const settings = settingsObj.settings
    if (settings?.theme === LIGHTTHEME) {
      document.body.classList.add('light')
    } else document.body.classList.remove('light')
    chrome.action.setBadgeText({ text: '' })
    chrome.action.setBadgeBackgroundColor({ color: [190, 190, 190, 230] })
    try {
      await chrome.runtime.sendMessage({ resetCurrentTimer: true })
      await chrome.runtime.sendMessage({ saveSettings: true, newSettings: settingsObj })
      if (settings.mode === modes.STOPWATCH) {
        await chrome.runtime.sendMessage({ switchToStopwatch: true })
      } else {
        await chrome.runtime.sendMessage({ switchToPomodoro: true })
      }
      evaluateSettingsAppearance(settings.mode === modes.POMODORO)
    } catch (e) {
      console.warn(e)
    }
    if (!settings.blockSites) {
      blockSitesForm.classList.add('disabled')
      await unSetBlockRules()
    } else {
      blockSitesForm.classList.remove('disabled')
    }

    await chrome.runtime.sendMessage({
      type: 'SETTINGS_SAVED',
      properties: {
        focusTime: settings?.focus?.time,
        focusNotificationTone: settings?.focus?.notifications ? settings?.focus?.sound : null,
        focusAutoStart: settings?.focus?.autoStart,
        shortBreakTime: settings?.shortBreak?.time,
        shortBreakNotificationTone: settings?.shortBreak?.notifications ? settings?.shortBreak?.sound : null,
        shortBreakAutoStart: settings?.shortBreak?.autoStart,
        longBreakTime: settings?.longBreak?.time,
        longBreakNotificationTone: settings?.longBreak?.notifications ? settings?.longBreak?.sound : null,
        longBreakAutoStart: settings?.longBreak?.autoStart,
        isMusicPlayerActive: settings?.musicPlayer,
        theme: settings?.theme,
        openNewTab: settings?.openNewTab,
        showDailyJournal: settings?.dailyJournal,
        enableSiteBlocking: settings?.blockSites,
        timerMode: settings?.mode,
      },
    })
  })
  addBlockedListBtn.addEventListener('click', async (e) => {
    e.preventDefault()
    const newValue = newBlockListItemInput.value
    const saved = await saveNewSiteToBlockLIst(newValue)
    if (saved) newBlockListItemInput.value = ''
  })

  musicPlayerCheckbox.addEventListener('change', () => {
    autoStartMusicCheckbox.disabled = !musicPlayerCheckbox.checked
  })
  setTimeout(() => {
    loadingScreen.classList.add('fade-out')
    setTimeout(() => {
      loadingScreen.remove()
    }, 500)
  }, 200)

  historyBtn.addEventListener('click', async () => {
    await createNewTabForHistory()
  })
  streakBtn?.addEventListener('click', async () => {
    await createNewTabForStreak()
  })
  timerBtn.addEventListener('click', async () => {
    await createNewTabForTimers(false, true)
  })

  const manifestData = chrome.runtime.getManifest()
  versionTag.textContent = `~ v${manifestData.version}`

  await sendRuntimeMessageSafely({ type: 'START_SESSION' })
  await sendRuntimeMessageSafely({
    type: 'PAGE_VIEW',
    properties: {
      currentUrl: window.location.href,
      pathName: 'settings',
      screenWidth: window?.screen?.width,
      screenHeight: window?.screen?.height,
    },
  })
  await loadBlockedList()
})

function evaluateSettingsAppearance(isPomodoro) {
  if (!isPomodoro) {
    soundSelects.forEach((soundSelect) => {
      soundSelect.disabled = true
    })
    intervalSelect.disabled = true
    intervalSelectDiv.classList.add('disabled')
    durationDivs.forEach((durationDiv) => {
      durationDiv.querySelector('input').disabled = true
      durationDiv.classList.add('disabled')
      durationDiv?.parentElement?.querySelector('h2')?.classList?.add('disabled')
    })
    autoStartCheckbox.forEach((checkbox) => {
      checkbox.disabled = true
    })
  } else {
    soundSelects.forEach((soundSelect) => {
      soundSelect.disabled = false
    })
    intervalSelect.disabled = false
    intervalSelectDiv.classList.remove('disabled')
    durationDivs.forEach((durationDiv) => {
      durationDiv.querySelector('input').disabled = false
      durationDiv.classList.remove('disabled')
      durationDiv?.parentElement?.querySelector('h2')?.classList?.remove('disabled')
    })
    autoStartCheckbox.forEach((checkbox) => {
      checkbox.disabled = false
    })
  }
  notificationCheckboxes.forEach((notificationCheckbox, index) => {
    if (!isPomodoro) {
      notificationCheckbox.disabled = true
      return
    }
    notificationCheckbox.disabled = false

    if (notificationCheckbox.checked) {
      soundSelects[index].disabled = false
    } else {
      soundSelects[index].disabled = true
    }
    notificationCheckbox.addEventListener('change', function () {
      if (this.checked) {
        soundSelects[index].disabled = false
      } else {
        soundSelects[index].disabled = true
      }
    })
  })
}

function renderBlockedSites() {
  blockedSitesList.innerHTML = ''
  blockedSites.forEach((url, index) => {
    const item = document.createElement('div')
    item.className = 'blocked-site-item'
    item.dataset.index = index
    item.innerHTML = `
      <input type="text" class="blocked-site-url" value="${url}" />
      <button type="button" class="remove-site-btn">x</button>
    `
    item.querySelector('.remove-site-btn').addEventListener('click', async () => {
      await loadBlockedList()
      blockedSites.splice(index, 1)
      await saveBlockedSites(true)
      showToast('Done!', 'Removed that URL.', TOASTIFY.colors.green, null, true)
      renderBlockedSites()
    })
    item.querySelector('.blocked-site-url').addEventListener('change', async (e) => {
      const newValue = e.target.value
      await saveNewSiteToBlockLIst(newValue, index)
    })
    blockedSitesList.appendChild(item)
  })
}

async function loadBlockedList() {
  const savedList = await getSyncStorage([BLOCKEDLISTKEY])
  blockedSites = savedList[BLOCKEDLISTKEY] || []
  renderBlockedSites()
}

async function saveNewSiteToBlockLIst(newValue, index = -1) {
  if (!newValue) {
    showToast('OOPS!', "That's an invalid URL.", TOASTIFY.colors.orange, null, true)
  }
  await loadBlockedList()
  const newVal = newValue.trim()
  if (blockedSites.includes(newVal)) {
    showToast('OOPS!', 'You already have this URL blocked.', TOASTIFY.colors.orange, null, true)
    return
  }
  try {
    const url = new URL(newVal)
    if (index >= 0) blockedSites[index] = newVal
    else blockedSites.push(newVal)
    await saveBlockedSites()
    showToast('Success!', 'List updated.', TOASTIFY.colors.green, null, true)
  } catch (e) {
    showToast('OOPS!', "That's an invalid URL.", TOASTIFY.colors.orange, null, true)
  }
  await loadBlockedList()
  return true
}

async function saveBlockedSites(removed = false) {
  await setSyncStorage({ [BLOCKEDLISTKEY]: blockedSites })
  try {
    await chrome.runtime.sendMessage({ syncBlockRules: true })
  } catch (e) {
    console.warn(e)
  }
  if (removed) return
  for (const site of blockedSites) {
    try {
      const urlObj = new URL(site)

      await chrome.runtime.sendMessage({
        type: 'SITE_BLOCKED',
        properties: {
          site: site,
          host: urlObj.host,
          site_count: blockedSites.length,
        },
      })
    } catch (e) {
      console.warn(`Invalid URL skipped: ${site}`, e)
    }
  }
}
