import {
  clearHistory,
  getLocalStorage,
  getSessionStorage,
  getSyncStorage,
  setSampleHistory,
  setSessionStorage,
} from '../utils.js'
import { SETTINGSKEY, LIGHTTHEME } from '../constants.js'

const container = document.querySelector('.container')
const todayCount = document.querySelector('.today-count')
const weekCount = document.querySelector('.week-count')
const monthCount = document.querySelector('.month-count')
const yearCount = document.querySelector('.year-count')
const graphContainer = document.querySelector('.graph-container')
const YAxis = document.querySelector('.y-axis')
const bars = document.querySelectorAll('.bar')
const sampleHistoryBtn = document.querySelector('.sample-history-btn')
const sampleHistoryRemoveBtn = document.querySelector('.sample-history-btn-remove')
const deleteHistoryBtn = document.querySelector('.delete-btn')
const isSampleElement = document.querySelector('.is-sample')
const noDataElement = document.querySelector('.no-data')

graphContainer.style.setProperty('--bars', bars.length)
const maxHeightOfGraph = graphContainer.clientHeight - 20
let maxValueOfGraph = 0

sampleHistoryBtn.addEventListener('click', async () => {
  await setSampleHistory()
  await init()
})
sampleHistoryRemoveBtn.addEventListener('click', async () => {
  const currentFullDate = new Date()
  const currentYear = currentFullDate.getFullYear().toString()
  await setSessionStorage({[currentYear]: null})
  await init()
})

deleteHistoryBtn.addEventListener('click', async () => {
  await clearHistory()
  await init()
})

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  if (store.settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  } else container.classList.remove('light')

  chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    if(request.saveSettings){
          loadSettings(request.newSettings.settings)
      }
    })

  await init()
})

async function init() {
  maxValueOfGraph = 0
  const currentFullDate = new Date()
  const currentYear = currentFullDate.getFullYear().toString()
  const currentDate = currentFullDate.getDate()
  const currentMonth = currentFullDate.getMonth() + 1
  const currentDay =
    currentFullDate.getDay() === 0 ? 6 : currentFullDate.getDay() - 1
  const sampleHistoryObj = await getSessionStorage(currentYear)
  const sampleHistory = sampleHistoryObj[currentYear]
  const historyObj = await getLocalStorage(currentYear)
  const history = sampleHistory ?? historyObj[currentYear]
  console.log(history)

  if(!sampleHistory){ 
    sampleHistoryBtn.classList.add('active')
    sampleHistoryRemoveBtn.classList.remove('active')
    isSampleElement.classList.remove('active')
  }
  else {
    sampleHistoryBtn.classList.remove('active')
    sampleHistoryRemoveBtn.classList.add('active')
    isSampleElement.classList.add('active')
  }

  if(!history) {
    noDataElement.classList.add('active')
    setSimpleMetrics(0, todayCount)
  } else {
    noDataElement.classList.remove('active')
  }

  // weekly metrics
  const currentWeekStart = new Date(currentFullDate)
  currentWeekStart.setDate(currentDate - currentDay)
  console.log(currentWeekStart)
  const weekDate = new Date(currentWeekStart)
  const thisWeekData = {}

  if (history) {
    for (let i = 0; i < 7; i++) {
      const currentWeekDateWithMonth = weekDate.getDate() + '-' + (weekDate.getMonth() + 1)
      weekDate.setDate(weekDate.getDate() + 1)
      if (currentWeekDateWithMonth in history) {
        const data = history[currentWeekDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d.type === 'focus') focus += d.duration
          else if (d.type === 'break') breaks += d.duration
        })

        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))
        thisWeekData[i] = {
          focus,
          breaks,
        }

        if (i === currentDay) {
          setSimpleMetrics(focus, todayCount)
        }
        maxValueOfGraph = Math.max(Math.ceil(focus), maxValueOfGraph)
      }
    }
  }
  setYAxis()
  setWeeklyBars(thisWeekData)

  // monthly metrics
  const firstDayOfNextMonth = new Date(currentYear, currentMonth, 1)
  const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
  let monthlySum = 0
  for (let i = 1; i <= lastDateOfCurrentMonth; i++) {
    const date = new Date(currentYear, currentMonth - 1, i)
    const currentDateWithMonth = date.getDate() + '-' + (date.getMonth() + 1)

    if (!history) break
    if (currentDateWithMonth in history) {
      const data = history[currentDateWithMonth]
      let focus = 0
      let breaks = 0
      data.forEach((d) => {
        if (d.type === 'focus') focus += d.duration
        else if (d.type === 'break') breaks += d.duration
      })

      focus = parseFloat((focus / 60).toFixed(2))
      breaks = parseFloat((breaks / 60).toFixed(2))

      monthlySum += focus
    }
  }
  setSimpleMetrics(monthlySum, monthCount, true)

  // yearly metrics
  let yearlySum = 0
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(currentYear, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentYear, month, day)
      const currentDateWithMonth =
        currentDate.getDate() + '-' + (currentDate.getMonth() + 1)
      if (!history) break
      if (currentDateWithMonth in history) {
        const data = history[currentDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d.type === 'focus') focus += d.duration
          else if (d.type === 'break') breaks += d.duration
        })

        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))

        yearlySum += focus
      }
    }
  }
  setSimpleMetrics(yearlySum, yearCount, true)
}

