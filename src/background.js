import {
  createNotification,
  createState,
  getSessionStorage,
  getSyncStorage,
  initBackgroundJs,
  printer,
  setTimerInStore,
  setSyncStorage,
  storageChangesLogger,
  getTimeString, 
  setLocalStorage,
  getLocalStorage,
  getCurrentTimeString,
  checkUserActivity,
  getValidTask,
  setSessionStorage,
  getOrCreateAnonymousId,
  setBlockRules,
  unSetBlockRules} from "./utils.js"
import {
  PLAY,
  PAUSE,
  FOCUS,
  SHORTBREAK,
  LONGBREAK,
  TIMERKEY,
  SETTINGSKEY,
  TASKS,
  DEVELOPING,
  BREAK,
  TASKSALIASKEY,
  TASKS_ALIAS,
  CURRENTTASKKEY,
  modes
 } from "./constants.js"
import { CONFIG } from "./config.js";

import posthog from 'posthog-js';

let sessionActive = false;
let sessionTimeout = null;

let musicPlayTimer = null

const initPostHog = getOrCreateAnonymousId().then((anonymousId) => {
  posthog.init(CONFIG.POSTHOG_API_KEY, {
    api_host: 'https://us.i.posthog.com'
  });
  posthog.identify(anonymousId);
  return posthog;
});


let intervalId = createState(0)
let blockingSites = createState(false)
const print = printer()


chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.tabs.create({url:"src/userGuide/userGuide.html", active: true})
    await setLocalStorage({[TASKSALIASKEY]: TASKS_ALIAS})
    initPostHog.then((ph) => {
      ph.capture('extension_installed');
    });
  }
  else if (details.reason === "update") {
    const thisVersion = chrome.runtime.getManifest().version;
    const prevVersion = details.previousVersion;

    // ✅ Only run update logic if the version actually changed
    if (prevVersion && prevVersion !== thisVersion) {
      // Initialize TASKSALIAS if empty
      const tasksAliasObj = await getLocalStorage(TASKSALIASKEY);
      const tasksAlias = tasksAliasObj[TASKSALIASKEY] || {};

      if (Object.keys(tasksAlias).length === 0) {
        await setLocalStorage({ [TASKSALIASKEY]: TASKS_ALIAS });
      }

      // Fire the update event to PostHog with both versions for clarity
      initPostHog.then((ph) => {
        ph.capture('extension_updated', {
          previousVersion: prevVersion,
          currentVersion: thisVersion
        });
      });
    }
  }
  await initBackgroundJs();
  storageChangesLogger();
  const alarms = await chrome.alarms.getAll();
  if (!alarms.some(alarm => alarm.name === "checkActivity")) {
    chrome.alarms.create("checkActivity", { periodInMinutes: 180 });
  }
  chrome.runtime.setUninstallURL(CONFIG.UNINSTALL_SURVEY_FORM_URL);
});

chrome.runtime.onStartup.addListener(async () => {
  const sessionTimerObj = await getSessionStorage(TIMERKEY);
  if (!sessionTimerObj[TIMERKEY]) {
    const localTimerObj = await getLocalStorage(TIMERKEY);
    if (localTimerObj[TIMERKEY]) {
      await setSessionStorage(localTimerObj);
    }
  }
  await unSetBlockRules()
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkActivity") {
    await checkUserActivity();
  }
});

async function startActualTimer(timer) {
  print.log('message received - start timer')
  const timerObj = {
    [TIMERKEY]: {
      time: timer?.time ?? 0,
      status: PLAY,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: timer?.startTime ?? getCurrentTimeString(),
      endTime: null,
      task: getValidTask(timer?.task)
    }
  }
  await setTimerInStore(timerObj)
  await startTimer(chrome, timer?.time ?? 0)
  try{
    await chrome.runtime.sendMessage({timerStarted: true})
  }catch (e) {
    console.warn(e);
  }
}

