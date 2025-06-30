import {
  clearHistory,
  exportData,
  formatDateWithOrdinal,
  formatTimeWithLabel,
  getLocalStorage,
  getSessionStorage,
  getSyncStorage,
  importData,
  setLocalStorage,
  setSampleHistory,
  setSessionStorage,
  getValidTask,
  updateOldHistoryDataToAccomodateLatestChanges,
  showCustomPrompt,
  getFocusOptionsForTasks,
  createNewTabForSettings,
  createNewTabForTimers,
  showCustomAlert
} from '../utils.js'
import { SETTINGSKEY, LIGHTTHEME, TASKS, chartColors, chartBorderColors, FOCUS, DARKTHEME, TASKSALIASKEY, TIMERKEY, modes, DAILYJOURNALLISTKEY } from '../constants.js'
import { CONFIG } from '../config.js'

const container = document.querySelector('.container')
const todayCount = document.querySelector('.today-count')
const weekCount = document.querySelector('.week-count')
const monthCount = document.querySelector('.month-count')
const yearCount = document.querySelector('.year-count')
const weekBars = document.querySelectorAll('.week-bar')
const monthBarsContainer = document.querySelector('.month-bars-container')
const sampleHistoryBtn = document.querySelector('.sample-history-btn')
const sampleHistoryRemoveBtn = document.querySelector('.sample-history-btn-remove')
const deleteHistoryBtn = document.querySelector('.delete-btn')
const userGuideBtn = document.querySelector('.user-guide-btn')
const deleteSomeContainer = document.querySelector('.delete-some-container')
const deleteSomeHistoryBtn = document.querySelector('.delete-some-btn')
const deleteDateInput = document.querySelector("#delete-date")
const exportDataBtn = document.querySelector('.export-btn')
const importDataBtn = document.querySelector('.import-btn')
const isSampleElement = document.querySelectorAll('.is-sample')
const noWeekDataElements = document.querySelectorAll('.week-no-data')
const noMonthDataElements = document.querySelectorAll('.month-no-data')
const calendarMonthContainers = document.querySelectorAll('.calendar-month-container')
const calendarMonthLabels = document.querySelectorAll('.calendar-month-label')
const calendarMonthBoxesContainers = document.querySelectorAll('.calendar-month-boxes-container')
const totalFocusCountEle = document.querySelector('.total-focus-count')
const dateInput = document.getElementById('date-range');
const resetButton = dateInput.parentElement.querySelector('button');
const loadingScreen = document.querySelector('.loading-screen')
const settingsBtn = document.querySelector('.settings-tab-btn')
const timerBtn = document.querySelector('.timer-tab-btn')
const supportBtn = document.querySelector('.support-tab-btn')
const supportLink = document.querySelector('.support-link')


supportBtn.href = CONFIG.SUPPORT_URL
supportLink.href = CONFIG.SUPPORT_URL

const today = new Date();
const threeYearsAgo = new Date();

today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
dateInput.value = today.toISOString().split('T')[0];
threeYearsAgo.setFullYear(today.getFullYear() - 3);
dateInput.max = today.toISOString().split('T')[0];
dateInput.min = threeYearsAgo.toISOString().split('T')[0];

let sampleHistory;
let sessions = []
let theme = DARKTHEME



const WEEK = 'week'
const MONTH = 'month'
const YEAR = 'year'

const maxHeightOfGraph = monthBarsContainer.clientHeight - 15
let maxValueOfGraph = 0

dateInput.addEventListener('change', async () => {
  const newValue = dateInput.value
  if(newValue !== today.toISOString().split('T')[0]) {
    if (resetButton) {
      resetButton.style.display = 'block';
    }
  }else if(resetButton) {
    resetButton.style.display = 'none';
  }
  await init()
} )

resetButton.addEventListener('click', async ()=> {
  dateInput.value = today.toISOString().split('T')[0];
  resetButton.style.display = 'none';
  await init()
})

