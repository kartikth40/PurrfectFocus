import { CONFIG } from "../config.js"
import { SETTINGSKEY, TIMERKEY, FOCUS, SHORTBREAK, LONGBREAK, PAUSE, PLAY, LIGHTTHEME, SIMPLETIMERSTYLE, TASKS, TASKSALIASKEY, CURRENTTASKKEY, showSurvey } from "../constants.js"
import { changeTextTo, createNewTabForHistory, createNewTabForSettings, createNewTabForStreak, getFocusText, getLocalStorage, getRandomBreakQuote, getRandomFocusQuote, getSessionStorage, getSyncStorage, getTimeString, playMusic, printer, resumeTimer, setLocalStorage, setSessionStorage, timerDuration, getValidTask, setSyncStorage } from "../utils.js"

const container = document.querySelector('.container')
const focusTitle = document.querySelector('.focus-title')
const focusBtn = document.querySelector('.focus-btn')
const focusBtnText = document.querySelector('.focus-btn-text')
const timerTag = document.querySelector('.timer-tag')
const timerEle = document.querySelector('.timer')
const untilLongBreakCount = document.querySelector('#until-long-count')
const untilLongBreak = document.querySelector('.until-long')
const stopBtn = document.querySelector('.focus-btn-stop')
const nextBtn = document.querySelector('.focus-btn-next')
const quote = document.querySelector('.quote')
const breakActivitiesSuggestions = document.querySelector('.break-suggestions-container')
const settingsBtn = document.querySelector('.settings-tab-btn')
const historyBtn = document.querySelector('.history-tab-btn')
const streakBtn = document.querySelector('.streak-tab-btn')
const taskSelect = document.getElementById('tasks-select')
const taskEdit = document.querySelector('.task-edit')
const timerEdit = document.querySelector('.timer-edit')
const pollBtn = document?.querySelector(".poll-btn")


let audio = null
let settings
let musicPlayerInitialized = false


const print = printer()
document.addEventListener('DOMContentLoaded', async () => {
  // await handleNotificationTone(true)
  addEventListeners()
  await init()
})
async function init() {
  const timer = await getSessionStorage(TIMERKEY)
  if(!timer?.timer || timer?.timer?.type === FOCUS) {
    untilLongBreak.style.visibility = 'visible'
    focusTitle.innerText = 'Start Focusing'
    focusBtnText.innerText = 'Start Focusing'
    breakActivitiesSuggestions.classList.remove('show')
    updateFocusQuote()
    await setFocusOptionForTasks(timer?.timer)
  }
  else if(timer.timer.type === SHORTBREAK) {
    untilLongBreak.style.visibility = 'visible'
    focusTitle.innerText = 'Take a Short Break'
    focusBtnText.innerText = 'Start Short Break'
    breakActivitiesSuggestions.classList.add('show')
    updateBreakQuote()
    await setRestOptionForTasks()
  }else {
    untilLongBreak.style.visibility = 'hidden'
    focusTitle.innerText = 'Take a Long Break'
    focusBtnText.innerText = 'Start Long Break'
    breakActivitiesSuggestions.classList.add('show')
    updateBreakQuote()
    await setRestOptionForTasks()
  }
  const store = await getSyncStorage(SETTINGSKEY)
  settings = store.settings
  loadSettings(settings)
  const interval = parseInt(settings.longBreak.interval)
  const timerCounts = timer.timer ? timer.timer.counts : 0
  untilLongBreakCount.innerText = interval - timerCounts + 1
  await handleUntilLongBreakCount(settings, timer.timer)
  if(timer?.timer?.type === LONGBREAK) changeTextTo( untilLongBreak, '')
  if(timer?.timer && (timer?.timer?.status === PLAY || timer?.timer?.status === PAUSE)) {
    console.log('Timer is running', timer)
    changeTextTo(timerEle, getTimeString(timer.timer.time, false))
    changeTextTo(focusBtnText, getFocusText(timer.timer, settings))
    stopBtn.classList.add('active')
    nextBtn.classList.add('active')
  }
  if(timer?.timer && timer?.timer?.status === PAUSE) {
    chrome.action.setBadgeText({text: getTimeString(timer.timer.time)})
    chrome.action.setBadgeBackgroundColor({color: 'rgb(255, 202, 118)'})
  }
  if(!timer?.timer) {
    stopBtn.classList.remove('active')
    nextBtn.classList.remove('active')
  }
  await setLocalStorage({ lastActive: Date.now() })
  if(settings.musicPlayer && !musicPlayerInitialized) setupMusicPlayer()
  else removeMusicPlayer()
}