async function pauseActualTimer(timer) {
  print.log('message received - pause timer')
  print.log(intervalId.getState())
  clearInterval(intervalId.getState())
  const timerObj = {
    [TIMERKEY]: {
      time: timer?.time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: timer?.startTime ?? getCurrentTimeString(),
      endTime: null,
      task: getValidTask(timer?.task)
    }
  }
  await setTimerInStore(timerObj)
  if(blockingSites.getState()) {
    await unSetBlockRules()
    blockingSites.setState(false)
  }
  print.it('session -> paused')

}

async function stopActualTimer() {
  print.log('message received - stop timer')
  clearInterval(intervalId.getState())
  await setTimerInStore({[TIMERKEY]: null})
  if(blockingSites.getState()) {
    await unSetBlockRules()
    blockingSites.setState(false)
  }
}

async function resetCurrentTimer() {
  clearInterval(intervalId.getState())
  const timerObj = await getSessionStorage(TIMERKEY)
  const timer = timerObj[TIMERKEY]
  if(!timer || (timer?.counts === 0 && timer?.type === FOCUS)) {
    await setTimerInStore({[TIMERKEY]: null})
    return
  } 
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const settings = settingsObj[SETTINGSKEY]
  let time;
  if(!timer || timer?.type === FOCUS) {
    time = settings?.focus?.time * 60
  } else if(timer?.type === SHORTBREAK) {
    time = settings?.shortBreak?.time * 60
  } else if(timer?.type === LONGBREAK) {
    time = settings?.longBreak?.time * 60
  }
  const newTimerObj = {
    [TIMERKEY]: {
      time: time ?? 0,
      status: PAUSE,
      type: timer?.type ?? FOCUS,
      counts: timer?.counts ?? 0,
      startTime: null,
      endTime: null,
      task: getValidTask(timer?.task)
    }
  }
  await setTimerInStore(newTimerObj)
  if(blockingSites.getState()) {
    await unSetBlockRules()
    blockingSites.setState(false)
  }
}
  
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  if (request.startTimer) {
    await startActualTimer(request?.timer)
    initPostHog.then((ph) => {
      ph.capture('timer_started');
    });
  }
  else if(request.pauseTimer) {
    await pauseActualTimer(request?.timer)
    try{
      await chrome.runtime.sendMessage({timerPaused: true})
    }catch (e) {
      console.warn(e);
  }
  }
  else if(request.stopTimer) {
    await stopActualTimer()
    try{
      await chrome.runtime.sendMessage({timerStopped: true})
    }catch (e) {
      console.warn(e);
    }
    initPostHog.then((ph) => {
      ph.capture('timer_stopped');
    });
  }
  else if(request.resetCurrentTimer) {
    await resetCurrentTimer()
    try{
      await chrome.runtime.sendMessage({timerReset: true})
    }catch (e) {
      console.warn(e);
    }
  }
  else if(request.nextTimer) {
    await setNextTimer();
  } else if(request.stopwatchNextTimer) {
    await setNextTimer(false, true);
  }
  if(request.saveSettings) {
    await setSyncStorage(request.newSettings)
    try{
      await chrome.runtime.sendMessage({settingsSaved: true, reload: request.reload})
    }catch (e) {
      console.warn(e);
  }
  }
  if (request.type === 'START_SESSION') {
    startSession();
  }
  if (request.type === 'DAILY_JOURNAL_ADDED') {
    initPostHog.then((ph) => {
        ph.capture('daily_journal_added', {
          item: request.response.trim()
        });
      });
  }
  if (request.type === 'MUSIC_PLAYING') {
    if(musicPlayTimer){
      clearTimeout(musicPlayTimer)
    } 
    musicPlayTimer = setTimeout(() => {
      initPostHog.then((ph) => {
          ph.capture('playing_music', {
            music_track: request.track
          });
        });
      musicPlayTimer = null
    },30 * 1000)
  }
  if (request.type === 'EXPORT_DATA') {
    initPostHog.then((ph) => {
        ph.capture('data_exported');
      });
  }
  if (request.type === 'IMPORT_DATA') {
    initPostHog.then((ph) => {
        ph.capture('data_imported');
      });
  }
  if (request.type === 'DELETE_ALL_DATA') {
    initPostHog.then((ph) => {
        ph.capture('all_data_deleted');
      });
  }
  if (request.type === 'PAGE_VIEW') {
    initPostHog.then((ph) => {
      ph.capture('$pageview', {
        $current_url: request?.properties?.currentUrl,
        $pathname: request?.properties?.pathName,
        $screen_width: request?.properties?.screenWidth,
        $screen_height: request?.properties?.screenHeight,
        extension_version: chrome.runtime.getManifest().version
      });
    })
  }
  if (request.type === 'SITE_BLOCKED') {
    initPostHog.then((ph) => {
      ph.capture('site_blocked', {
        site: request?.properties?.site,
        host: request?.properties?.host,
        site_count: request?.properties?.site_count
      });
    })
  }
  if (request.type === 'SETTINGS_SAVED') {
    initPostHog.then((ph) => {
      ph.capture('settings_saved', {
        focusTime: request?.properties.focusTime,
        focusNotificationTone: request?.properties.focusNotificationTone,
        focusAutoStart: request?.properties.focusAutoStart,
        shortBreakTime: request?.properties.shortBreakTime,
        shortBreakNotificationTone: request?.properties.shortBreakNotificationTone,
        shortBreakAutoStart: request?.properties.shortBreakAutoStart,
        longBreakTime: request?.properties.longBreakTime,
        longBreakNotificationTone: request?.properties.longBreakNotificationTone,
        longBreakAutoStart: request?.properties.longBreakAutoStart,
        isMusicPlayerActive: request?.properties.isMusicPlayerActive,
        theme: request?.properties.theme,
        openNewTab: request?.properties.openNewTab,
        showDailyJournal: request?.properties.showDailyJournal,
        enableSiteBlocking: request?.properties.enableSiteBlocking,
        timerMode: request?.properties.timerMode
      });
    })
  }
})