sampleHistoryBtn.addEventListener('click', async () => {
  dateInput.disabled = true
  await setSampleHistory()
  await init()
})
sampleHistoryRemoveBtn.addEventListener('click', async () => {
  dateInput.disabled = false
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
    chrome.runtime.sendMessage({ type: 'DELETE_ALL_DATA' });
  }
})
userGuideBtn.addEventListener('click', async () => {
  await chrome.tabs.create({url:"src/userGuide/userGuide.html", active: true})
})
deleteDateInput.addEventListener('change', async () => {
  await generateSessionsToDelete()
  if(sessions && sessions.length !== 0) {
    deleteSomeHistoryBtn.disabled = false
  }else deleteSomeHistoryBtn.disabled = true
})
deleteSomeHistoryBtn.addEventListener('click', async () => {
  if(!sessions?.length) return
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
  chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
})

importDataBtn.addEventListener('click', async () => {
  await importData()
  chrome.runtime.sendMessage({ type: 'IMPORT_DATA' });
  location.reload()
})

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  if (store.settings?.theme === LIGHTTHEME) {
    document.body.classList.add('light')
    theme = LIGHTTHEME
  } else {
    document.body.classList.remove('light')
    theme = DARKTHEME
  }

  chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    if(request.saveSettings){
      location.reload()
      loadSettings(request.newSettings.settings)
    }else if(request.taskAliasUpdated) {
      location.reload()
    }
    })

  await init()
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove()
    }, 500)
  }, 200)
})

async function init() {
  maxValueOfGraph = 0
  const currentFullDate = new Date(dateInput.value)
  const currentYear = currentFullDate.getFullYear().toString()
  const currentDate = currentFullDate.getDate()
  const currentMonth = currentFullDate.getMonth() + 1
  const currentDay = currentFullDate.getDay() === 0 ? 6 : currentFullDate.getDay() - 1
  await updateOldHistoryDataToAccomodateLatestChanges(currentYear)
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

  // weekly metrics
  const currentWeekStart = new Date(currentFullDate)
  currentWeekStart.setDate(currentDate - currentDay)
  const weekDate = new Date(currentWeekStart)
  const thisWeekData = {}
  let weeklySum = 0

  const weeklyTasks = Object.keys(TASKS).reduce((acc, key) => {
    acc[TASKS[key]] = new Array(7).fill(0)
    return acc
  }, {})
  if (history) {
    for (let i = 1; i <= 7; i++) {
      const currentWeekDateWithMonth = weekDate.getDate() + '-' + (weekDate.getMonth() + 1)
      weekDate.setDate(weekDate.getDate() + 1)
      if (currentWeekDateWithMonth in history) {
        const data = history[currentWeekDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) focus += d.duration
          else breaks += d.duration
          const task = getValidTask(d.task, d.type)
          weeklyTasks[task][i-1] += d.duration
        })

        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))
        thisWeekData[i] = {
          focus,
          breaks
        }

        if (i-1 === currentDay) {
          setSimpleMetrics(focus, todayCount)
        }
        weeklySum += focus
        maxValueOfGraph = Math.max(focus, maxValueOfGraph)
      }
    }
  }

  if(!weeklySum) {
    noWeekDataElements.forEach(ele => ele.classList.add('active'))
  } else {
    noWeekDataElements.forEach(ele => ele.classList.remove('active'))
  }

  Object.keys(weeklyTasks).forEach(task => {
    weeklyTasks[task] = weeklyTasks[task].map(data => parseFloat((data / 60).toFixed(2)));
  });

  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    tasks: weeklyTasks
  };

    // setYAxis(maxValueOfGraph)
    setBars(thisWeekData, maxValueOfGraph)
    setSimpleMetrics(weeklySum, weekCount, true)
    await setWeeklyTasksChart(weeklyData)


  // monthly metrics
  const firstDayOfNextMonth = new Date(currentYear, currentMonth, 1)
  const lastDateOfCurrentMonth = new Date(firstDayOfNextMonth - 1).getDate()
  let totalDaysInCurrentMonth = 0
  const thisMonthData = {}
  let monthlySum = 0
  const monthlyTasks = Object.keys(TASKS).reduce((acc, key) => {
    acc[TASKS[key]] = 0
    return acc
  }, {})
  if(history) {
    for (let i = 1; i <= lastDateOfCurrentMonth; i++) {
      totalDaysInCurrentMonth++
      const date = new Date(currentYear, currentMonth - 1, i)
      const currentDateWithMonth = date.getDate() + '-' + (date.getMonth() + 1)
      
      if (currentDateWithMonth in history) {
        const data = history[currentDateWithMonth]
        let focus = 0
        let breaks = 0
        data.forEach((d) => {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) focus += d.duration
          else breaks += d.duration
          const task = getValidTask(d.task, d.type)
          monthlyTasks[task] += d.duration
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


  if(!monthlySum) {
    noMonthDataElements.forEach(ele => ele.classList.add('active'))
  } else {
    noMonthDataElements.forEach(ele => ele.classList.remove('active'))
  }
  setBars(thisMonthData, maxValueOfGraph, MONTH, totalDaysInCurrentMonth)
  setSimpleMetrics(monthlySum, monthCount, true)
  await makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history)

  Object.keys(monthlyTasks).forEach(task => {
    monthlyTasks[task] = parseFloat((monthlyTasks[task] / 60).toFixed(2));
  });
  await setMonthlyTasksChart(monthlyTasks)
  
  
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
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) focus += d.duration
          else breaks += d.duration
        })

        focus = parseFloat((focus / 60).toFixed(2))
        breaks = parseFloat((breaks / 60).toFixed(2))

        yearlySum += focus
      }
    }
  }
  setSimpleMetrics(yearlySum, yearCount, true)

  const today = new Date(dateInput.value);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(today.getDate()).padStart(2, '0');

  const formattedDate = `${year}-${month}-${day}`;

  deleteDateInput.value = formattedDate;
  await generateSessionsToDelete()
  if(!sessions?.length) deleteSomeHistoryBtn.disabled = true

  settingsBtn.addEventListener('click',async () => {
      await createNewTabForSettings()
    })
  timerBtn.addEventListener('click', async () => {
      await createNewTabForTimers(false, true)
    })
  chrome.runtime.sendMessage({ type: 'START_SESSION' });
  chrome.runtime.sendMessage({ type: 'PAGE_VIEW', properties: {
    currentUrl: window?.location?.href,
    pathName: 'history',
    screenWidth: window?.screen?.width,
    screenHeight: window?.screen?.height
  } });
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

