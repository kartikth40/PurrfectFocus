import { LIGHTTHEME, SETTINGSKEY } from "../constants.js"
import { getLocalStorage, getSyncStorage } from "../utils.js"

const container = document.querySelector('.container')
const pomosTodayCount = document.querySelector('.pomos-today')
const maxStreakCount = document.querySelector('.max-streak')
const currentStreak = document.querySelector('.current-streak')
const streakWeekCheckboxes = document.querySelectorAll('.streak-check')


document.addEventListener('DOMContentLoaded', async () => {
  await init()
  chrome.runtime.sendMessage({ type: 'PAGE_VIEW', properties: {
    currentUrl: window.location.href,
    pathName: 'streak',
    screenWidth: window?.screen?.width,
    screenHeight: window?.screen?.height
  } });
})


// listening messages
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  if(request.saveSettings) {
    const store = await getSyncStorage(SETTINGSKEY)
    await init()
    if(store?.settings?.theme === LIGHTTHEME) {
          document.body.classList.add('light')
    }else document.body.classList.remove('light')
    location.reload()
  }
})


async function init() {
  // const store = await getSyncStorage(SETTINGSKEY)
  // if(store.settings?.theme === LIGHTTHEME) {
  //       document.body.classList.add('light')
  // }else {
  // document.body.classList.remove('light')
  // }

  // const currentFullDate = new Date()
  // const currentYear = currentFullDate.getFullYear().toString()
  // const currentDay = currentFullDate.getDay() === 0 ? 6 : currentFullDate.getDay() - 1
  // const currentDate = currentFullDate.getDate()
  // const currentWeekStart = new Date(currentFullDate)
  // currentWeekStart.setDate(currentDate - currentDay)
  // const weekDate = new Date(currentWeekStart)

  // const historyObj = await getLocalStorage(currentYear)
  // const history = historyObj[currentYear]
  // console.log('history',history)
  // let streakCount = 0;
  // for (let i = 1; i <= 7; i++) {
  //   if (i - 1 > currentDay) break;
  //   const currentStreakWeekBox = streakWeekCheckboxes[i - 1];
  //   const currentWeekDateWithMonth = weekDate.getDate() + '-' + (weekDate.getMonth() + 1);
  //   weekDate.setDate(weekDate.getDate() + 1);
  //   if (history && currentWeekDateWithMonth in history) {
  //     console.log('streak',currentWeekDateWithMonth)
  //     streakCount++;
  //   } else {
  //     streakCount = 0;
  //   }
  // }
  // console.log('streak',streakCount)

  // currentStreak.textContent = streakCount


  // for (let i = streakCount-1 ; i >= 0; i--) {
  //   const index = currentDay - streakCount + i + 1;
  //   console.log(index)
  //   const previousStreakWeekBox = streakWeekCheckboxes[i];
  //   previousStreakWeekBox.classList.add('check');
  // }



}
