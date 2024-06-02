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
const weekYAxis = document.querySelector('.week-y-axis')
const monthYAxis = document.querySelector('.month-y-axis')
const weekBars = document.querySelectorAll('.week-bar')
const monthBarsContainer = document.querySelector('.month-bars-container')
const sampleHistoryBtn = document.querySelector('.sample-history-btn')
const sampleHistoryRemoveBtn = document.querySelector('.sample-history-btn-remove')
const deleteHistoryBtn = document.querySelector('.delete-btn')
const isSampleElement = document.querySelectorAll('.is-sample')
const noWeekDataElement = document.querySelector('.week-no-data')
const noMonthDataElement = document.querySelector('.month-no-data')

const WEEK = 'week'
const MONTH = 'month'
const YEAR = 'year'

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
  setSimpleMetrics(0, todayCount)
})

deleteHistoryBtn.addEventListener('click', async () => {
  if(confirm("Are you sure you wanna delete all of your history?")) {
    await clearHistory()
    await init()
  }
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

  if(!sampleHistory){ 
    sampleHistoryBtn.classList.add('active')
    sampleHistoryRemoveBtn.classList.remove('active')
    isSampleElement.forEach(el => el.classList.remove('active'))
  }
  else {
    sampleHistoryBtn.classList.remove('active')
    sampleHistoryRemoveBtn.classList.add('active')
    isSampleElement.forEach(el => el.classList.add('active'))
  }

  if(!history) {
    noWeekDataElement.classList.add('active')
    noMonthDataElement.classList.add('active')
  } else {
    noWeekDataElement.classList.remove('active')
    noMonthDataElement.classList.remove('active')
  }

  // weekly metrics
  const currentWeekStart = new Date(currentFullDate)
  currentWeekStart.setDate(currentDate - currentDay)
  const weekDate = new Date(currentWeekStart)
  const thisWeekData = {}
  let weeklySum = 0

  if (history) {
    for (let i = 1; i <= 7; i++) {
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


        if (i-1 === currentDay) {
          setSimpleMetrics(focus, todayCount)
        }
        weeklySum += focus
        maxValueOfGraph = Math.max(focus, maxValueOfGraph)
      }
    }
  }

    setYAxis(maxValueOfGraph)
    setBars(thisWeekData, maxValueOfGraph)
    setSimpleMetrics(weeklySum, weekCount, true)


  // monthly metrics
  const firstDayOfNextMonth = new Date(currentYear, currentMonth, 1)
  const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
  let totalDaysInCurrentMonth = 0
  const thisMonthData = {}
  let monthlySum = 0
  if(history) {
    for (let i = 1; i <= lastDateOfCurrentMonth; i++) {
      totalDaysInCurrentMonth++
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
        thisMonthData[i] = {
          focus,
          breaks,
        }

        monthlySum += focus
        maxValueOfGraph = Math.max(focus, maxValueOfGraph)
      }
    }
  }
    setYAxis(maxValueOfGraph, MONTH)
    setBars(thisMonthData, maxValueOfGraph, MONTH, totalDaysInCurrentMonth)
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

function setBars(data, maxValueOfGraph, range=WEEK, totalDays=7) {
  let totalFocus = 0
  let bars = weekBars
  if(range===MONTH) {
    bars = []
    monthBarsContainer.innerHTML = ''
    for(let i = 1; i <= totalDays; i++) {
      const bar = document.createElement('span')
      bar.classList.add('bar', 'month-bar')
      bar.setAttribute('data-x', i)
      bar.style.setProperty("--bar-height", 0 + 'px')
      monthBarsContainer.appendChild(bar)
      bars.push(bar)
    }
  }
  setTimeout(() => {
    bars.forEach((bar, i) => {
      const value = data[i+1] ? data[i+1].focus : 0
      totalFocus += value
      bar.setAttribute('data-value', getTimeFormatted(value))
      const height = (maxHeightOfGraph / maxValueOfGraph) * value
      bar.style.setProperty("--bar-height", (height) + 'px')
    })
    
  }, 50);
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

function setYAxis(maxValueOfGraph, range=WEEK) {
  console.log(maxValueOfGraph)
  maxValueOfGraph = Math.round(maxValueOfGraph)
  let n = 7
  let axis = null
  if(range === WEEK) {
    axis = weekYAxis
  }
  else if(range === MONTH) {
    axis = monthYAxis
  }
  let step = Math.ceil(maxValueOfGraph / n)
  if (step % 2 === 1) step++
  if (maxValueOfGraph < 2) step = 0.5
  else if (step < 10 && step > 2) step = 5
  else if (step > 10) step = 10
  axis.innerHTML = ''
  if(maxValueOfGraph === 0) return
  for (let i = maxValueOfGraph; i >= 0; i = i - step) {
    const marker = document.createElement('span')
    marker.classList.add('marker')
    marker.innerText = i
    axis.appendChild(marker)
  }
}


function loadSettings(settings) {
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else {
    container.classList.remove('light')
  } 
}