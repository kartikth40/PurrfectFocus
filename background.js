import { startTimer } from "./utils.js";


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.startTimer) {
    startTimer(chrome)
  }
});


