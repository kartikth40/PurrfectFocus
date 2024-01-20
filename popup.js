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

let newSettings = {}

chrome.storage.sync.get('settings').then(result=> newSettings = result)



chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.time) {
    timer.innerText = request.time
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
  runBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.runtime.sendMessage({startTimer: true});
      // window.close();
    });
  });
});
 
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault()
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.runtime.sendMessage({saveSettings: true, settings: newSettings});
  });
})