let taskBarChart;
let taskPieChart;

async function setWeeklyTasksChart(weeklyData) {
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
  const datasets = Object.entries(weeklyData.tasks).map(([label, data], i) => ({
    label: (tasksAlias[label] || label),
    data,
    backgroundColor: chartColors[i],
    borderColor: chartBorderColors,
    borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 10, bottomRight: 10 },
    borderWidth: 1,
  }));

  const barCtx = document.getElementById('taskBarChart').getContext('2d');
  if (taskBarChart) {
    taskBarChart.destroy();
  }
  taskBarChart = new Chart(barCtx, {
    type: 'bar',
    data: { labels: weeklyData.labels, datasets },
    options: {
      responsive: true,
      scales: { 
        x: { 
          stacked: true,
          ticks: {
            color: theme === LIGHTTHEME ? '#000' : '#fff'
          },
          grid: {
            color: theme === LIGHTTHEME ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
          }
        }, 
        y: { 
          stacked: true,
          ticks: {
            color: theme === LIGHTTHEME ? '#000' : '#fff'
          },
          grid: {
            color: theme === LIGHTTHEME ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
          }
        } 
      },
      plugins: {
        legend: { 
          position: 'right',
          labels: {
            color: theme === LIGHTTHEME ? '#000' : '#fff'
          }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
                return ` ${context.dataset.label}: ${getTimeFormatted(context.raw)}`;
            }
          }
        }
      },
      barPercentage: 1,
      borderSkipped: false,
      categoryPercentage : .9
    }
  });
}

async function setMonthlyTasksChart(taskData) {
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
  const pieCtx = document.getElementById('taskPieChart').getContext('2d');
  if (taskPieChart) {
    taskPieChart.destroy();
  }
  taskPieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(taskData).map((label) => tasksAlias[label] || label),
      datasets: [{
        data: Object.values(taskData),
        backgroundColor: chartColors,
        borderColor: chartBorderColors,
        borderWidth: 3,
        borderRadius: 10,
        spacing: 5
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: theme === LIGHTTHEME ? '#000' : '#fff'
        }},
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
                return ' '+getTimeFormatted(context.raw);
            }
          }
        }
      },
      cutout: '40%'
    }
  });
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
    document.body.classList.add('light')
    theme = LIGHTTHEME
  }else {
    document.body.classList.remove('light')
    theme = DARKTHEME
  }
}

