import { handleNotificationTone } from "../utils.js";
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.playNotificationTone) {
    const sound = msg.sound || 'Alarm Clock Old';
    await handleNotificationTone(false, sound)
  }
});
