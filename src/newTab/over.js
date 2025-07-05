import { CONFIG } from "../config.js"
import { SETTINGSKEY, TIMERKEY, FOCUS, SHORTBREAK, LONGBREAK, PAUSE, PLAY, LIGHTTHEME, SIMPLETIMERSTYLE, TASKS, TASKSALIASKEY, CURRENTTASKKEY, showSurvey, modes, TOASTIFY, DAILYJOURNALLISTKEY } from "../constants.js"
import { changeTextTo, createNewTabForHistory, createNewTabForSettings, createNewTabForStreak, getFocusText, getLocalStorage, getRandomBreakQuote, getRandomFocusQuote, getSessionStorage, getSyncStorage, getTimeString, playMusic, printer, resumeTimer, setLocalStorage, setTimerInStore, timerDuration, getValidTask, setSyncStorage, showCustomAlert, showCustomPrompt, showToast, createNewTabForTimers, unSetBlockRules } from "../utils.js"

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
const loadingScreen = document.querySelector('.loading-screen')
const mode = document.querySelector('.mode')
const dailyJournalListCotainer = document.querySelector('#daily-journal-list-container')
const dailyJournalListSubContainer = document.querySelector('.daily-journal-list');
const dailyJournalAddBtn = document.querySelector('.add-btn')
const supportBtn = document.querySelector('.support-tab-btn')

supportBtn.href = CONFIG.SUPPORT_URL

let audio = null
let settings
let musicPlayerInitialized = false

const print = printer()
document.addEventListener('DOMContentLoaded', async () => {
  // await handleNotificationTone(true)
  addEventListeners()
  await init()
  await maybeShowRedirectModal()
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove()
    }, 500)
  }, 200)
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
  settings = store[SETTINGSKEY]
  await loadSettings(settings)
  const isPomodoro = settings.mode === modes.POMODORO
  const interval = parseInt(settings.longBreak.interval)
  const timerCounts = timer.timer ? timer.timer.counts : 0
  untilLongBreakCount.innerText = interval - timerCounts + 1
  await handleUntilLongBreakCount(settings, timer.timer)
  if (!isPomodoro) {
    nextBtn.querySelector('img').src = '/icons/end.png';
    timerEdit.style.display = 'none'
    mode.innerText = 'Stopwatch Mode'
  }else {
    nextBtn.querySelector('img').src = '/icons/next.png';
    mode.innerText = 'Pomodoro Mode'
    timerEdit.style.display = 'block'
  }
  if(timer?.timer?.type === LONGBREAK) changeTextTo( untilLongBreak, '')
  if(timer?.timer && (timer?.timer?.status === PLAY || timer?.timer?.status === PAUSE)) {
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

  if(!settings?.blockSites) {
    await unSetBlockRules()
  }

  chrome.runtime.sendMessage({ type: 'START_SESSION' });
  chrome.runtime.sendMessage({ type: 'PAGE_VIEW', properties: {
    currentUrl: window.location.href,
    pathName: 'over',
    screenWidth: window?.screen?.width,
    screenHeight: window?.screen?.height
  } });
}

async function initDailyJournal() {
  dailyJournalListCotainer.classList.add('show')
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString();
  const monthDay = `${currentDate.getDate()}-${currentDate.getMonth() + 1}`;
  const history = await getLocalStorage(year);
  let yearObj = history[year] || {};
  let dayObj = yearObj[monthDay] || [{}];
  let journalList = dayObj[0][DAILYJOURNALLISTKEY] || [];

  dailyJournalListSubContainer.innerHTML = journalList
    .map((dailyJournal, index) => `
      <li>
        <input type="checkbox" id="dailyJournal-${index}" data-index="${index}" ${dailyJournal.completed ? 'checked' : ''}>
        <label for="dailyJournal-${index}">${dailyJournal.item}</label>
        <button class='dlt-btn' data-index="${index}"></button>
      </li>
    `)
    .join('');

  dailyJournalListSubContainer.querySelectorAll('.dlt-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      showCustomAlert('Are you sure you want to delete this item?', 'This action cannot be undone.', async (response) => {
        if(response) {
          const idx = event.target.dataset.index;
          const currentDate = new Date();
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
          await initDailyJournal();
        }
      })
    });
  });
}

