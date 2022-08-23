
/** @module common/client */


function compatibility() {
  if (!window.indexedDB) {
    return 'Client compatibility error: IndexedDB not supported';
  }
  try {
    () => {};
  } catch (err) {
    return 'Client compatibility error: Arrow function not supported';
  }
  try {
    FormData;
  } catch (err) {
    return 'Client compatibility error: FormData not supported';
  }
  try {
    fetch;
  } catch (err) {
    return 'Client compatibility error: fetch API not supported';
  }
}

/*
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (!isDebugBuild) {  // Grobal isDebugBuild (see rollup.js)
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js');  // TODO: root path option
      });
    } else {
      console.info('Service worker is disabled for debugging');
    }
  } else {
    console.info('Service worker is not supported');
  }
}
*/



export default {
  compatibility
};
