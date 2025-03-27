import { BREAK, LIGHTTHEME, SETTINGSKEY } from "../constants.js"
import { getSyncStorage } from "../utils.js"

const container = document.querySelector('.container')

document.addEventListener('DOMContentLoaded', async () => {
  await init()
})


// listening messages
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  if(request.saveSettings) {
    const store = await getSyncStorage(SETTINGSKEY)
    if(store?.settings?.theme === LIGHTTHEME) {
      container.classList.add('light')
    }else container.classList.remove('light')
  }
})


async function init() {
  const store = await getSyncStorage(SETTINGSKEY)
  if(store.settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else {
    container.classList.remove('light')
  }

}