dailyJournalListSubContainer.addEventListener('change', async (event) => {
  if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
    const idx = event.target.dataset.index;
    // --- fetch and update using correct path ---
    const currentDate = new Date();
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
    const store = await getSyncStorage(SETTINGSKEY)
    settings = store.settings
    const isPomodoro = settings?.mode === modes.POMODORO
    // tick with timer
    if (request.time) {
      changeTextTo(timerEle, request.time)
      if(settings.musicPlayer && settings.musicPlayerAutoStart && !audio) await loadTrack()
    }
    if(request.timerStarted){
      if(isPomodoro) {
        changeTextTo(focusBtnText, 'Pause')
      }else {
        changeTextTo(focusBtnText, 'Running...')
      }
      stopBtn.classList.add('active')
      nextBtn.classList.add('active')
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
      if(isPomodoro) changeTextTo(timerEle, getTimeString(store.settings.focus.time * 60, false))
      else changeTextTo(timerEle, getTimeString(0, false))
      await handleUntilLongBreakCount(store.settings, null)
      await pauseMusic()
    }
    else if(request.timerReset){
      const timerObj = await getSessionStorage(TIMERKEY)
      const timer = timerObj[TIMERKEY]
      await pauseMusic()
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
      if(!isPomodoro) changeTextTo(timerEle, getTimeString(0, false))
      if(!timer) {
        stopBtn.classList.remove('active')
        nextBtn.classList.remove('active')
      }
    }
    else if(request.saveSettings){
      const timerObj = await getSessionStorage(TIMERKEY)
      const timer = timerObj[TIMERKEY]
      await loadSettings(settings)
      !timer || timer?.type === FOCUS ? await setFocusOptionForTasks() : await setRestOptionForTasks()
    }
    else if(request.taskChange) {
      taskSelect.value = request.taskChange
    }
    else if(request.taskAliasUpdated) {
      const timerObj = await getSessionStorage(TIMERKEY)
      const timer = timerObj[TIMERKEY]
      !timer || timer?.type === FOCUS ? await setFocusOptionForTasks() : await setRestOptionForTasks()
    }
    if(request.switchToStopwatch) {
      nextBtn.querySelector('img').src = '/icons/end.png';
      timerEdit.style.display = 'none'
      mode.innerText = 'Stopwatch Mode'
    }else if(request.switchToPomodoro) {
      nextBtn.querySelector('img').src = '/icons/next.png';
      mode.innerText = 'Pomodoro Mode'
      timerEdit.style.display = 'block'
    }
    if(request.invalidSession) {
      showToast('Session Not Saved!', 'Session duration must be at least one minute.', TOASTIFY.colors.orange)
    }
  })

  focusBtn.addEventListener('click', async (event) => {
    event.stopPropagation()
    const isPomodoro = settings.mode === modes.POMODORO
    const timer = await getSessionStorage(TIMERKEY)
    if(!isPomodoro && timer?.timer?.status === PLAY){
      showToast('Reminder!', "Pause is not allowed in Stopwatch mode.", TOASTIFY.colors.orange, null, true)
      return
    } 
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
      await setTimerInStore({[TIMERKEY]: timer.timer})
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
      await setTimerInStore({ [TIMERKEY]: timerObj });
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
            oldSelectedTask === TASKS.REST ? setRestOptionForTasks() : setFocusOptionForTasks()
          } else if (response !== null && response.length > 10) {
            showToast("Oops! 😋", "Task name should be less than 10 characters.", TOASTIFY.colors.red)
          }
      });
  })

  timerEdit.addEventListener('click', async (event) => {
    const settingsObj = await getSyncStorage(SETTINGSKEY)
    const settings = settingsObj[SETTINGSKEY] || {}
    const isPomodoro = settings.mode === modes.POMODORO
    if(!isPomodoro) return
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
      `Please enter a new time in minutes (between ${min} and ${max})`,
      time,
      async (response) => {
      const parsedTime = parseInt(response, 10);
      if (response !== null && !isNaN(parsedTime) && parsedTime >= min && parsedTime <= max) {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: [190, 190, 190, 230] });
        try {
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
        } catch (e) {
        console.warn(e);
        }
      } else if (response !== null) {
        let errorMessage = "Please enter a valid numeric value for the time.";
        if (parsedTime < min) {
        errorMessage = `The time must be at least ${min} minute(s). Please try again.`;
        } else if (parsedTime > max) {
        errorMessage = `The time must not exceed ${max} minute(s). Please try again.`;
        }
        showToast("Invalid Input!", errorMessage, TOASTIFY.colors.red, null, true)
      }
      },
      "number",
      "*It will reset the current timer.\nIf any."
    );
  })

  dailyJournalAddBtn.addEventListener('click', async ()=> {
    showCustomPrompt(
      "Add a daily journal item!",
      `What would you like to add to your daily journal?`,
      '',
      async (response) => {
        if (response !== null && response.trim() !== "") {
          const currentDate = new Date();
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
          await initDailyJournal();
          chrome.runtime.sendMessage({ type: 'DAILY_JOURNAL_ADDED', response: response.trim() });
        }
      }
    );
  })
}