const startTimer = async (chrome, timer) => {
  if(DEVELOPING) timer = 10
  print.log('start timer started 🌠')
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const settings = settingsObj[SETTINGSKEY]
  const isPomodoro = settings.mode === modes.POMODORO
  const incrementFactor = isPomodoro ? -1 : 1
  let intId = setInterval(async function() {
    timer += incrementFactor
    if (isPomodoro && timer < 0) {
      await finishCurrentTimer(isPomodoro, settings)
    }else {
      print.log('⏲ -> ' + timer +' '+ getTimeString(timer))
      const result = await getSessionStorage(TIMERKEY)
      chrome.action.setBadgeText({text: getTimeString(timer)})
      if(result?.timer?.type === FOCUS) {
        chrome.action.setBadgeBackgroundColor({color: '#e19be7'})
      }
      else {
        chrome.action.setBadgeBackgroundColor({color: '#9CCC65'})
      }
      try{
        await chrome.runtime.sendMessage({time: getTimeString(timer, false)})
      } catch{(e) => console.warn(e)}
      const timerToStore = {
        [TIMERKEY]: {
          time: timer,
          status: result?.timer?.status,
          type: result?.timer?.type,
          counts: result?.timer?.counts,
          startTime: result?.timer?.startTime,
          endTime: null,
          task: getValidTask(result?.timer?.task)
        }
      }
      await setTimerInStore(timerToStore, timer)
      if (timer % (5 * 60) === 0 && timer !== 0) {
        startSession();
      }
      if (result?.timer?.type === FOCUS && !blockingSites.getState() && settings.blockSites) {
          blockingSites.setState(true)
          await setBlockRules()
      }
    }
  }, 1000)
  print.helper('INTERVAL-ID -> ' + intId)
  intervalId.setState(intId)
}
  
