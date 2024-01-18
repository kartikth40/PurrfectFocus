const runBtn = document.querySelector('.run')
const timer = document.querySelector('.timer')

runBtn.addEventListener('click', () => {
  let currentTime = 0

  setInterval(() => {
    timer.innerText = currentTime
    currentTime += 1
  }, 1000);
})

document.addEventListener('DOMContentLoaded', () => {
  runBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.runtime.sendMessage({startTimer: true});
      window.close();
    });
  });
});