function setupMusicPlayer() {
  document.getElementById("music-player").classList.add('show')
  document.getElementById("play-pause").addEventListener("click", togglePlayPause);
  document.getElementById("next").addEventListener("click", nextTrack);
  document.getElementById("prev").addEventListener("click", prevTrack);
  document.getElementById("category-select").addEventListener("change", changeCategory);
  settings.musicPlayer = true
}

function removeMusicPlayer() {
  document.getElementById("music-player").classList.remove('show')
  document.getElementById("play-pause").removeEventListener("click", togglePlayPause);
  document.getElementById("next").removeEventListener("click", nextTrack);
  document.getElementById("prev").removeEventListener("click", prevTrack);
  document.getElementById("category-select").removeEventListener("change", changeCategory);
  settings.musicPlayer = false
}

async function pauseMusic() {
  if(audio) {
    await audio.pause();
    document.getElementById("play-pause").classList.remove('pause')
    document.getElementById("play-pause").classList.add('play')
  }
}

async function togglePlayPause() {
  if(!audio) {
    await loadTrack()
    document.getElementById("play-pause").classList.remove('play')
    document.getElementById("play-pause").classList.add('pause')
  }
  else if (audio.paused) {
    await audio.play();
    document.getElementById("play-pause").classList.remove('play')
    document.getElementById("play-pause").classList.add('pause')
  } else {
    await audio.pause();
    document.getElementById("play-pause").classList.remove('pause')
    document.getElementById("play-pause").classList.add('play')
  }
}

async function nextTrack() {
  await loadTrack(null, 1);
}

async function prevTrack() {
  await loadTrack(null, -1);
}

async function loadTrack(category = null, nextIndex=null) {
  if(audio){
    await audio.pause();
    audio.currentTime = 0;
    audio.removeEventListener("ended", nextTrack);
    audio = null;
  }
  let currentlyPlaying = localStorage.getItem('currentlyPlaying')
  let currentCategory = category || 'FOCUS';
  let currentTrackIndex = 0;
  let currentTrack = '';
  if(currentlyPlaying) {
    let [category, index] = currentlyPlaying.split('-')
    if (category && !isNaN(index)) {
      currentCategory = category;
      currentTrackIndex = parseInt(index);
      if(nextIndex) {
        currentTrackIndex += nextIndex
      }
    }
    let playObj = await playMusic(currentCategory, currentTrackIndex)
    currentTrackIndex = playObj.index
    currentTrack = playObj.title
    audio = playObj.audio
    localStorage.setItem('currentlyPlaying', `${currentCategory}-${currentTrackIndex}`)
  }
  else {
    let playObj = await playMusic(currentCategory, null)
    currentTrackIndex = playObj.index
    currentTrack = playObj.title
    audio = playObj.audio
    localStorage.setItem('currentlyPlaying', `${currentCategory}-${currentTrackIndex}`)
  }
  currentTrack = currentTrack.replace(/-/g, ' ')
  document.getElementById("track-title").textContent = `${currentTrack}`;
  if (audio.paused) {
    audio.play();
  }
  document.getElementById("play-pause").classList.remove('play')
  document.getElementById("play-pause").classList.add('pause')
  audio.addEventListener("ended", nextTrack);
}

async function changeCategory(event) {
  localStorage.removeItem('currentlyPlaying')
  let currentCategory = event.target.value;
  await loadTrack(currentCategory);
}