async function loadSettings(settings) {
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
    mode.classList.remove('cat-walk')
  }else {
    timerTag.classList.remove('simple')
    timerTag.classList.add('cat-walk')
    mode.classList.add('cat-walk')
  }
  const isPomodoro = settings.mode === modes.POMODORO
  if(isPomodoro) changeTextTo(timerEle, getTimeString(timerDuration(timer?.timer?.type, settings)*60, false))
  else changeTextTo(timerEle, getTimeString(0, false))
  if(settings.musicPlayer && !musicPlayerInitialized) setupMusicPlayer()
  else removeMusicPlayer()
  if(settings.dailyJournal) {
  dailyJournalListCotainer.classList.add('show')
    await initDailyJournal()
  } else {
    dailyJournalListCotainer.classList.remove('show')
  }
}
const initiateTimer = async () => {
  const store = await getSyncStorage(SETTINGSKEY)
  let settings = store[SETTINGSKEY]
  const isPomodoro = settings.mode === modes.POMODORO
  const time = isPomodoro ? timerDuration(FOCUS, settings)*60 : 0

  const selectedTask = taskSelect.value
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const timerObj = {
      time: time,
      status: PLAY,
      type: FOCUS,
      counts: 0,
      task: getValidTask(selectedTask)
    }
    try{
      await chrome.runtime.sendMessage({startTimer: true, timer: timerObj})
    }catch{e=>console.warn(e)}
  })
  if(isPomodoro) {
    changeTextTo(focusBtnText, 'Pause')
  }else {
    changeTextTo(focusBtnText, 'Running...')
  }
  changeTextTo(focusTitle, timer?.type ?? FOCUS)
  stopBtn.classList.add('active')
  nextBtn.classList.add('active')
}

async function nextTimer() {
  try{
    const settingsObj = await getSyncStorage(SETTINGSKEY)
    const settings = settingsObj[SETTINGSKEY]
    if(settings?.mode === modes.STOPWATCH) {
      await chrome.runtime.sendMessage({stopwatchNextTimer: true})
    }else await chrome.runtime.sendMessage({nextTimer: true})
  }catch{e=>console.warn(e)}
}


const stopTimer = async (settings) => {
  print.log('stop timer - new tab')
  changeTextTo(focusBtnText, 'Start Focusing')
  changeTextTo(focusTitle, 'Start Focusing')
  stopBtn.classList.remove('active')
  nextBtn.classList.remove('active')
  breakActivitiesSuggestions.classList.remove('show')
  const isPomodoro = settings.mode === modes.POMODORO
  if(isPomodoro) changeTextTo(timerEle, getTimeString(settings.focus.time * 60, false))
  else changeTextTo(timerEle, getTimeString(0, false))
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
  const isPomodoro = settingsObj.settings.mode === modes.POMODORO
  if(isPomodoro) changeTextTo(timerEle, getTimeString(timerDuration(result.timer.type, settingsObj?.settings)*60, false))
  else changeTextTo(timerEle, getTimeString(0, false))
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
      votePoll.innerText = CONFIG.LINK_TITLE
      votePoll.addEventListener("click", function() {
      chrome.tabs.create({ url: CONFIG.LINK_URL });
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

function getQueryParams() {
  return new URLSearchParams(window?.location?.search);
}

async function maybeShowRedirectModal() {
  const params = getQueryParams();
  const redirect = params.get("redirected")
  if (redirect) {
    await showFocusModal(redirect);
  }
}

async function showFocusModal(url) {
  let hostName = null
  try{
   hostName = (new URL(url)).host
  }
  catch (e) {
    hostName = null
  }
  showToast(
    '🚀 Stay Focused!',
    (hostName ? `<i> Tried to access:  "${hostName}" </i> <br><br>` : '') 
    +`Access to this site is blocked during your focus sessions.`,
    TOASTIFY.colors.orange
  )
  await createNewTabForTimers(false, true, true)
}
