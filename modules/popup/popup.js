import {
  printer,
  timerDuration,
  getTimeString,
  changeTextTo,
  getSessionStorage,
  getSyncStorage,
  getFocusText,
  resumeTimer, 
  createNewTabForTimers,
  createNewTabForSettings,
  createNewTabForHistory,
  setSessionStorage,
  getValidTask,
  createNewTabForStreak,
  getLocalStorage,
  setLocalStorage} from "../utils.js"
import {
  PLAY,
  PAUSE,
  FOCUS,
  LONGBREAK,
  SIMPLETIMERSTYLE,
  LIGHTTHEME,
  TIMERKEY,
  SETTINGSKEY,
  TASKS,
  TASKSALIASKEY,
  CURRENTTASKKEY,
  showSurvey
 } from "../constants.js"
import { CONFIG } from "../config.js"

const container = document.querySelector('.container')
const timer = document.querySelector('.timer')
const focusBtn = document.querySelector('.focus-btn')
const focusBtnText = document.querySelector('#focus-btn-text')
const focusTitle = document.querySelector('.focus-title')
const untilLongBreakCount = document.querySelector('#until-long-count')
const untilLongBreak = document.querySelector('.until-long')
const stopBtn = document.querySelector('.focus-btn-stop')
const nextBtn = document.querySelector('.focus-btn-next')
const timerTag = document.querySelector('.timer-tag')
const pollBtn = document?.querySelector(".poll-btn")


const settingsBtn = document.querySelector('.settings-tab-btn')
const historyBtn = document.querySelector('.history-tab-btn')
const streakBtn = document.querySelector('.streak-tab-btn')
const supportBtn = document.querySelector('.support-tab-btn')
const rateBtn = document.querySelector('.rate-tab-btn')
const taskSelect = document.getElementById('tasks-select')
const taskEdit = document.querySelector('.task-edit')

const print = printer()

// listening messages
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  // tick with timer
  if (request.time) {
    changeTextTo(timer, request.time)
    print.log('UI --> ' + request.time)
  }

  if(request.updateNextTimer) {
    console.log('come')
    await updateNextTimer()
  }
  else if(request.saveSettings) {
    const store = await getSyncStorage(SETTINGSKEY)
    if(store?.settings?.theme === LIGHTTHEME) {
      container.classList.add('light')
    }else container.classList.remove('light')
    if(store?.settings?.timerStyle === SIMPLETIMERSTYLE) {
      timerTag.classList.remove('cat-walk')
      timerTag.classList.add('simple')
    }else {
      timerTag.classList.remove('simple')
      timerTag.classList.add('cat-walk')
    }
  }
  else if(request.taskChange) {
    taskSelect.value = request.taskChange
  }
  else if(request.taskAliasUpdated) {
    await setFocusOptionForTasks()
  }
})

const updateNextTimer = async () => {
  console.log('update man')
  print.log('udateNextTimer (UI change)')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  const result = await getSessionStorage(TIMERKEY)
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  await handleUntilLongBreakCount(settingsObj.settings, result.timer)
  changeTextTo(timer, getTimeString(timerDuration(result.timer.type, settingsObj?.settings)*60, false))
  if(!result?.timer || result?.timer?.type === FOCUS) {
    await setFocusOptionForTasks(result?.timer)
    return
  }
  await setRestOptionForTasks()
  changeTextTo(focusBtnText, 'Start ' + result.timer.type)
  changeTextTo(focusTitle, result.timer.type)
}

async function handleUntilLongBreakCount(settings, timer, tryOnce=false) {
  if(parseInt(settings.longBreak.interval) !== 0 && timer?.type !== LONGBREAK){
    changeTextTo(untilLongBreakCount, parseInt(settings.longBreak.interval) - (timer ? timer.counts : 0) + 1)
    untilLongBreak.style.visibility = 'visible'
  }else{
    untilLongBreak.style.visibility = 'hidden'
  }
  if(!timer && !tryOnce) {
    const sessionStore = await getSessionStorage(TIMERKEY)
    if(sessionStore.timer)
    await handleUntilLongBreakCount(settings, sessionStore.timer, true)
  }
}