function addEventListeners() {
  chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    const timer = await getSessionStorage(TIMERKEY)
    // tick with timer
    if (request.time) {
      changeTextTo(timerEle, request.time)
      if(settings.musicPlayer && settings.musicPlayerAutoStart && !audio) await loadTrack()
    }
    if(request.timerStarted){
      changeTextTo(focusBtnText, 'Pause')
      if(timer?.timer) changeTextTo(focusTitle, timer?.timer?.type)
      if(settings.musicPlayer && settings.musicPlayerAutoStart) await loadTrack()
    }
    else if(request.timerPaused){
      changeTextTo(focusBtnText, 'Resume')
      changeTextTo(focusTitle, timer.timer.type)
      await pauseMusic()
    }
    else if(request.updateNextTimer) {
      await updateNextTimer()
      await pauseMusic()
    }
    else if(request.timerStopped){
      changeTextTo(focusBtnText, 'Start Focusing')
      changeTextTo(focusTitle, 'Start Focusing')
      stopBtn.classList.remove('active')
      nextBtn.classList.remove('active')
      const store = await getSyncStorage(SETTINGSKEY)
      changeTextTo(timerEle, getTimeString(store.settings.focus.time * 60, false))
      await handleUntilLongBreakCount(store.settings, null)
      await pauseMusic()
    }
    else if(request.timerReset){
      const store = await getSyncStorage(SETTINGSKEY)
      const timerObj = await getSessionStorage(TIMERKEY)
      const timer = timerObj[TIMERKEY]
      await pauseMusic()
      console.log(timer)
      if (!timer || timer.type === FOCUS) {
        changeTextTo(focusBtnText, 'Start Focusing')
        changeTextTo(focusTitle, 'Start Focusing')
        changeTextTo(timerEle, getTimeString(store.settings.focus.time * 60, false))
      } else if (timer.type === SHORTBREAK) {
        changeTextTo(focusBtnText, 'Start Short Break')
        changeTextTo(focusTitle, 'Take a Short Break')
        changeTextTo(timerEle, getTimeString(store.settings.shortBreak.time * 60, false))
      } else {
        changeTextTo(focusBtnText, 'Start Long Break')
        changeTextTo(focusTitle, 'Take a Long Break')
        changeTextTo(timerEle, getTimeString(store.settings.longBreak.time * 60, false))
      }
      if(!timer) {
        stopBtn.classList.remove('active')
        nextBtn.classList.remove('active')
      }
    }
    else if(request.saveSettings){
      const store = await getSyncStorage(SETTINGSKEY)
      settings = store.settings
      loadSettings(settings)
      await setFocusOptionForTasks()
    }
    else if(request.taskChange) {
      taskSelect.value = request.taskChange
    }
    else if(request.taskAliasUpdated) {
      await setFocusOptionForTasks()
    }
  })

  focusBtn.addEventListener('click', async (event) => {
    event.stopPropagation()
    const timer = await getSessionStorage(TIMERKEY)
    // if started already
    if(timer?.timer) {
      print.log('Start -> ' + timer.timer.status)
      if(timer.timer.status !== PAUSE) {
          // pause
          await pause(timer.timer)
          await pauseMusic()
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
    await pauseMusic()
  })
  nextBtn.addEventListener('click', async () => {
    await nextTimer()
  })

  settingsBtn.addEventListener('click',async () => {
    await createNewTabForSettings()
  })
  historyBtn.addEventListener('click',async () => {
    await createNewTabForHistory()
  })
  streakBtn?.addEventListener('click',async () => {
    await createNewTabForStreak()
  })

  taskSelect.addEventListener('change', async (event) => {
    const selectedTask = event.target.value
    const timer = await getSessionStorage(TIMERKEY)
    if(timer.timer) {
      timer.timer.task = getValidTask(selectedTask, timer?.timer?.type)
      await setSessionStorage({timer: timer.timer})
      await chrome.runtime.sendMessage({taskChange: timer.timer.task})
      await setLocalStorage({[CURRENTTASKKEY]: timer.timer.task})
    }else {
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

  timerEdit.addEventListener('click', async (event) => {
    const settingsObj = await getSyncStorage(SETTINGSKEY)
    const settings = settingsObj[SETTINGSKEY] || {}
    const timerObj = await getSessionStorage(TIMERKEY)
    const timer = timerObj[TIMERKEY]
    let time;
    if (!timer || timer.type === FOCUS) {
        time = settings?.focus?.time;
    } else if (timer.type === SHORTBREAK) {
        time = settings?.shortBreak?.time;
    } else {
        time = settings?.longBreak?.time;
    }
    let [min, max] = [1, 180]

    showCustomPrompt(
      "⏱ Adjust Timer Duration",
      "Modify the current timer duration.\n\nPlease enter the new time in minutes:", 
      time,
      async (response) => {
        if (response !== null && !isNaN(response) && Number.isInteger(Number(response)) && Number(response) >= min && Number(response) <= max) {
          chrome.action.setBadgeText({text: ''})
          chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
          try{
            if (!timer || timer.type === FOCUS) {
                settingsObj.settings.focus.time = parseInt(response)
            } else if (timer.type === SHORTBREAK) {
                settingsObj.settings.shortBreak.time = parseInt(response)
            } else {
                settingsObj.settings.longBreak.time = parseInt(response)
            }
            await setSyncStorage(settingsObj)
            await chrome.runtime.sendMessage({
              newSettings: settingsObj, 
              saveSettings: true, 
              reload: true,
              resetCurrentTimer: true
            })
          }catch (e) {
          console.warn(e);
          }
        } else if(response !== null && !isNaN(response) && Number.isInteger(Number(response)) && Number(response) < min) {
          showCustomAlert("⚠️ Invalid Time", `The time must be at least ${min} minute(s). Please try again.`, () => {})
        } else if(response !== null && !isNaN(response) && Number.isInteger(Number(response)) && Number(response) > max) {
          showCustomAlert("⚠️ Invalid Time", `The time must not exceed ${max} minute(s). Please try again.`, () => {})
        } else if (response !== null && (isNaN(response) || response.length > 10)) {
          showCustomAlert("⚠️ Invalid Input", "Please enter a valid numeric value for the time.", () => {})
        }
      },
      "number"
    );
  })
}

function loadSettings(settings) {
  if(settings?.theme === LIGHTTHEME) {
    document.body.classList.add('light')
    container.classList.add('light')
  }else {
    document.body.classList.remove('light')
    container.classList.remove('light')
  } 
  if(settings?.timerStyle === SIMPLETIMERSTYLE) {
    timerTag.classList.remove('cat-walk')
    timerTag.classList.add('simple')
  }else {
    timerTag.classList.remove('simple')
    timerTag.classList.add('cat-walk')
  }
  changeTextTo(timerEle, getTimeString(timerDuration(timer?.timer?.type, settings)*60, false))
  if(settings.musicPlayer && !musicPlayerInitialized) setupMusicPlayer()
  else removeMusicPlayer()
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
    }catch{e=>console.warn(e)}
  })
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type ?? FOCUS)
  stopBtn.classList.add('active')
  nextBtn.classList.add('active')
}