function setWeeklyBars(thisWeekData) {
  let totalFocusInThisWeek = 0
  bars.forEach((bar, i) => {
    const value = thisWeekData[i] ? thisWeekData[i].focus : 0
    totalFocusInThisWeek += value
    bar.setAttribute('data-value', getTimeFormatted(value))
    const height = (maxHeightOfGraph / maxValueOfGraph) * value
    bar.style.height = (value === 0 ? value : height) + 'px'
  })
  setSimpleMetrics(totalFocusInThisWeek, weekCount)
}

function setSimpleMetrics(time, elementToSetUpon, onlyHrs = false) {
  let count = 0
  let step = time / 100
  const interval = setInterval(() => {
    count += step
    if (count >= time) {
      elementToSetUpon.innerText = getTimeFormatted(time, onlyHrs)
      clearInterval(interval)
    }
    elementToSetUpon.innerText = getTimeFormatted(count, onlyHrs)
  }, 5)
}

function getTimeFormatted(floatHours, onlyHrs = false) {
  let hours =
    Math.floor(floatHours) > 9
      ? Math.floor(floatHours)
      : '0' + Math.floor(floatHours)
  if (Math.floor(floatHours) === 0) hours = 0
  let minutes =
    Math.round((floatHours - hours) * 60) > 9
      ? Math.round((floatHours - hours) * 60)
      : '0' + Math.round((floatHours - hours) * 60)
  let formattedString = (hours ? hours + 'h ' : '') + minutes + 'm'
  if (onlyHrs) {
    formattedString =
      (floatHours > 9 ? floatHours.toFixed(1) : '0' + floatHours.toFixed(1)) +
      'h'
  }
  return formattedString
}

function setYAxis() {
  let step = Math.ceil(maxValueOfGraph / 7)
  if(maxValueOfGraph % 2 === 1) maxValueOfGraph++
  if (step % 2 === 1) step++
  if (maxValueOfGraph < 5) step = 0.5
  else if (step < 10 && step > 2) step = 5
  else if (step > 10) step = 10
  YAxis.innerHTML = ''
  if(maxValueOfGraph === 0) return
  for (let i = maxValueOfGraph; i >= 0; i = i - step) {
    const marker = document.createElement('span')
    marker.classList.add('marker')
    marker.innerText = i
    YAxis.appendChild(marker)
  }
}


function loadSettings(settings) {
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
    console.log('light me')
  }else {
    container.classList.remove('light')
    console.log('dark me')
  } 
}