// on DOM loading
document.addEventListener('DOMContentLoaded', async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  let settings = store.settings
  if(settings?.theme === LIGHTTHEME) {
    container.classList.add('light')
  }else container.classList.remove('light')
  if(settings?.timerStyle === SIMPLETIMERSTYLE) {
    timerTag.classList.remove('cat-walk')
    timerTag.classList.add('simple')
  }else {
    timerTag.classList.remove('simple')
    timerTag.classList.add('cat-walk')
  }
  const sessionStore = await getSessionStorage(TIMERKEY)
  changeTextTo(timer, getTimeString(timerDuration(sessionStore?.timer?.type, settings)*60, false))
  await handleUntilLongBreakCount(settings, sessionStore.timer)
  if(!sessionStore?.timer || sessionStore?.timer?.type === FOCUS) await setFocusOptionForTasks(sessionStore.timer)
  else await setRestOptionForTasks()
  if(sessionStore?.timer?.type === LONGBREAK) changeTextTo( untilLongBreak, '')
  if(sessionStore?.timer && (sessionStore?.timer?.status === PLAY || sessionStore?.timer?.status === PAUSE)) {
    changeTextTo(timer, getTimeString(sessionStore.timer.time, false))
    changeTextTo(focusBtnText, getFocusText(sessionStore.timer, settings))
    changeTextTo(focusTitle, sessionStore.timer.type)
    stopBtn.classList.add('active')
    nextBtn.classList.add('active')
  }
  if(sessionStore?.timer && sessionStore?.timer?.status === PAUSE) {
    chrome.action.setBadgeText({text: getTimeString(sessionStore.timer.time)})
    chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
  }
  focusBtn.addEventListener('click', async () => {
    const timer = await getSessionStorage(TIMERKEY)
    // if started already
    if(timer?.timer) {
      print.log('Start -> ' + timer)
      if(timer.timer.status !== PAUSE) {
          // pause
          await pause(timer.timer)
        }else {
          // resume
          await resume(timer.timer)
        }
    }else {
      // initiate
      await initiateTimer()
    }
  })
  stopBtn.addEventListener('click',async () => {
    const store = await getSyncStorage(SETTINGSKEY)
    stopTimer(store.settings)
  })
  
  nextBtn.addEventListener('click', async () => {
    await nextTimer()
  })

  timerTag.addEventListener('click', async () => {
    await createNewTabForTimers(false, true)
  })

  settingsBtn.addEventListener('click',async () => {
    await createNewTabForSettings()
  })
  historyBtn.addEventListener('click',async () => {
    await createNewTabForHistory()
  })
  streakBtn.addEventListener('click',async () => {
    await createNewTabForStreak()
  })
  supportBtn.addEventListener('click',async function(event){
    event.preventDefault()
    chrome.tabs.create({ url: this.href, active: true })
  })
  rateBtn.addEventListener('click',async function(event){
    event.preventDefault()
    chrome.tabs.create({ url: this.href, active: true })
  })

  taskSelect.addEventListener('change', async (event) => {
    const selectedTask = event.target.value
    const timer = await getSessionStorage(TIMERKEY)
    if(timer.timer) {
      timer.timer.task = getValidTask(selectedTask, timer?.timer?.type)
      await setSessionStorage({timer: timer.timer})
      await chrome.runtime.sendMessage({taskChange: timer.timer.task})
      await setLocalStorage({[CURRENTTASKKEY]: timer.timer.task})
    }
    else {
      const timerObj = {
        time: null,
        status: PAUSE,
        type: FOCUS,
        counts: 0,
        task: getValidTask(selectedTask)
      };
      await setSessionStorage({ timer: timerObj });
      await chrome.runtime.sendMessage({ taskChange: timerObj.task });
      await setLocalStorage({ [CURRENTTASKKEY]: timerObj.task });
    }
  })

  taskEdit.addEventListener('click', async (event) => {
      const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
      const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
      const oldSelectedTask = taskSelect.value
      const oldTaskAlias = tasksAlias[oldSelectedTask] || oldSelectedTask
      showCustomPrompt(
        "🌱 Heads up! 🌱",
        "Renaming this task will update it everywhere, including history.\n\nEnter the new task name:", 
        oldTaskAlias,
        async (response) => {
          if (response !== null && response.length <= 10) {
            tasksAlias[oldSelectedTask] = response
            await chrome.runtime.sendMessage({taskAliasUpdated: true})
            await setLocalStorage({[TASKSALIASKEY]: tasksAlias})
            setFocusOptionForTasks()
          } else if (response !== null && response.length > 10) {
            showCustomAlert("Oops! 😋", "Task name should be less than 10 characters.", () => {})
          }
      });
    })
})

async function nextTimer() {
  try{
    await chrome.runtime.sendMessage({nextTimer: true})
  } catch (e) {
    console.warn(e);
  }
}

const stopTimer = async (settings) => {
  print.log('stop timer')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  changeTextTo(timer, getTimeString(settings.focus.time * 60, false))
  chrome.action.setBadgeText({text: ''})
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
  await handleUntilLongBreakCount(settings, null)
  try{
    await chrome.runtime.sendMessage({stopTimer: true})
  } catch (e) {
    console.warn(e);
  }
}