async function nextTimer() {
  try{
    await chrome.runtime.sendMessage({nextTimer: true})
  }catch{e=>console.warn(e)}
}


const stopTimer = async (settings) => {
  print.log('stop timer - new tab')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  changeTextTo(timerEle, getTimeString(settings.focus.time * 60, false))
  chrome.action.setBadgeText({text: ''})
  chrome.action.setBadgeBackgroundColor({color: [190, 190, 190, 230]})
  await handleUntilLongBreakCount(settings, null)
  try{
    await chrome.runtime.sendMessage({stopTimer: true})
  }catch{e=>console.warn(e)}
}

const updateNextTimer = async () => {
  print.log('udateNextTimer (new Tab UI change)')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  const result = await getSessionStorage(TIMERKEY)
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  await handleUntilLongBreakCount(settingsObj.settings, result.timer)
  changeTextTo(timerEle, getTimeString(timerDuration(result.timer.type, settingsObj?.settings)*60, false))
  if(!result?.timer || result?.timer?.type === FOCUS) {
    updateFocusQuote()
    await setFocusOptionForTasks(result?.timer)
    return
  }
  await setRestOptionForTasks()
  updateBreakQuote()
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

const pause = async (timer) => {
  print.log('pause timer - new tab')
  changeTextTo(focusBtnText, 'Resume')
  changeTextTo(focusTitle, timer.type)
  chrome.action.setBadgeBackgroundColor({color: 'rgb(255, 202, 118)'})
  try{
    await chrome.runtime.sendMessage({pauseTimer: true, timer: timer})
  }catch{e=>console.warn(e)}
}

const resume = async (timer) => {
  print.log('resume timer - new tab')
  const selectedTask = taskSelect.value
  timer.task = getValidTask(selectedTask, timer.type)
  changeTextTo(focusBtnText, 'Pause')
  changeTextTo(focusTitle, timer?.type)
  await resumeTimer(timer)
}

const updateBreakQuote = () => {
  breakActivitiesSuggestions.classList.add('show')
  quote.innerText = getRandomBreakQuote()
}

const updateFocusQuote = () => {
  breakActivitiesSuggestions.classList.remove('show')
  quote.innerText = getRandomFocusQuote()
}

if(showSurvey) {
  pollBtn.classList.add('active')
  const votePoll = document?.getElementById("votePoll")
  if(votePoll) {
      votePoll.innerText = CONFIG.POLL_TITLE
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

function showCustomPrompt(title, message, value, callback, inputType = "text") {
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
  promptInput.type = inputType;
  promptInput.focus();
  promptInput.select();
  modal.style.display = "flex";

  setTimeout(() => promptInput.focus(), 0);

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      promptOk.click();
    } else if (event.key === "Escape") {
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