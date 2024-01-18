document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('dismiss').addEventListener('click', function() {
    window.close();
  });

  document.getElementById('restart').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.runtime.sendMessage({restartTimer: true});
      window.close();
    });
  });
});