const pause = async (timer) => {
  print.log('pause timer')
  const timerObj = await getSessionStorage(TIMERKEY)
  try{
    await chrome.runtime.sendMessage({pauseTimer: true, timer: timerObj.timer})
  }catch (e) {
    console.warn(e);
  }
  changeTextTo(focusBtnText, 'Resume')
  changeTextTo(focusTitle, timer.type)
  chrome.action.setBadgeBackgroundColor({color: 'rgb(245, 176, 66)'})
}

const resume = async (timer) => {
  print.log('resume timer')
  const selectedTask = taskSelect.value
  timer.task = getValidTask(selectedTask, timer.type)
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type)
  await resumeTimer(timer)
}

const initiateTimer = async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  let settings = store.settings
  const selectedTask = taskSelect.value

  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const timerObj = {
      time: timerDuration(FOCUS, settings)*60,
      status: PLAY,
      type: FOCUS,
      counts: 0,
      task: getValidTask(selectedTask)
    }
    try{
      await chrome.runtime.sendMessage({startTimer: true, timer: timerObj})
    }catch (e) {
      console.warn(e);
    }
  })
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type ?? FOCUS)
  stopBtn.classList.add('active')
  nextBtn.classList.add('active')
}

if(showSurvey) {
  pollBtn.classList.add('active')
  const votePoll = document?.getElementById("votePoll")
    if(votePoll) {
      votePoll.addEventListener("click", function() {
      chrome.tabs.create({ url: CONFIG.POLL_FORM_URL });
    });
  }
}else {
  pollBtn.classList.remove('active')
}

async function setRestOptionForTasks() {
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
  taskSelect.innerHTML = Object.keys(TASKS)
                          .map(taskKey => {
                              const task = TASKS[taskKey]
                              const alias = tasksAlias[task] || task
                              return `<option value="${task}">${alias}</option>`
                          })
                          .join('')
  taskSelect.value = TASKS.REST
  taskSelect.disabled = true
}

async function setFocusOptionForTasks(timer) {
  if(!timer) {
    const result = await getSessionStorage(TIMERKEY)
    timer = result[TIMERKEY]
  }
  const tasksAliasObj = await getLocalStorage(TASKSALIASKEY)
  const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {}
  taskSelect.innerHTML = Object.keys(TASKS)
                          .filter(taskKey => TASKS[taskKey] !== TASKS.REST)
                          .map(taskKey => {
                              const task = TASKS[taskKey]
                              const alias = tasksAlias[task] || task
                              return `<option value="${task}">${alias}</option>`
                          })
                          .join('')
  taskSelect.value = getValidTask(timer?.task)
  taskSelect.disabled = false
}

function showCustomPrompt(title, message, value, callback) {
  const modal = document.getElementById("customPrompt");
  const promptMessage = document.getElementById("promptMessage");
  const promptTitle = document.getElementById("promptTitle");
  const promptInput = document.getElementById("promptInput");
  const promptOk = document.getElementById("promptOk");
  const promptCancel = document.getElementById("promptCancel");

  if (!title) promptTitle.style.display = "none";
  else promptTitle.innerHTML = title;

  promptMessage.innerHTML = message.replace(/\n/g, "<br>");
  promptInput.value = value;
  promptInput.focus();
  modal.style.display = "flex";

  setTimeout(() => promptInput.focus(), 0);

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      promptOk.click();
    }else if (event.key === "Escape") {
      event.preventDefault();
      promptCancel.click();
    }
  }

  promptInput.addEventListener("keydown", handleKeyDown);

  function closeModal() {
    modal.style.display = "none";
    promptInput.removeEventListener("keydown", handleKeyDown);
  }

  promptOk.onclick = function () {
    closeModal();
    callback(promptInput.value);
  };

  promptCancel.onclick = function () {
    closeModal();
    callback(null);
  };
}

function showCustomAlert(title, message, callback) {
  const modal = document.getElementById("customAlert");
  const alertMessage = document.getElementById("alertMessage");
  const alertTitle = document.getElementById("alertTitle");
  const alertOk = document.getElementById("alertOk");

  if (!title) alertTitle.style.display = "none";
  else alertTitle.innerHTML = title;

  alertMessage.innerHTML = message.replace(/\n/g, "<br>");
  modal.style.display = "flex";

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      alertOk.click();
    }
  }

  alertOk.onclick = function () {
    modal.style.display = "none";
    document.removeEventListener("keydown", handleKeyDown);
    callback(true);
  };
  setTimeout(() => document.addEventListener("keydown", handleKeyDown), 100);
}