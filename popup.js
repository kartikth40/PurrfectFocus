const runBtn = document.querySelector('.run')
const timer = document.querySelector('.timer')

const settingsForm = document.querySelector('#settings-form')

document.addEventListener('DOMContentLoaded', () => {
  runBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.runtime.sendMessage({startTimer: true});
      window.close();
    });
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.time) {
    timer.innerText = request.time
  }
});

settingsForm.addEventListener('submit', (e) => {
  e.preventDefault()
})