async function finishCurrentTimer(isPomodoro=true, settings={}) {
  print.log('start timer 🔚')
  clearInterval(intervalId.getState())
  chrome.action.setBadgeText({text: getTimeString(0)})
  chrome.action.setBadgeBackgroundColor({color: 'rgb(255, 202, 118)'})
  const currentDate = new Date()
  const oldHistoryObj = await getLocalStorage(currentDate.getFullYear().toString())
  const oldHistory = oldHistoryObj[currentDate.getFullYear().toString()]
  const timerObj = await getSessionStorage(TIMERKEY)
  const currentDateWithMonth = currentDate.getDate()+'-'+(currentDate.getMonth()+1)
  const task = getValidTask(timerObj?.timer?.task, timerObj?.timer?.type)
  let startTime = timerObj?.timer?.startTime
  let endTime = getCurrentTimeString()
  const shouldSaveSession = startTime && endTime && (DEVELOPING || (isPomodoro && startTime !== endTime) || (!isPomodoro && timerObj?.timer?.time > 60))
  let duration = timerObj?.timer?.type === SHORTBREAK 
                    ? settings?.shortBreak?.time
                    : timerObj?.timer?.type === LONGBREAK
                    ? settings?.longBreak?.time
                    : settings?.focus?.time

  if (!isPomodoro && startTime && endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    let startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours in minutes if end time is on the next day
    }
    duration = endTotalMinutes - startTotalMinutes;
  }
  if(!isPomodoro && (duration < 1 || timerObj?.timer?.time < 60)) {
    await chrome.runtime.sendMessage({invalidSession: true})
  }
  if(timerObj?.timer?.type === FOCUS) await setLocalStorage({[CURRENTTASKKEY]: task})
  const sessionObj = {
    startTime: startTime,
    endTime: endTime,
    duration: duration,
    type: timerObj?.timer?.type === FOCUS ? FOCUS : BREAK,
    task: task,
    mode: isPomodoro ? modes.POMODORO : modes.STOPWATCH,
    }
  if(!oldHistory) {
    if(shouldSaveSession) await setLocalStorage({[currentDate.getFullYear().toString()]: {
      [currentDateWithMonth]: [sessionObj]
      } 
    })
  } else if(oldHistory[currentDateWithMonth]){
    let todaysPomodoros = oldHistory[currentDateWithMonth]
    todaysPomodoros.push(sessionObj)
    if(shouldSaveSession) await setLocalStorage({[currentDate.getFullYear().toString()]: {
      [currentDateWithMonth]: todaysPomodoros,
        ...oldHistory
      } 
    })
  }
  else if (shouldSaveSession) {
    await setLocalStorage({[currentDate.getFullYear().toString()]: {
      [currentDateWithMonth]: [sessionObj],...oldHistory} 
    })
  }
  await setNextTimer(true)
}

