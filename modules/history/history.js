import {
  clearHistory,
  exportData,
  formatDateWithOrdinal,
  getLocalStorage,
  getSessionStorage,
  getSyncStorage,
  importData,
  setLocalStorage,
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
const deleteSomeContainer = document.querySelector('.delete-some-container')
const deleteSomeHistoryBtn = document.querySelector('.delete-some-btn')
const deleteDateInput = document.querySelector("#delete-date")
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
let sampleHistory;
let sessions = []


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
  if(confirm("Are you sure you wanna delete all of your history for this year?")) {
    await clearHistory()
    await init()
  }
})
deleteDateInput.addEventListener('change', async () => {
  await generateSessionsToDelete()
  if(sessions && sessions.length !== 0) {
    deleteSomeHistoryBtn.disabled = false
  }else deleteSomeHistoryBtn.disabled = true
})
deleteSomeHistoryBtn.addEventListener('click', async () => {
  if(!sessions || !sessions.length) return
  const checkboxes = container.querySelectorAll('.session-checkbox');
  const checkedSessions = new Set;

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const sessionId = checkbox.id;
      checkedSessions.add(parseInt(sessionId));
    }
  });
  if(!checkedSessions.size) return
  if(confirm("Are you sure you wanna delete selected sessions from your history?")) {
    const dateSelected = deleteDateInput.value
    if(dateSelected) {
    let currentYear = dateSelected.substring(0,4)
    let currentDateStr = dateSelected.split('-')[2][0] === '0' ? dateSelected.split('-')[2][1] : dateSelected.split('-')[2]
    let currentMonthStr = dateSelected.split('-')[1][0] === '0' ? dateSelected.split('-')[1][1] : dateSelected.split('-')[1]
    const currentDateInHistory = currentDateStr+'-'+currentMonthStr
    const container = document.querySelector('.specific-sessions-container');
    const oldHistoryObj = await getLocalStorage(currentYear)
    const oldHistory = oldHistoryObj[currentYear]

    let todaysPomodoros = oldHistory[currentDateInHistory]?.filter((pom,index) => !checkedSessions.has(index))
  
    if(todaysPomodoros !== undefined) {
      oldHistory[currentDateInHistory] = [...todaysPomodoros]
      await setLocalStorage({[currentYear]: {
        ...oldHistory
        } 
      })
    
      await generateSessionsToDelete()
      }
    }
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
  sampleHistory = sampleHistoryObj[currentYear]
  const historyObj = await getLocalStorage(currentYear)
  const history = sampleHistory ?? historyObj[currentYear]

  if(!sampleHistory){ 
    sampleHistoryBtn.classList.add('active')
    sampleHistoryRemoveBtn.classList.remove('active')
    isSampleElement.forEach(el => el.classList.remove('active'))
    deleteSomeContainer.classList.remove('disable')
  }
  else {
    sampleHistoryBtn.classList.remove('active')
    sampleHistoryRemoveBtn.classList.add('active')
    isSampleElement.forEach(el => el.classList.add('active'))
    deleteSomeContainer.classList.add('disable')
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
  await makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history)
  
  
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

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(today.getDate()).padStart(2, '0');

  const formattedDate = `${year}-${month}-${day}`;

  deleteDateInput.value = formattedDate;
  await generateSessionsToDelete()
  if(!sessions || !sessions.length) deleteSomeHistoryBtn.disabled = true
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


function loadSettings(settings) {
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else {
    container.classList.remove('light')
  } 
}

async function makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history) {
  let maxPomos = 0
  let prevYearHistory = undefined
  const boxes = []
  let totalFocus = 0
  let totalFocusCount = 0
  for(const [index, conatainer] of calendarMonthContainers.entries()) {
    const m = calendarMonthContainers.length - index - 1
    const previousYear = (new Date().getFullYear() - 1).toString()
    const curDate = new Date(currentYear, currentMonth-m-1, 1)
    if(curDate.getFullYear().toString() === previousYear) {
      const historyObj = await getLocalStorage(previousYear)
      if(historyObj && !prevYearHistory) {
        prevYearHistory = historyObj[previousYear]
      }
    } else prevYearHistory = undefined
    calendarMonthBoxesContainers[index].innerHTML = ''
    const firstDayOfCurrentMonth = new Date(currentYear, currentMonth-m-1, 1).getDay() === 0 ? 6: new Date(currentYear, currentMonth-m-1, 1).getDay() - 1
    const firstDateOfCurrentMonth = new Date(currentYear, currentMonth-m, 1).getDate()
    const firstDayOfNextMonth = new Date(currentYear, currentMonth-m, 1)
    const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
    let noOfDaysThisMonth = lastDateOfCurrentMonth - firstDateOfCurrentMonth + 1 + firstDayOfCurrentMonth
    const currentMonthString = new Date(currentYear, currentMonth-m-1, 1).toLocaleString('default', { month: 'long' })
    calendarMonthLabels[index].innerText = currentMonthString
    let calendarCol = document.createElement('div')
    calendarCol.classList.add('calendar-col', 'first-calendar-col')
    const his = prevYearHistory || history
    for(let i = 1; i <= noOfDaysThisMonth; i++) {
      if(firstDayOfCurrentMonth >= i) continue
      const currentDate = new Date(currentYear, currentMonth-m-1, i - firstDayOfCurrentMonth)
      const currentDateWithMonth = currentDate.getDate()+'-'+(currentDate.getMonth()+1)
      const calendarBox = document.createElement('span')
      calendarBox.classList.add('calendar-box')
      if(his && currentDateWithMonth in his) {
        const data = his[currentDateWithMonth]
        let focus = 0
        let breaks = 0
        let focusCount = 0
        for(const d of data) {
          if (d.type === 'focus') {
            focus += d.duration
            focusCount++
          }
          else if (d.type === 'break') breaks += d.duration
        }
        
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
  }

  const totalFocusString = parseFloat((totalFocus/60).toFixed(2)) > 24 ? Math.floor(parseFloat((totalFocus/60).toFixed(2))/24) + ' days and ' + Math.floor(parseFloat((totalFocus/60).toFixed(2))%24) + ' hrs' : parseFloat((totalFocus/60).toFixed(2)) + ' hrs'
  totalFocusCountEle.innerText = `${totalFocusCount} (${totalFocusString})`

  let delayIndex = 0
  boxes.forEach(box => {
    const {ele: boxEle, focus} = box
    let shade = ''
    const value = focus && maxPomos ? focus/maxPomos * 100 : 0
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

async function getSessions() {
  const dateSelected = deleteDateInput.value
  if(dateSelected.split('-').length !== 3){
    sessions = []
    return
  }
  let currentYear = dateSelected.split('-')[0]
  let currentDate = dateSelected.split('-')[2][0] === '0' ? dateSelected.split('-')[2][1] : dateSelected.split('-')[2]
  let currentMonth = dateSelected.split('-')[1][0] === '0' ? dateSelected.split('-')[1][1] : dateSelected.split('-')[1]
  const currentDateInHistory = currentDate+'-'+currentMonth
  const history = (await getLocalStorage(currentYear))[currentYear]
  if(history) sessions = history[currentDateInHistory]
  else sessions = []
}

async function generateSessionsToDelete() {
  await getSessions()
  if(!sessions) sessions = []
  const container = document.querySelector(".specific-sessions-container");
  container.innerHTML = "<div style='text-align:center;'>Select a date to view sessions</div>";
  if(sessions.length === 0) return
  container.innerHTML = "";
  const table = document.createElement("table");
  table.className = "sessions-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const headers = ["Start Time", "End Time", "Duration", "Type", "Delete"];
  headers.forEach(headerText => {
    const th = document.createElement("th");
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  sessions && sessions.forEach((session, id) => {
    const row = document.createElement("tr");

    const startCell = document.createElement("td");
    startCell.textContent = session.startTime;
    row.appendChild(startCell);

    const endCell = document.createElement("td");
    endCell.textContent = session.endTime;
    row.appendChild(endCell);

    const durationCell = document.createElement("td");
    const duration = session.duration
    durationCell.textContent = `${duration} mins`;
    row.appendChild(durationCell);

    const typeCell = document.createElement("td");
    typeCell.textContent = session.type === 'focus' ? '⏳' : '🎈';
    row.appendChild(typeCell);

    const checkboxCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "session-checkbox";
    checkbox.checked = false;
    checkbox.name = id;
    checkbox.id = id;
    checkboxCell.appendChild(checkbox);
    row.appendChild(checkboxCell);
    row.addEventListener("click", () => {
      checkbox.checked = !checkbox.checked;
    });
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent the row click from being triggered when the checkbox is clicked
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);

}