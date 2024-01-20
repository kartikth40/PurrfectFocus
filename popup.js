import { setNewSettings, setFormValues } from "./utils.js"

const runBtn = document.querySelector('.focus-btn')
const timer = document.querySelector('.timer')

const settingsForm = document.querySelector('#settings-form')
const saveBtn = document.querySelector('.submit-btn')

const tabNames = ['focus', 'settings']
const tabs = tabNames.map(tabName => ({
  btn: document.querySelector(`.${tabName}-tab-btn`),
  tab: document.querySelector(`.${tabName}-tab`)
}))

let settings = {}
let settingsChanged = false

// setup tabs system
setupTabsSystem()

// listening messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  // tick with timer
  if (request.time) {
    timer.innerText = request.time
  }
  // settings status change
  else if(request.status === 'saved') {
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

// on DOM loading
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('settings').then(store=> {
    settings = store.settings
    runBtn.addEventListener('click', () => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.runtime.sendMessage({startTimer: true, time: settings.focus.time * 60});
      });
    });
    setFormValues(store)
  })

});

// on form change
settingsForm.addEventListener('change', (e) => {
  settingsChanged = true
  saveBtn.disabled = false
})
 

// on form submit
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if(!settingsChanged) return
  const formData = new FormData(e.target);
  const formValues = Object.fromEntries(formData);
  settings = setNewSettings(formValues)
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.runtime.sendMessage({saveSettings: true, newSettings: settings});
  });
})


function setupTabsSystem() {
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
  }