async function makecalendarGraph(currentYear, currentDate, currentMonth, currentDay, history) {
  let maxPomos = 0
  let prevYearHistory
  const boxes = []
  let totalFocus = 0
  let totalFocusCount = 0
  for(const [index] of calendarMonthContainers.entries()) {
    const m = calendarMonthContainers.length - index - 1
    const previousYear = (new Date(dateInput.value).getFullYear() - 1).toString()
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
      const data = (his && his[currentDateWithMonth]) ? his[currentDateWithMonth] : []
      const haveJournal = data[0] && data[0][DAILYJOURNALLISTKEY] && data[0][DAILYJOURNALLISTKEY].length > 0
      if(his && currentDateWithMonth in his) {
        let focus = 0
        let breaks = 0
        let focusCount = 0
        for(const d of data) {
          if (d?.type?.toLowerCase() === FOCUS.toLowerCase()) {
            focus += d.duration
            focusCount++
          }
          else breaks += d.duration
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

      if(haveJournal) {
          calendarBox.classList.add('has-journal')
        }
      calendarBox.addEventListener('click', async (e) => {
        
        // Only allow editing if the date is less than 6 months from today
        const boxDate = new Date(currentYear, currentMonth - m - 1, i - firstDayOfCurrentMonth);
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        const editable = boxDate > sixMonthsAgo;
        const journalList = data[0] ? data[0][DAILYJOURNALLISTKEY] : []
          let anyChange = false
          const journalListContainer = document.querySelector('.journal-list-bg')
          const dailyJournalListSubContainer = journalListContainer.querySelector('.daily-journal-list');
          const dailyJournalAddBtn = journalListContainer.querySelector('.add-btn')
          const dailyJournalDeleteBtns = journalListContainer.querySelectorAll('.dlt-btn')
          const dailyJournalCheckboxes = journalListContainer.querySelectorAll('.journal-checkbox')
          const title = journalListContainer.querySelector('#title')
          title.innerText = `Daily Journal for ${formatDateWithOrdinal(currentDate)}`
          const crossBtn = document.querySelector('.cross-btn')
          journalListContainer.classList.add('show');
          journalListContainer.addEventListener('click', (e) => {
            if (e.target === journalListContainer) {
              journalListContainer.classList.remove('show');
              anyChange && location.reload()
              
            }
          });
          crossBtn.addEventListener('click', (e) => {
            journalListContainer.classList.remove('show');
              anyChange && location.reload()
          });
          if(!editable) {
            dailyJournalAddBtn.disabled = true
            dailyJournalDeleteBtns.forEach(btn => {
              btn.disabled = true
            })
            dailyJournalCheckboxes.forEach(checkbox => {
              checkbox.disabled = true
            })
          }
          else {
            dailyJournalAddBtn.disabled = false
            dailyJournalDeleteBtns.forEach(btn => {
              btn.disabled = false
            })
            dailyJournalCheckboxes.forEach(checkbox => {
              checkbox.disabled = false
            })
          }
          dailyJournalAddBtn.addEventListener('click', async ()=> {
            if(!editable) return
            showCustomPrompt(
              "Add a daily journal item!",
              `What would you like to add to your daily journal?`,
              '',
              async (response) => {
                if (response !== null && response.trim() !== "") {
                  const year = currentDate.getFullYear().toString();
                  const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`;
                  const history = await getLocalStorage(year);
                  let yearObj = history[year] || {};
                  let dayObj = yearObj[monthDay] || [{}];
                  let journalList = dayObj[0][DAILYJOURNALLISTKEY] || [];
                  journalList.push({ id: Date.now() + Math.random().toString(36), item: response.trim(), completed: false });
        
                  dayObj[0][DAILYJOURNALLISTKEY] = journalList;
                  yearObj[monthDay] = dayObj;
                  history[year] = yearObj;
                  await setLocalStorage({[year]: history[year]});
                  initJournal(journalList)
                  anyChange = true
                  chrome.runtime.sendMessage({ type: 'DAILY_JOURNAL_ADDED', response: response.trim() });
                }
              }
            );
          })

          initJournal()
          function initJournal(newJournalList=null) {
            const list = (newJournalList ?? journalList ?? []);
            if (list.length === 0) {
              dailyJournalListSubContainer.style.display = 'flex'
              dailyJournalListSubContainer.style.justifyContent = 'center'
              dailyJournalListSubContainer.style.alignItems = 'center'
              dailyJournalListSubContainer.innerHTML = `<span style="display: inline-block;opacity:0.6;text-align:center; padding-inline: auto;">You don't have any journals for this day</span>`;
            } else {
              dailyJournalListSubContainer.innerHTML = list
                .map((dailyJournal, index) => `
                  <li>
                    <input type="checkbox" class='journal-checkbox' id="dailyJournal-${index}" data-index="${index}" ${dailyJournal.completed ? 'checked' : ''}>
                    <label for="dailyJournal-${index}">${dailyJournal.item}</label>
                    <button class='dlt-btn' data-index="${index}"></button>
                  </li>
                `)
                .join('');
            }
                
                dailyJournalListSubContainer.querySelectorAll('.dlt-btn').forEach(button => {
                  button.addEventListener('click', async (event) => {
                    showCustomAlert('Are you sure you want to delete this item?', 'This action cannot be undone.', async (response) => {
                      if(response) {
                        if(!editable) return
                        anyChange = true
                        const idx = event.target.dataset.index;
                        const year = currentDate.getFullYear().toString();
                        const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`;
                        const history = await getLocalStorage(year);
                        let yearObj = history[year] || {};
                        let dayObj = yearObj[monthDay] || [{}];
                        let journalList = dayObj[0][DAILYJOURNALLISTKEY] || [];
                        const updatedDailyJournalList = journalList.filter((_, i) => i !== parseInt(idx, 10));
                        dayObj[0][DAILYJOURNALLISTKEY] = updatedDailyJournalList;
                        yearObj[monthDay] = dayObj;
                        history[year] = yearObj;
                        await setLocalStorage({[year]: history[year]});
                        initJournal(updatedDailyJournalList)
                      }
                    })
                  });
                });
  
                dailyJournalListSubContainer.addEventListener('change', async (event) => {
                  if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
                    if(!editable) return
                    anyChange = true
                    const idx = event.target.dataset.index;
                    const year = currentDate.getFullYear().toString();
                    const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`;
                    const history = await getLocalStorage(year);
                    let yearObj = history[year] || {};
                    let dayObj = yearObj[monthDay] || [{}];
                    let journalList = dayObj[0][DAILYJOURNALLISTKEY] || [];
                    const updatedTodoList = [...journalList];
                    updatedTodoList[idx] = {
                      ...updatedTodoList[idx],
                      completed: event.target.checked,
                    };
                    dayObj[0][DAILYJOURNALLISTKEY] = updatedTodoList;
                    yearObj[monthDay] = dayObj;
                    history[year] = yearObj;
                    await setLocalStorage({[year]: history[year]});
                  }
                });
          }
      });
      calendarBox.setAttribute('data-date', currentDateWithMonth)
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
  container.innerHTML = "<p style='text-align:center; opacity: 0.5;'>No sessions for the selected date</p>";
  if(sessions.length === 0 || (sessions.length === 1 && sessions[0]['dailyJournalList'])) return
  container.innerHTML = "";
  const table = document.createElement("table");
  table.className = "sessions-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const headers = ["Start Time", "End Time", "Duration", "Task", "Mode","Select"];
  headers.forEach((headerText, index) => {
    const th = document.createElement("th");
    if (headerText === "Select") {
      const selectAllCheckbox = document.createElement("input");
      selectAllCheckbox.type = "checkbox";
      selectAllCheckbox.style.margin = "0";
      selectAllCheckbox.style.width = "100%";
      selectAllCheckbox.addEventListener("change", (e) => {
        const checkboxes = container.querySelectorAll(".session-checkbox");
        checkboxes.forEach((checkbox) => {
          checkbox.checked = e.target.checked;
          const row = checkbox.closest("tr");
          row.style.backgroundColor = checkbox.checked ? "#733a8e31" : "";
        });
      });
      th.appendChild(selectAllCheckbox);
    } else {
      th.textContent = headerText;
    }
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let id = 0; id < sessions.length; id++) {
    const session = sessions[id];
    const tasksAliasObj = await getLocalStorage(TASKSALIASKEY);
    const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {};

    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    const startCell = document.createElement("td");
    startCell.textContent = formatTimeWithLabel(session.startTime);
    if (startCell.textContent === '') continue;
    row.appendChild(startCell);

    const endCell = document.createElement("td");
    endCell.textContent = formatTimeWithLabel(session.endTime);
    if (endCell.textContent === '') continue;
    row.appendChild(endCell);

    const durationCell = document.createElement("td");
    const duration = session.duration;
    durationCell.textContent = `${duration} mins`;
    row.appendChild(durationCell);

    const taskCell = document.createElement("td");
    taskCell.classList.add("task-cell")
    const taskSpan = document.createElement("span");
    let task = getValidTask(session.task, session.type);
    taskSpan.textContent = tasksAlias[task];
    taskSpan.classList.add("task-span");
    taskSpan.style.backgroundColor = chartColors[Object.values(TASKS).indexOf(task)];

    if(task !== TASKS.REST) {
      const editIcon = document.createElement("img");
      editIcon.src = "/icons/pencil.png"; // Path to the PNG image
      editIcon.classList.add("edit-icon");
      editIcon.style.cursor = "pointer";
      editIcon.style.marginLeft = "8px";
      taskSpan.appendChild(editIcon);
      taskSpan.classList.add('editable')
      taskCell.addEventListener("click", async (e) => editTask(e, id, task, session));
    }

    taskCell.appendChild(taskSpan);

    row.appendChild(taskCell);

    const modeCell = document.createElement("td");
    const modeSpan = document.createElement("span");
    modeSpan.textContent = session?.mode === modes.STOPWATCH ? '⏲️' : '🍅';
    modeSpan.style.textAlign = "center";
    modeSpan.style.width = "100%";
    modeSpan.style.display = "inline-block";
    modeSpan.style.fontSize = "1.3em";
    modeSpan.classList.add("mode-span");
    modeCell.appendChild(modeSpan);
    row.appendChild(modeCell);

    const checkboxCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "session-checkbox";
    checkbox.checked = false;
    checkbox.name = id;
    checkbox.id = id;
    checkbox.style.margin = "0";
    checkbox.style.width = "100%";
    checkboxCell.appendChild(checkbox);
    row.appendChild(checkboxCell);
    row.addEventListener("click", () => {
      checkbox.checked = !checkbox.checked;
      row.style.backgroundColor = checkbox.checked ? "#733a8e31" : "";
    });
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent the row click from being triggered when the checkbox is clicked
      row.style.backgroundColor = checkbox.checked ? "#733a8e31" : "";
    });
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

async function editTask(e, id, task, session) {
  e.stopPropagation();
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}

  showCustomPrompt(
    "🪻 Edit Task! 🪻",
    `${formatTimeWithLabel(session.startTime)} ▶ ${formatTimeWithLabel(session.endTime)}\n\nSelect the new task name:`, 
    task,
    async (response) => {
      if (response !== null) {
        const dateSelected = deleteDateInput.value
        if(dateSelected) {
          let currentYear = dateSelected.substring(0,4)
          let currentDateStr = dateSelected.split('-')[2][0] === '0' ? dateSelected.split('-')[2][1] : dateSelected.split('-')[2]
          let currentMonthStr = dateSelected.split('-')[1][0] === '0' ? dateSelected.split('-')[1][1] : dateSelected.split('-')[1]
          const currentDateInHistory = currentDateStr+'-'+currentMonthStr
          const oldHistoryObj = await getLocalStorage(currentYear)
          const oldHistory = oldHistoryObj[currentYear]

          let todaysPomodoros = oldHistory[currentDateInHistory]?.map((pom,index) => {
            if(index === id) {
              return {...pom, task: response}
            } else return pom
          })
          
        
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
  }, "select", "", getFocusOptionsForTasks(tasksAlias));
}