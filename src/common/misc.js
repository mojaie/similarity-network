
/** @module common/misc */

import d3 from 'd3';


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


/**
 * Format number
 * @param {object} value - value
 * @param {string} type - si | scientific | rounded | raw
 */
function formatNum(value, d3format) {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return value == parseFloat(value) ? d3.format(d3format)(value) : value;
}


function partialMatch(query, target) {
  if (target === undefined || target === null || target === '') return false;
  return target.toString().toUpperCase()
    .indexOf(query.toString().toUpperCase()) !== -1;
}


// Ref. https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


function operatorFunction(op) {
  if (op === ">") {
    return (a, b) => a > b;
  } else if (op === ">=") {
    return (a, b) => a >= b;
  } else if (op === "<") {
    return (a, b) => a < b;
  } else if (op === ">=") {
    return (a, b) => a <= b;
  } else if (op === "==") {
    return (a, b) => a == b;
  } else if (op === "!=") {
    return (a, b) => a != b;
  }
}


function rank(arr, thld=50) {
  const counter = {};
  // count elements
  arr.forEach(e => {
    if (!counter.hasOwnProperty(e)) {
      counter[e] = 0;
    }
    counter[e] += 1;
  })
  // sort by frequency
  const entries = Object.entries(counter);
  entries.sort(((a, b) => a[1] - b[1]));
  return entries.slice(0, thld);
}


export default {
  compatibility, formatNum, partialMatch, uuidv4,
  operatorFunction, rank
};