const setNextTimer = async (timerEnds=false, shouldStopWatchEnd=false) => {
  const settingsObj = await getSyncStorage(SETTINGSKEY)
  const isPomodoro = settingsObj[SETTINGSKEY]?.mode === modes.POMODORO
  const status = await getSessionStorage(TIMERKEY)
  let nextTimer = FOCUS
  let prevTimer = FOCUS
  print.log('setting next timer --------->')
  if(!status?.timer) return
  const currentTaskObj = await getLocalStorage(CURRENTTASKKEY)
  const currentTask = currentTaskObj[CURRENTTASKKEY] || null
  print.helper('NEXT ID  => ' + intervalId.getState())
  clearInterval(intervalId.getState())
  chrome.action.setBadgeBackgroundColor({color: 'rgb(255, 202, 118)'})
  let timerToStore = {}

  if(!isPomodoro && shouldStopWatchEnd) await finishCurrentTimer(isPomodoro, settingsObj?.settings)

  if(status?.timer?.type === FOCUS) {
    const interval = parseInt(settingsObj?.settings?.longBreak?.interval)
    if(!interval || (interval && status.timer.counts < interval)) {
      nextTimer = SHORTBREAK
      print.log('next is short break')
      const time = isPomodoro ? settingsObj.settings.shortBreak.time * 60 : 0
      chrome.action.setBadgeText({text: getTimeString(time)})
      timerToStore = {
        [TIMERKEY]: {
          time: time,
          status: PAUSE,
          type: SHORTBREAK,
          counts: interval > 0 ? status.timer.counts : 0,
          task: TASKS.REST
        }
      }
      await setTimerInStore(timerToStore)
      print.log('session -> focus -> short')
    } else if(interval && interval > 0) {
      nextTimer = LONGBREAK
      print.log('next is long break')
      const time = isPomodoro ? settingsObj.settings.longBreak.time * 60 : 0
      chrome.action.setBadgeText({text: getTimeString(time)})
      timerToStore = {
        [TIMERKEY]: {
          time: time,
          status: PAUSE,
          type: LONGBREAK,
          counts: 0,
          task: TASKS.REST
        }
      }
      await setTimerInStore(timerToStore)
      print.log('session -> focus -> long')
    }
    try{
      await chrome.runtime.sendMessage({updateNextTimer: true})
    }catch (e) {
      console.warn(e);
    }
  } else if(status?.timer?.type === SHORTBREAK) {
    prevTimer = SHORTBREAK
    print.log('next is focus after short one')
    const time = isPomodoro ? settingsObj.settings.focus.time * 60 : 0
    chrome.action.setBadgeText({text: getTimeString(time)})
    timerToStore = {
      [TIMERKEY]: {
        time: time,
        status: PAUSE,
        type: FOCUS,
        counts: status.timer.counts + 1,
        task: currentTask
      }
    }
    await setTimerInStore(timerToStore)
    print.log('session -> short -> focus')
    try{
      await chrome.runtime.sendMessage({updateNextTimer: true})
    }catch (e) {
    console.warn(e);
  }
  } else if(status?.timer?.type === LONGBREAK) {
    prevTimer = LONGBREAK
    print.log('next is focus after long one')
    const time = isPomodoro ? settingsObj.settings.focus.time * 60 : 0
    chrome.action.setBadgeText({text: getTimeString(time)})
    timerToStore = {
      [TIMERKEY]: {
        time: time,
        status: PAUSE,
        type: FOCUS,
        counts: 0,
        task: currentTask
      }
    }
    await setTimerInStore(timerToStore)
    print.log('session -> long -> focus')
    try{
      await chrome.runtime.sendMessage({updateNextTimer: true})
    }catch (e) {
    console.warn(e);
  }
  }
  if(isPomodoro && timerEnds) {
    await createNotification(prevTimer, nextTimer)
  }
  if(blockingSites.getState()) {
    await unSetBlockRules()
    blockingSites.setState(false)
  }
  const nextType = timerToStore?.[TIMERKEY]?.type;
  if (settingsObj?.settings?.mode === modes.POMODORO && (
    (nextType === FOCUS && settingsObj?.settings?.focus?.autoStart) ||
    (nextType === SHORTBREAK && settingsObj?.settings?.shortBreak?.autoStart) ||
    (nextType === LONGBREAK && settingsObj?.settings?.longBreak?.autoStart))
  ) {
    await startActualTimer(timerToStore[TIMERKEY]);
  }
}


function startSession() {
  if (!sessionActive) {
    initPostHog.then((ph) => {
      ph.capture('session_started');
    });
    sessionActive = true;
  }

  // Reset timeout: if user is inactive for 10 mins, end session
  clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    initPostHog.then((ph) => {
      ph.capture('session_ended');
    });
    sessionActive = false;
  }, 10 * 60 * 1000); // 10 mins of inactivity
}