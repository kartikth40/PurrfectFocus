const tabNames = ['focus', 'settings']
const tabs = tabNames.map(tabName => ({
  btn: document.querySelector(`.${tabName}-tab-btn`),
  tab: document.querySelector(`.${tabName}-tab`)
}))

const runBtn = document.querySelector('.focus-btn')
const timer = document.querySelector('.timer')

const focusTabBtn = document.querySelector('.focus-tab-btn')
const settingsTabBtn = document.querySelector('.settings-tab-btn')

const focusTab = document.querySelector('.focus-tab')
const settingsTab = document.querySelector('.settings-tab')

const settingsForm = document.querySelector('#settings-form')
const saveBtn = document.querySelector('.submit-btn')

let newSettings = {}
let settingsChanged = false





chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('........')
  console.log(request)
  if (request.time) {
    timer.innerText = request.time
  }else if(request.status === 'saved') {
    console.log('saved!')
    saveBtn.classList.add('saved')
    saveBtn.innerText = 'Saved'
    setTimeout(() => {
      saveBtn.classList.remove('saved')
      saveBtn.innerText = 'Save'
      settingsChanged = false
      saveBtn.disabled = true
    }, 1500);
  }
});

tabs.forEach(({tab, btn}) => {
  btn.addEventListener('click', () => {
    if(btn.classList.contains('active')) return
    tabs.forEach(curTab => {
      if(curTab.btn.classList.contains('active')) {
        curTab.btn.classList.remove('active')
      }
      if(curTab.tab.classList.contains('active')) {
        curTab.tab.classList.remove('active')
      }
    })
    btn.classList.add('active')
    tab.classList.add('active')
  })
})

document.addEventListener('DOMContentLoaded', () => {

  chrome.storage.sync.get('settings').then(result=> {
    newSettings = result
    console.log('get settings')
    console.log(result)
    setFormValues(newSettings)
  })

  runBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.runtime.sendMessage({startTimer: true});
      // window.close();
    });
  });
});

settingsForm.addEventListener('change', (e) => {
  settingsChanged = true
  saveBtn.disabled = false
})
 
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if(!settingsChanged) return

  const formData = new FormData(e.target);
  const formValues = Object.fromEntries(formData);

  newSettings = setNewSettings(formValues)

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.runtime.sendMessage({saveSettings: true, newSettings: newSettings});
  });
})



const setFormValues = (data) => {
  const settings = data.settings
  document.querySelector('#focus-duration-input').value = settings.focus.time
  document.querySelector('#focus-desktop-notification').checked = settings.focus.desktopNotifcations
  document.querySelector('#focus-new-tab-notification').checked = settings.focus.newTabNotifications
  document.querySelector('#short-break-duration-input').value = settings.shortBreak.time
  document.querySelector('#short-break-desktop-notification').checked = settings.shortBreak.desktopNotifcations
  document.querySelector('#short-break-new-tab-notification').checked = settings.shortBreak.newTabNotifications
  document.querySelector('#interval-input').value = settings.longBreak.interval
  document.querySelector('#long-break-duration-input').value = settings.longBreak.time
  document.querySelector('#long-break-desktop-notification').checked = settings.longBreak.desktopNotifcations
  document.querySelector('#long-break-new-tab-notification').checked = settings.longBreak.newTabNotifications
}


const setNewSettings = (formValues) => {
  return {
    settings: {
      focus: {
        time: parseInt(formValues.focusDuration),
        desktopNotifcations: formValues.focusDesktopNotification === 'on' ? true : false,
        newTabNotifications: formValues.focusNewTabNotification === 'on' ? true : false
      },
      shortBreak: {
        time: parseInt(formValues.shortBreakDuration),
        desktopNotifcations: formValues.shortBreakDesktopNotification === 'on' ? true : false,
        newTabNotifications: formValues.shortBreakNewTabNotification === 'on' ? true : false
      },
      longBreak: {
        time: parseInt(formValues.longBreakDuration),
        interval: formValues.longBreakInterval,
        desktopNotifcations: formValues.longBreakDesktopNotification === 'on' ? true : false,
        newTabNotifications: formValues.longBreakNewTabNotification === 'on' ? true : false
      }
    }
  }
}