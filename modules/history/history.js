import {
  clearHistory,
  exportData,
  formatDateWithOrdinal,
  getLocalStorage,
  getSessionStorage,
  getSyncStorage,
  importData,
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
const exportDataBtn = document.querySelector('.export-btn')
const importDataBtn = document.querySelector('.import-btn')
const isSampleElement = document.querySelectorAll('.is-sample')
const noWeekDataElement = document.querySelector('.week-no-data')
const noMonthDataElement = document.querySelector('.month-no-data')
const calendarGraph = document.querySelector('.month-calendar-graph')
const calendarMonthContainers = document.querySelectorAll('.calendar-month-container')
const calendarMonthLabels = document.querySelectorAll('.calendar-month-label')
const calendarMonthBoxesContainers = document.querySelectorAll('.calendar-month-boxes-container')
const totalFocusCountEle = document.querySelector('.total-focus-count')

const WEEK = 'week'
const MONTH = 'month'
const YEAR = 'year'

const maxHeightOfGraph = monthBarsContainer.clientHeight - 15
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
exportDataBtn.addEventListener('click', async () => {
  await exportData()
})

importDataBtn.addEventListener('click', async () => {
  await importData()
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

    // setYAxis(maxValueOfGraph)
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
  // setYAxis(maxValueOfGraph, MONTH)
  setBars(thisMonthData, maxValueOfGraph, MONTH, totalDaysInCurrentMonth)
  setSimpleMetrics(monthlySum, monthCount, true)
  makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history)
  
  
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

// function setYAxis(maxValueOfGraph, range=WEEK) {
//   maxValueOfGraph = Math.round(maxValueOfGraph)
//   let n = 7
//   let axis = null
//   if(range === WEEK) {
//     axis = weekYAxis
//   }
//   else if(range === MONTH) {
//     axis = monthYAxis
//   }
//   let step = Math.ceil(maxValueOfGraph / n)
//   if (step % 2 === 1) step++
//   if (maxValueOfGraph < 2) step = 0.5
//   else if (step < 10 && step > 2) step = 5
//   else if (step > 10) step = 10
//   axis.innerHTML = ''
//   if(maxValueOfGraph === 0) return
//   for (let i = maxValueOfGraph; i >= 0; i = i - step) {
//     const marker = document.createElement('span')
//     marker.classList.add('marker')
//     marker.innerText = i
//     axis.appendChild(marker)
//   }
// }


function loadSettings(settings) {
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else {
    container.classList.remove('light')
  } 
}

function makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history) {
  let maxPomos = 0
  const boxes = []
  let totalFocus = 0
  let totalFocusCount = 0
  calendarMonthContainers.forEach((container, index) => {
    calendarMonthBoxesContainers[index].innerHTML = ''
    const m = calendarMonthContainers.length - index - 1
    const firstDayOfCurrentMonth = new Date(currentYear, currentMonth-m-1, 1).getDay() === 0 ? 6: new Date(currentYear, currentMonth-m-1, 1).getDay() - 1
    const firstDateOfCurrentMonth = new Date(currentYear, currentMonth-m, 1).getDate()
    const firstDayOfNextMonth = new Date(currentYear, currentMonth-m, 1)
    const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
    let noOfDaysThisMonth = lastDateOfCurrentMonth - firstDateOfCurrentMonth + 1 + firstDayOfCurrentMonth
    const currentMonthString = new Date(currentYear, currentMonth-m-1, 1).toLocaleString('default', { month: 'long' })
    calendarMonthLabels[index].innerText = currentMonthString
    let calendarCol = document.createElement('div')
    calendarCol.classList.add('calendar-col', 'first-calendar-col')
    for(let i = 1; i <= noOfDaysThisMonth; i++) {
      if(firstDayOfCurrentMonth >= i) continue
      const currentDate = new Date(currentYear, currentMonth-m-1, i - firstDayOfCurrentMonth)
      const currentDateWithMonth = currentDate.getDate()+'-'+(currentDate.getMonth()+1)
      const calendarBox = document.createElement('span')
      calendarBox.classList.add('calendar-box')
      if(currentDateWithMonth in history) {
        const data = history[currentDateWithMonth]
        let focus = 0
        let breaks = 0
        let focusCount = 0
        data.forEach((d) => {
          if (d.type === 'focus') {
            focus += d.duration
            focusCount++
          }
          else if (d.type === 'break') breaks += d.duration
        })
        
        focus = parseFloat((focus).toFixed(2))
        totalFocus += focus
        totalFocusCount++
        breaks = parseFloat((breaks).toFixed(2))
        maxPomos = Math.max(maxPomos, focus)
        if(focus !== 0) {
          calendarBox.setAttribute('data-value', `${focusCount} pomodoro${focusCount > 1 ? 's': ''} of total ${focus > 60 ? Math.floor(focus/60) + ' hrs and ' + focus%60 + ' mins': focus +  ' mins'} on ${formatDateWithOrdinal(currentDate)}`)
          boxes.push({"ele": calendarBox, "focus": focus})
        } else {
          calendarBox.setAttribute('data-value', `0 pomodoros on ${formatDateWithOrdinal(currentDate)}`)
          boxes.push({"ele": calendarBox, "focus": 0})
        }
      } else {
        calendarBox.setAttribute('data-value', `0 pomodoros on ${formatDateWithOrdinal(currentDate)}`)
        boxes.push({"ele": calendarBox, "focus": 0})
      }
      calendarCol.appendChild(calendarBox)
      if(i%7 == 0 || i === noOfDaysThisMonth) {
        calendarMonthBoxesContainers[index].appendChild(calendarCol)
        calendarCol = document.createElement('div')
        calendarCol.classList.add('calendar-col')
      }
    }
  }) 

  const totalFocusString = parseFloat((totalFocus/60).toFixed(2)) > 24 ? Math.floor(parseFloat((totalFocus/60).toFixed(2))/24) + ' days and ' + Math.floor(parseFloat((totalFocus/60).toFixed(2))%24) + ' hrs' : parseFloat((totalFocus/60).toFixed(2)) + ' hrs'
  totalFocusCountEle.innerText = `${totalFocusCount} (${totalFocusString})`

  let delayIndex = 0
  boxes.forEach(box => {
    const {ele: boxEle, focus} = box
    let shade = ''
    const value = focus/maxPomos * 100
    if(value === 0) {
      shade = ''
    } else if (value < 25) {
      shade = '--primary-color-1'
    } else if (value < 50) {
      shade = '--primary-color-2'
    } else if (value < 75) {
      shade = '--primary-color-3'
    } else {
      shade = '--primary-color-4'
    }
    if(shade) {
      setTimeout(() => {
        boxEle.style.backgroundColor = `var(${shade})`
      }, 10*delayIndex);
      delayIndex++
    }
  })
}