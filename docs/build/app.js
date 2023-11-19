var app = (function (d3, pako) {
  'use strict';

  function readFile(file, sizeLimit, blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const truncated = sizeLimit ? file.slice(0, sizeLimit) : file;
      reader.onload = event => resolve(event.target.result);
      reader.onerror = error => reject(error);
      if (blob) {
        reader.readAsArrayBuffer(truncated);
      } else {
        reader.readAsText(truncated);
      }
    });
  }


  function parseJSON(data, compressed) {
    const text = compressed ? pako.inflate(data, {to: 'string'}) : data;
    return JSON.parse(text);
  }


  function loadJSON(file) {
    const compressed = file.name.endsWith('.gz');
    return readFile(file, false, compressed)
      .then(data => parseJSON(data, compressed));
  }


  function fetchJSON(url) {
    const decoded = decodeURIComponent(url);
    const compressed = decoded.endsWith('.gz');
    return fetch(decoded)
      .then(res => compressed ? res.arrayBuffer() : res.json())
      .then(data => parseJSON(data, compressed));
  }


  function downloadDataFile(data, name) {
    try {
      // cannot hundle large file with dataURI scheme
      // url = 'data:application/json,' + encodeURIComponent(JSON.stringify(json))
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.download = name;
      a.href = url;
      // a.click() does not work on firefox
      a.dispatchEvent(new MouseEvent('click', {
        'view': window,
        'bubbles': true,
        'cancelable': false
      }));
      // window.URL.revokeObjectURL(url) does not work on firefox
    } catch (e) {
      // no DOM (unit testing)
    }
  }


  function downloadJSON(json, name, compress=true) {
    const str = JSON.stringify(json);
    const data = compress ? pako.gzip(str) : str;
    downloadDataFile(data, `${name}.json${compress ? '.gz' : ''}`);
  }


  var hfile = {
    readFile, parseJSON, loadJSON, fetchJSON,
    downloadDataFile, downloadJSON
  };

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
    });
    // sort by frequency
    const entries = Object.entries(counter);
    entries.sort(((a, b) => a[1] - b[1]));
    return entries.slice(0, thld);
  }


  var misc = {
    compatibility, formatNum, partialMatch, uuidv4,
    operatorFunction, rank
  };

  // Increment versions if IDB schema has updated.
  const sessionStoreVersion = 1;
  const configStoreVersion = 1;


  function connect(name, version, createObj) {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(name, version);
      request.onsuccess = function () {
        resolve(this.result);
      };
      request.onerror = event => reject(event);
      request.onupgradeneeded = event => {
        createObj(event.currentTarget.result);
      };
    });
  }


  const instance = {
    session: connect("Session", sessionStoreVersion, db => {
      db.createObjectStore("Session", {keyPath: 'id'});
    }),
    config: connect("Config", configStoreVersion, db => {
      db.createObjectStore("Config", {keyPath: 'key'});
    })
  };


  /**
   * Clear database
   * @param {string} dbid - database ID
   * @return {Promise} resolve with nothing
   */
  async function clear(dbid) {
    const db = await instance[dbid];
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve();  // wait for transaction complete
    });
  }


  /**
   * Delete all data in the local storage
   * @return {Promise} resolve with nothing
   */
  function clearAll() {
    return Promise.all([clear('session'), clear('config')]);
  }


  /**
   * Get config by a key
   * @param {string} key - key
   * @return {Promise} config object (if not found, resolve with undefined)
   */
  async function getConfig(key) {
    const db = await instance.config;
    const transaction = db.transaction(db.name);
    const store = transaction.objectStore(db.name);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = event => resolve(event.target.result && event.target.result.value);
      request.onerror = event => reject(event);
    });
  }


  /**
   * Put asset object with a key
   * @param {string} key - key
   * @param {*} value - config to store
   * @return {Promise} resolve with nothing
   */
  async function putConfig(key, value) {
    const db = await instance.config;
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    return new Promise((resolve, reject) => {
      const request = store.put({key: key, value: value});
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve();  // wait for transaction complete
    });
  }


  /**
   * Returns all sessions
   * @return {Promise} Promise of list of sessions
   */
   async function getSessionHeaders() {
    const db = await instance.session;
    const transaction = db.transaction(db.name);
    const store = transaction.objectStore(db.name);
    return new Promise(resolve => {
      const response = [];
      store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) {
          const rcd = {
            id: cursor.value.id,
            name: cursor.value.name
          };
          response.push(rcd);
          cursor.continue();
        } else {
          resolve(response);
        }
      };
    });
  }


  /**
   * Get the session with the given ID
   * @param {string} id - session ID
   * @return {Promise} data store object
   */
  async function getSession(id) {
    const db = await instance.session;
    const transaction = db.transaction(db.name);
    const store = transaction.objectStore(db.name);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event);
    });
  }


  /**
   * Put data object in the store
   * @param {*} data - data to store
   * @return {Promise<string>} session ID
   */
  async function putSession(data) {
    const db = await instance.session;
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    if (!data.hasOwnProperty("id")) {
      data.id = misc.uuidv4();  // new ID
    }
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve(data.id);  // wait for transaction complete
    });
  }


  /**
   * Delete a session
   * @param {string} id - session ID
   * @return {Promise} resolve with nothing
   */
  async function deleteSession(id) {
    const db = await instance.session;
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve();  // wait for transaction complete
    });
  }


  /**
   * Add new snapshot to the session
   * @param {string} sessionid - session ID
   * @param {Object} snapshot - snapshot object
   * @return {Promise} resolve with nothing
   */
  async function appendSnapshot(sessionid, snapshot) {
    const db = await instance.session;
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    const data = await new Promise((resolve, reject) => {
      const request = store.get(sessionid);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event);
    });
    if (!data.hasOwnProperty("snapshots")) { data.snapshots = []; }
    data.snapshots.push(snapshot);
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve();  // wait for transaction complete
    });
  }

  /**
   * Rename snapshot
   * @param {string} sessionid - session ID
   * @param {Object} idx - snapshot index
   * @param {string} name - new name
   * @return {Promise} resolve with nothing
   */
   async function renameSnapshot(sessionid, idx, name) {
    const db = await instance.session;
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    const data = await new Promise((resolve, reject) => {
      const request = store.get(sessionid);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event);
    });
    data.snapshots[idx].name = name;
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve();  // wait for transaction complete
    });
  }


  /**
   * Delete snapshot
   * @param {string} sessionid - session ID
   * @param {Object} idx - snapshot index
   * @return {Promise} resolve with nothing
   */
   async function deleteSnapshot(sessionid, idx) {
    const db = await instance.session;
    const transaction = db.transaction(db.name, 'readwrite');
    const store = transaction.objectStore(db.name);
    const data = await new Promise((resolve, reject) => {
      const request = store.get(sessionid);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event);
    });
    data.snapshots.splice(idx, 1);
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onerror = event => reject(event);
      transaction.oncomplete = () => resolve();  // wait for transaction complete
    });
  }


  var idb = {
    clear, clearAll,
    getConfig, putConfig,
    getSessionHeaders,
    getSession, putSession, deleteSession,
    appendSnapshot, renameSnapshot, deleteSnapshot
  };

  const assetBaseURL = './assets/';
  const iconBaseURL$1 = './assets/icons/';


  function badge(selection) {
    selection.classed('badge', true);
    selection.append('img')
        .classed('icon', true)
        .style('width', '1.25rem')
        .style('height', '1.25rem');
    selection.append('span')
        .classed('text', true);
  }


  function updateBadge(selection, text, type, icon) {
    selection.classed(`badge-${type}`, true);
    selection.select('.icon')
        .attr('src', icon ? `${iconBaseURL$1}${icon}.svg` : null);
    selection.select('.text')
        .text(text);
  }


  function notify(selection) {
    selection
      .style('opacity', 0)
      .style('display', 'inline')
      .transition()
        .duration(500)
        .ease(d3.easeLinear)
        .style("opacity", 1.0)
      .transition()
        .delay(3000)
        .duration(1000)
        .ease(d3.easeLinear)
        .style("opacity", 0)
        .on('end', function () {
          selection.style('display', 'none');
        });
  }


  function loadingCircle(selection) {
    selection
        .style('display', 'none')
      .append('img')
        .attr('src', `${assetBaseURL}loading1.gif`)
        .style('width', '2rem')
        .style('height', '2rem');
  }


  function alert(selection) {
    selection.classed('alert', true)
        .classed('px-1', true)
        .classed('py-0', true);
    selection.append('img')
        .classed('icon', true)
        .style('width', '1.25rem')
        .style('height', '1.25rem');
    selection.append('span')
        .classed('text', true)
        .style('font-size', '75%');
  }


  function updateAlert(selection, text, type, icon) {
    selection.classed(`alert-${type}`, true);
    selection.select('.icon')
        .attr('src', icon ? `${iconBaseURL$1}${icon}.svg` : null);
    selection.select('.text')
        .text(text);
  }


  function invalidFeedback(selection) {
    selection.classed('invalid-feedback', true)
        .style('display', 'none');
    selection.append('img')
        .classed('icon', true)
        .attr('src', `${iconBaseURL$1}caution-salmon.svg`)
        .style('width', '1rem')
        .style('height', '1rem');
    selection.append('span')
        .classed('invalid-msg', true);
  }

  function updateInvalidMessage(selection, msg) {
    selection.select('.invalid-msg')
        .text(msg);
  }


  var badge$1 = {
    badge, updateBadge, notify, loadingCircle,
    alert, updateAlert, invalidFeedback, updateInvalidMessage
  };

  function monocolorBar(selection, colors, length, tooltip) {
    selection.append('svg')
        .attr('width', length)
        .attr('viewBox', `0 0 ${length} 10`)
        .attr('preserveAspectRatio', 'none')
      .append('g')
        .attr("title", tooltip)
      .append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', length).attr('height', 10)
        .attr('fill', colors[0]);
  }

  function bicolorBar(selection, colors, length, tooltip) {
    const id = misc.uuidv4().slice(0, 8);  // Aboid inline SVG ID dupulicate
    selection.call(monocolorBar, colors, length, tooltip);
    const grad = selection.select("svg").append('defs')
      .append('linearGradient')
        .attr('id', id);
    grad.append('stop')
        .attr('offset', 0).attr('stop-color', colors[0]);
    grad.append('stop')
        .attr('offset', 1).attr('stop-color', colors[1]);
    selection.select('rect')
        .attr('fill', `url(#${id})`);
  }

  function categoricalBar(selection, colors, length, tooltip) {
    const group = selection.append('svg')
        .attr('width', length)
        .attr('viewBox', `0 0 ${length} 10`)
        .attr('preserveAspectRatio', 'none')
      .append('g')
        .attr("title", tooltip);
    const sw = length / colors.length;
    colors.forEach((e, i) => {
      group.append('rect')
          .attr('x', sw * i).attr('y', 0)
          .attr('width', sw).attr('height', 10)
          .attr('fill', colors[i]);
    });
  }

  function setSize(selection, width, height) {
    selection.attr('width', width).attr('height', height);
  }


  function colorBar(range) {
    if (range.length == 1) return monocolorBar;
    if (range.length == 2) return bicolorBar;
    return categoricalBar;
  }

  var shape = {
    colorBar, setSize
  };

  /**
   * Render select box components
   * @param {*} selection - selection of box container (div element)
   */
  function selectBox(selection, label) {
    selection
        .classed('row', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    selection.append('div')
        .classed('col-8', true)
      .append('select')
        .classed('form-select', true)
        .classed('form-select-sm', true);
  }

  function updateSelectBoxOptions(selection, items, keyfunc=d => d, namefunc=d => d, init=false) {
    const options = selection.select('select')
      .selectAll('option')
        .data(items, keyfunc);
    options.exit().remove();
    options.enter()
      .append('option')
        .attr('value', keyfunc)
      .merge(options)
        .text(namefunc);
    if (init) {
      selection.select('select')
        .append("option")
          .property("disabled", true)
          .property("selected", true)
          .property("value", true)
          .text("--- select ---");
    }
  }

  function updateSelectBoxValue(selection, value) {
    selection.select('.form-select').property('value', value);
  }

  function selectBoxValue(selection) {
    return selection.select('.form-select').property('value');
  }

  function selectBoxValueIndex(selection) {
    return selection.select('.form-select').property('selectedIndex');
  }


  /**
   * Render select box components
   * @param {＊} selection - selection of box container (div element)
   */
  function checklistBox(selection, label) {
    // TODO: scroll
    const formLabel = selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .text(label);
    formLabel.append('div')
        .call(badge$1.invalidFeedback);
    selection.append('ul')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('mb-0', true)
        .classed('col-8', true);
  }

  function updateChecklistItems(selection, items, keyfunc = d => d, namefunc = d => d) {
    const listitems = selection.select('ul')
      .selectAll('li')
        .data(items, d => d.key);
    listitems.exit().remove();
    const form = listitems.enter()
      .append('li')
        .attr('class', 'form-check')
      .append('label')
        .attr('class', 'form-check-label');
    form.append('input')
        .attr('type', 'checkbox')
        .attr('class', 'form-check-input')
        .property('value', keyfunc);
    form.append('span')
        .text(namefunc);
  }

  function checkRequired(selection) {
    selection.selectAll('input')
        .on('change', function () {
          const valid = anyChecked(selection);
          selection.call(setChecklistValidity, valid);
        });
  }

  function updateChecklistValues(selection, values, keyfunc = d => d) {
    selection.selectAll('input')
      .each(function (d) {
        d3.select(this).property('checked', values.includes(keyfunc(d)));
      });
    selection.call(setChecklistValidity, true);  // Clear validity state
  }

  function checklistValues(selection, keyfunc = d => d) {
    return selection.selectAll('input:checked').data().map(keyfunc);
  }

  function anyChecked(selection) {
    return checklistValues(selection).length > 0;
  }

  function setChecklistValidity(selection, valid) {
    selection.select('.invalid-feedback')
        .style('display', valid ? 'none': 'inherit');
    selection.select('.form-control')
        .style('background-color', valid ? null : 'LightPink');
  }


  function colorScaleBox(selection, label) {
    selection
        .classed('row', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    const form = selection.append('div')
        .classed('col-8', true)
      .append('div')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('p-0', true);
    const dropdown = form.append('div')
        .classed('btn-group', true)
        .classed('me-1', true);
    dropdown.append('button')
        .classed('btn', true)
        .classed(`btn-light`, true)
        .classed('btn-sm', true)
        .classed('dropdown-toggle', true)
        .attr('data-bs-toggle', 'dropdown')
        .attr('aria-expanded', 'false');
    dropdown.append('ul')
        .classed('dropdown-menu', true)
        .classed('py-0', true);
    form.append('span')
        .classed('selected', true);
  }

  function updateColorScaleItems(selection, items) {
    const listitems = selection.select('.dropdown-menu')
      .selectAll('li')
        .data(items, d => d.name);
    listitems.exit().remove();
    listitems.enter()
      .append('li')
      .append('a')
        .classed('dropdown-item', true)
        .classed('py-0', true)
        .attr('href', '#')
        .attr('title', d => d.name)
        .on('click', (event, d) => {
          selection.call(updateColorScaleBox, d);
          selection.dispatch('change', {bubbles: true});
        })
        .each((d, i, nodes) => {
          d3.select(nodes[i])
              .call(shape.colorBar(d.range), d.range, 80, d);
        });
  }

  function updateColorScaleBox(selection, item) {
    const selected = selection.select('.selected');
    selected.selectAll('svg').remove();
    selected.datum(item);  // Bind selected item record
    selected
        .call(shape.colorBar(item.range), item.range, 80, item.name);
  }

  function colorScaleBoxItem(selection) {
    return selection.select('.selected').datum();
  }

  function colorScaleBoxValue(selection) {
    return colorScaleBoxItem(selection).name;
  }


  var lbox = {
    selectBox, updateSelectBoxOptions, updateSelectBoxValue, selectBoxValue, selectBoxValueIndex,
    checklistBox, updateChecklistItems, checkRequired, updateChecklistValues,
    checklistValues, anyChecked, setChecklistValidity,
    colorScaleBox, updateColorScaleItems, updateColorScaleBox,
    colorScaleBoxValue, colorScaleBoxItem
  };

  const iconBaseURL = './assets/icons/';


  function buttonBox(selection, label, type) {
    selection
        .classed('form-group', true)
        .classed('mb-1', true)
      .append('button')
        .classed('btn', true)
        .classed(`btn-${type}`, true)
        .classed('btn-sm', true)
        .text(label);
  }


  function menuButton(selection, label, type) {
    selection
        .classed('btn', true)
        .classed(`btn-${type}`, true)
        .classed(`btn-sm`, true)
        .classed('mr-1', true)
        .text(label);
  }


  function menuButtonLink(selection, label, type, icon) {
    selection
        .classed('btn', true)
        .classed(`btn-${type}`, true)
        .classed(`btn-sm`, true)
        .classed('mr-1', true)
        .attr('role', 'button')
        .attr('href', '#');
    selection.append('img')
        .attr('src', icon ? `${iconBaseURL}${icon}.svg` : null)
        .style('width', '1.25rem')
        .style('height', '1.25rem');
    selection.append('span')
        .style('vertical-align', 'middle')
        .text(label);
  }


  function menuModalLink(selection, target, label, type, icon) {
    selection
        .classed('btn', true)
        .classed(`btn-${type}`, true)
        .classed(`btn-sm`, true)
        .classed('mr-1', true)
        .attr('href', '#')
        .attr('role', 'button')
        .attr('data-toggle', 'modal')
        .attr('data-target', `#${target}`);
    selection.append('img')
        .attr('src', icon ? `${iconBaseURL}${icon}.svg` : null)
        .style('width', '1.25rem')
        .style('height', '1.25rem');
    selection.append('span')
        .classed('label', true)
        .style('vertical-align', 'middle')
        .text(label);
  }


  function dropdownMenuButton(selection, label, type, icon) {
    selection
        .classed('btn-group', true)
        .classed('mr-1', true);
    const button = selection.append('button')
        .classed('btn', true)
        .classed(`btn-${type}`, true)
        .classed('btn-sm', true)
        .classed('dropdown-toggle', true)
        .attr('data-toggle', 'dropdown');
    button.append('img')
        .attr('src', icon ? `${iconBaseURL}${icon}.svg` : null)
        .style('width', '1.25rem')
        .style('height', '1.25rem');
    button.append('span')
        .style('vertical-align', 'middle')
        .text(label);
    selection.append('div')
        .classed('dropdown-menu', true);
  }


  function dropdownMenuItem(selection, label, icon) {
    selection.classed('dropdown-item', true)
        .attr('href', '#');
    selection.append('img')
        .attr('src', icon ? `${iconBaseURL}${icon}.svg` : null)
        .classed('mr-1', true)
        .style('width', '2rem')
        .style('height', '2rem');
    selection.append('span')
        .text(label);
  }

  function dropdownMenuModal(selection, label, target, icon) {
    selection.classed('dropdown-item', true)
        .attr('href', '#')
        .attr('data-toggle', 'modal')
        .attr('data-target', `#${target}`);
    selection.append('img')
        .attr('src', `${iconBaseURL}${icon}.svg`)
        .classed('mr-1', true)
        .style('width', '2rem')
        .style('height', '2rem');
    selection.append('span')
        .text(label);
  }


  function dropdownMenuFile(selection, label, accept, icon) {
    selection.classed('dropdown-item', true)
        .attr('href', '#')
        .on('click', function () {
          d3.select(this).select('input').node().click();
        });
    selection.append('form')
        .style('display', 'none')
      .append('input')
        .attr('type', 'file')
        .attr('accept', accept);
    selection.append('img')
        .attr('src', `${iconBaseURL}${icon}.svg`)
        .classed('mr-1', true)
        .style('width', '2rem')
        .style('height', '2rem');
    selection.append('span')
        .text(label);
  }

  function fileButton(selection, label, accept, icon) {
      selection
          .on('click', event => {
            d3.select(event.currentTarget).select('input').node().click();
          });
      selection.append('form')
          .style('display', 'none')
        .append('input')
          .attr('type', 'file')
          .attr('accept', accept);
      selection.append('img')
          .attr('src', `${iconBaseURL}${icon}.svg`)
          .attr('title', label)
          .classed('mr-1', true)
          .style('width', '2rem')
          .style('height', '2rem');
      selection.append("span")
          .text(label);
    }

  function fileValue(selection) {
    return selection.select('input').node().files[0];
  }

  function menuIcon(selection, label, icon) {
      selection.append('img')
          .attr('src', icon ? `${iconBaseURL}${icon}.svg` : null)
          .classed('mr-1', true)
          .style('width', '2rem')
          .style('height', '2rem');
      selection.append('span')
          .text(label);
    }

  var button = {
    iconBaseURL, buttonBox, menuButton, menuButtonLink, menuModalLink,
    dropdownMenuButton, dropdownMenuItem, dropdownMenuModal,
    dropdownMenuFile, fileValue, fileButton, menuIcon
  };

  function updateFormValue(selection, value) {
    selection.select('.form-control').property('value', value);
    selection.call(setValidity, true);  // Clear validity state
  }


  function formValue(selection) {
    return selection.select('.form-control').property('value');
  }


  function formValid(selection) {
    return selection.select('.form-control').node().checkValidity();
  }


  function setValidity(selection, valid) {
    selection.select('.invalid-feedback')
        .style('display', valid ? 'none': 'inherit');
    selection.select('.form-control')
        .style('background-color', valid ? null : '#ffcccc');
  }


  function textBox(selection, label) {
    selection
        .classed('form-group', true)
        .classed('form-row', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    selection.append('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('col-8', true)
        .attr('type', 'text')
        .on('input', function () {
          const valid = formValid(selection);
          selection.call(setValidity, valid);
        });
    selection.append('div')
        .classed('col-4', true);
    selection.append('div')
        .call(badge$1.invalidFeedback)
        .classed('col-8', true);
  }


  function readonlyBox(selection, label) {
    selection
        .classed('form-group', true)
        .classed('form-row', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    selection.append('input')
        .classed('form-control-plaintext', true)
        .classed('form-control-sm', true)
        .classed('col-8', true)
        .attr('type', 'text')
        .attr('readonly', 'readonly');
  }

  function updateReadonlyValue(selection, value) {
    selection.select('.form-control-plaintext').property('value', value);
  }

  function readonlyValue(selection) {
    return selection.select('.form-control-plaintext').property('value');
  }



  function checkBox(selection, label) {
    const box = selection
        .classed('form-check', true);
    box.append('input')
        .classed('form-check-input', true)
        .attr('type', 'checkbox');
    box.append('label')
        .classed('form-check-label', true)
        .classed('small', true)
        .text(label);
  }

  function updateCheckBox(selection, checked) {
    selection.select('input').property('checked', checked);
  }

  function checkBoxValue(selection) {
    return selection.select('input').property('checked');
  }


  function numberBox(selection, label) {
    selection
        .classed('row', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    selection.append('div')
        .classed('col-8', true)
      .append('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .attr('type', 'number')
        .attr('required', 'required')
        .on('input', function () {
          const valid = formValid(selection);
          selection.call(setValidity, valid);
        });
    selection.append('div')
        .classed('col-4', true);
    selection.append('div')
        .call(badge$1.invalidFeedback)
        .classed('col-8', true);
  }

  function updateNumberRange(selection, min, max, step) {
    selection.select('.form-control')
        .attr('min', min)
        .attr('max', max)
        .attr('step', step)
        .dispatch('input', {bubbles: true});
  }


  function domainBox(selection, label) {
    selection
        .classed('row', true)
        .classed('align-items-center', true)
      .append('div')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .text(label);

    const minBox = selection.append('div');
    minBox.append('label').text('min');
    minBox.append('input').classed('min', true);

    const maxBox = selection.append('div');
    maxBox.append('label').text('max');
    maxBox.append('input').classed('max', true);

    selection.selectAll('div')
        .classed('form-group', true)
        .classed('col-4', true)
        .classed('px-1', true)
        .classed('mb-0', true);

    selection.selectAll('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('py-0', true);

    selection.selectAll('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .attr('type', 'number')
        .attr('step', 0.01)  // IQRAsymFence digits
        .on('input', function () {
          const minvalid = selection.select('.min').node().checkValidity();
          const maxvalid = selection.select('.max').node().checkValidity();
          selection.call(setDomainValidity, minvalid, maxvalid);
        });
    selection.append('div')
        .classed('col-4', true);
    selection.append('div')
        .call(badge$1.invalidFeedback)
        .classed('col-8', true);
  }

  function updateDomainValues(selection, range) {
    if (range === null) { return; }
    selection.select('.min').property('value', range[0]);
    selection.select('.max').property('value', range[1]);
  }

  function domainValues(selection) {
    return [
      selection.select('.min').property('value'),
      selection.select('.max').property('value')
    ];
  }

  function setDomainValidity(selection, minvalid, maxvalid) {
    selection.select('.invalid-feedback')
        .style('display', minvalid & maxvalid ? 'none': 'inherit');
    selection.select('.min')
        .style('background-color', minvalid ? null : '#ffcccc');
    selection.select('.max')
        .style('background-color', maxvalid ? null : '#ffcccc');
  }

  /**
   * Render color scale box components
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function colorBox(selection, label) {
    selection
        .classed('form-row', true)
        .classed('align-items-center', true)
        .on('change', () => {
          // avoid update by mousemove on the colorpicker
          d3.event.stopPropagation();
        });
    selection.append('div')
        .classed('form-group', true)
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .classed('mb-1', true)
        .text(label);
    selection.append('div')
        .classed('form-group', true)
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .classed('mb-1', true)
      .append('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .attr('type', 'color');
  }


  function fileInputBox(selection, label, accept) {
    selection
        .classed('form-group', true)
        .classed('form-row', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    selection.append('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('form-control-file', true)
        .classed('col-8', true)
        .attr('type', 'file')
        .attr('accept', accept)
        .on('change', function () {
          const valid = fileInputValid(selection);
          selection.call(setValidity, valid);
        });
    selection.append('div')
        .classed('col-4', true);
    selection.append('div')
        .call(badge$1.invalidFeedback)
        .classed('col-8', true);
  }

  function clearFileInput(selection) {
    // TODO: FileList object (input.files) may be a readonly property
    const label = selection.select('label').text();
    const accept = selection.select('input').attr('accept');
    selection.selectAll('*').remove();
    selection.call(fileInputBox, label, accept);
  }

  function fileInputValue(selection) {
    return selection.select('input').property('files')[0];
  }

  function fileInputValid(selection) {
    // TODO: attribute 'require' does not work with input type=file
    return selection.select('input').property('files').length > 0;
  }


  var box = {
    updateFormValue, formValue, formValid, setValidity,
    textBox, readonlyBox, updateReadonlyValue, readonlyValue,
    numberBox, updateNumberRange,
    domainBox, updateDomainValues, domainValues, setDomainValidity, 
    checkBox, updateCheckBox, checkBoxValue,
    colorBox,
    fileInputBox, clearFileInput, fileInputValue, fileInputValid
  };

  function dialogBase(selection) {
    selection
        .classed('modal', true)
        .attr('tabindex', -1)
        .attr('aria-hidden', true);
    selection.append('div')
        .classed('modal-dialog', true)
      .append('div')
        .classed('modal-content', true);
  }


  function confirmDialog(selection) {
    const base = selection.call(dialogBase)
        .select('.modal-content');
    // body
    base.append('div')
        .classed('modal-body', true)
      .append('div')
        .classed('message', true);
    // footer
    const footer = base.append('div')
        .classed('modal-footer', true);
    footer.append('button')
        .classed('btn', true)
        .classed('btn-outline-secondary', true)
        .classed('cancel', true)
        .attr('type', 'button')
        .attr('data-bs-dismiss', 'modal')
        .text('Cancel')
        .on('click', event => {
          selection.dispatch('cancel');
        });
    footer.append('button')
        .classed('btn', true)
        .classed('btn-primary', true)
        .classed('ok', true)
        .attr('type', 'button')
        .attr('data-bs-dismiss', 'modal')
        .text('OK')
        .on('click', event => {
          selection.dispatch('submit');
        });
    // custom backdrop
    selection
        .on('click', event => {
          // do not trigger when the child elements are clicked
          if (event.currentTarget !== event.target) { return; }
          selection.dispatch('cancel');
        });
  }


  async function showConfirmDialog(message, selector="confirmd") {
    const selection = d3.select(`#${selector}`);
    selection.select('.message').text(message);
    const control = new bootstrap.Modal(document.getElementById(selector));
    control.toggle();
    return new Promise(resolve => {
      selection
          .on('submit', () => resolve(true))
          .on("cancel", () => resolve(false));
    });
  }


  function submitDialog(selection, title) {
    const base = selection.call(dialogBase)
        .select('.modal-content');
    // header
    const header = base.append('div')
        .classed('modal-header', true);
    header.append('h5')
        .classed('modal-title', true)
        .text(title);
    header.append('button')
        .classed('btn-close', true)
        .attr('type', 'button')
        .attr('data-bs-dismiss', 'modal')
        .attr('aria-label', 'Close');
    // body
    base.append('div')
        .classed('modal-body', true);
    // footer
    const footer = base.append('div')
        .classed('modal-footer', true);
    footer.append('button')
        .classed('btn', true)
        .classed('btn-secondary', true)
        .attr('type', 'button')
        .attr('data-bs-dismiss', "modal")
        .text('Cancel')
        .on('click', event => {
          selection.dispatch('cancel');
        });
    footer.append('button')
        .classed('btn', true)
        .classed('btn-primary', true)
        .attr('type', 'button')
        .attr('data-bs-dismiss', 'modal')
        .text('Save changes')
        .on('click', event => {
          selection.dispatch('submit');
        });
    // custom backdrop
    selection
        .on('click', event => {
          // do not trigger when the child elements are clicked
          if (event.currentTarget !== event.target) { return; }
          selection.dispatch('cancel');
        });
  }


  function renameDialog(selection) {
    const renameBox = selection.call(submitDialog, "Rename snapshot")
      .select('.modal-body').append('div')
        .classed('name', true)
        .call(box.textBox, 'New name');
    renameBox.select('.form-control')
        .attr('required', 'required');
    renameBox.select('.invalid-feedback')
        .call(badge$1.updateInvalidMessage, 'Please provide a valid name');
  }


  async function showRenameDialog(name, selector="renamed") {
    const selection = d3.select(`#${selector}`);
    selection.select('.name')
        .call(box.updateFormValue, name);
    const control = new bootstrap.Modal(document.getElementById(selector));
    control.toggle();
    return new Promise(resolve => {
      selection
          .on('submit', event => {
            const value = box.formValue(selection.select('.name'));
            resolve(value);
          })
          .on("cancel", event => {
            resolve(false);
          });
          
    });
  }


  var modal = {
    confirmDialog, showConfirmDialog, renameDialog, showRenameDialog
  };

  class TransformState {
    constructor(width, height, transform) {
      this.fieldWidth = width;
      this.fieldHeight = height;

      /*
      transform: zoom and pan parameters
      viewBox: SVG canvas area, depends on browser size, can be changed by event.resize.
      focusArea: display area obtained by applying transform to viewbox
      -> focusArea = transform(viewBox)
      */

      this.viewBox = {
        top: 0,
        right: this.fieldWidth,
        bottom: this.fieldHeight,
        left: 0
      };

      this.focusArea = {};
      this.focusAreaMargin = 50;

      this.transform = transform || {x: 0, y: 0, k: 1};
      this.prevTransform = {
        x: this.transform.x,
        y: this.transform.y,
        k: this.transform.k
      };
    }

    setFocusArea() {
      const tx = this.transform.x;
      const ty = this.transform.y;
      const tk = this.transform.k;
      const margin = this.focusAreaMargin;
      this.focusArea.top = (this.viewBox.top - ty) / tk - margin;
      this.focusArea.left = (this.viewBox.left - tx) / tk - margin;
      this.focusArea.bottom = (this.viewBox.bottom - ty) / tk + margin;
      this.focusArea.right = (this.viewBox.right - tx) / tk + margin;
      // this.showFocusArea();  // debug
    }

    setViewBox(width, height) {
      // called by browser resize
      this.viewBox.right = width;
      this.viewBox.bottom = height;
      // this.showViewBox();  // debug
      this.setFocusArea();
    }

    setTransform(tx, ty, tk) {
      // called by transform operation
      this.transform.x = tx;
      this.transform.y = ty;
      this.transform.k = tk;
      // this.showTransform(); // debug
      this.setFocusArea();
    }

    showTransform() {
      d3.select('#debug-transform')
        .text(JSON.stringify(this.transform));
    }

    showFocusArea() {
      d3.select('#debug-focusarea')
        .text(JSON.stringify(this.focusArea));
    }

    showViewBox() {
      d3.select('#debug-viewbox')
        .text(JSON.stringify(this.viewBox));
    }
  }

  const colorScales = [
    {
      name: "green",
      range: ['#778899', '#98fb98'],
      unknown: '#f0f0f0', type: "continuous"
    },
    {
      name: "blue",
      range: ['#778899', '#7fffd4'],
      unknown: '#f0f0f0', type: "continuous"
    },
    {
      name: "yellow",
      range: ['#778899', '#f0e68c'],
      unknown: '#f0f0f0', type: "continuous"
    },
  {
      name: "gray",
      range: ['#778899', '#cccccc'],
      unknown: '#f0f0f0', type: "continuous"
    },
    {
      name: "category10",
      range: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
        '#b3de69','#fccde5','#bc80bd','#ccebc5'],
      unknown: '#f0f0f0', type: "discrete"
    },
    {
      name: "cbsafe",
      range: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5',
        '#80cdc1','#35978f','#01665e','#003c30'],
      unknown: '#f0f0f0', type: "discrete"
    }
  ];

  const nodeSizeScales = [
    {
      name: "5-20px",
      range: [5, 20],
      unknown: 1, type: "continuous"
    },
    {
      name: "10-40px",
      range: [10, 40],
      unknown: 1, type: "continuous"
    },
    {
      name: "15-60px",
      range: [15, 60],
      unknown: 1, type: "continuous"
    },
    {
      name: "20-80px",
      range: [20, 80],
      unknown: 1, type: "continuous"
    },
    {
      name: "30-120px",
      range: [30, 120],
      unknown: 1, type: "continuous"
    },
    {
      name: "40-160px",
      range: [40, 160],
      unknown: 1, type: "continuous"
    }
  ];

  const edgeWidthScales = [
    {
      name: "2-10px",
      range: [2, 10],
      unknown: 2, type: "continuous"
    },
    {
      name: "4-20px",
      range: [4, 20],
      unknown: 4, type: "continuous"
    },
    {
      name: "8-40px",
      range: [8, 40],
      unknown: 8, type: "continuous"
    }
  ];



  function d3scalewrapper(d3func, isNumeric, unknown) {
    return d => {
      // Sanitize
      if (d === '' || typeof d === 'undefined' || d === null) {
        return unknown;  // invalid values
      }
      if (isNumeric && parseFloat(d) != d) {
        return unknown;  // texts
      }
      // Apply function
      const result = d3func(d);
      if (result === undefined) {
        console.warn(`Unexpected value: ${d}`);
        console.warn(params);
        return unknown;  // TODO: specify unexpected behavior
      }
      return result;
    };
  }

  function scaleFunction(rangeType, appr) {
    const rangeMap = {
      color: colorScales,
      size: nodeSizeScales,
      width: edgeWidthScales
    };
    const isNumeric = appr.domain !== null; // scale.fieldType(appr.field, config) == "numeric";
    let range, unknown;
    if (appr.range !== null) {
      // custom range
      const defaultUnk = { color: '#f0f0f0', size: 1, width: 2};
      range = appr.range;
      unknown = appr.unknown || defaultUnk[rangeType];
    } else {
      const preset = rangeMap[rangeType].find(e => e.name === appr.rangePreset);
      range = preset.range;
      unknown = preset.unknown;
    }
    const d3f = isNumeric ? d3.scaleLinear().domain(appr.domain).range(range).clamp(true)
      : d3.scaleOrdinal().range(range);
    return d3scalewrapper(d3f, isNumeric, unknown);
  }


  // Default field patterns
  const IMAGE_FIELD_PATTERN = new RegExp("(structure|image|svg|^i_)", "i");
  const NUM_FIELD_PATTERN = new RegExp(
    "(IC50|EC50|AC50|%|ratio|^mw$|logp|weight|dist|score|value|^n_)", "i");
  const CAT_FIELD_PATTERN = new RegExp(
    "(community|comm|class|category|cluster|group|type|label|flag|^is_|^has_|^c_)", "i");


  function fieldType(prefixed, config) {
    const field = prefixed.substring(5);  // e.g. node.field -> field
    if (config.imageFields.includes(field)) {
      return "image"
    } else if  (config.numericFields.includes(field)) {
      return "numeric"
    } else if  (config.categoricalFields.includes(field)) {
      return "categorical"
    } else if  (IMAGE_FIELD_PATTERN.test(field)) {
      return "image"
    } else if (NUM_FIELD_PATTERN.test(field))  {
      return "numeric"
    } else if (CAT_FIELD_PATTERN.test(field))  {
      return "categorical"
    }
  }


  function IQRAsymFence(values, f=1.5) {
    // asymmetric IQR fence
    const med = d3.quantile(values, 0.5);
    const p25 = d3.quantile(values, 0.25);
    const p75 = d3.quantile(values, 0.75);
    const low = p25 - (med - p25) * f;
    const high = p75 + (p75 - med) * f;
    return [Math.round(low * 100) / 100, Math.round(high * 100) / 100];  // digits=2
  }


  function quantiles(values) {
    return [ // digits=2
      Math.round(d3.quantile(values, 0) * 100) / 100,
      Math.round(d3.quantile(values, 0.25) * 100) / 100,
      Math.round(d3.quantile(values, 0.5) * 100) / 100,
      Math.round(d3.quantile(values, 0.75) * 100) / 100,
      Math.round(d3.quantile(values, 1) * 100) / 100
    ];
  }


  function isD3Format(notation) {
    try {
      d3.format(notation);
    } catch (err) {
      return false;
    }
    return true;
  }


  var scale = {
    colorScales, nodeSizeScales, edgeWidthScales,
    scaleFunction, fieldType, IQRAsymFence, quantiles, isD3Format
  };

  class NetworkState extends TransformState {
    constructor(session, width, height) {
      super(width, height, null);
      // Session properties
      this.sessionName = session.name;
      this.sessionID = session.id;

      this.nodes = session.nodes;
      this.edges = session.edges;

      // Fields
      this.nodeFields = [...this.nodes.reduce((a, b) => {
        Object.keys(b).forEach(e => { a.add(e); });
        return a;
      }, new Set())];  // unique keys
      this.edgeFields = [...this.edges.reduce((a, b) => {
        Object.keys(b).forEach(e => { a.add(e); });
        return a;
      }, new Set())];  // unique keys
      this.fields = [];
      this.nodeFields.forEach(e => { this.fields.push(`node.${e}`); });
      this.edgeFields.forEach(e => { this.fields.push(`edge.${e}`); });


      // set internal attrs for d3.force
      this.nodes.forEach((e, i) => {
        e.__index = i;  // internal id for d3.force
        e.__selected = false;  // for multiple selection
      });
      this.edges.forEach((e, i) => {
        // original edges and edge indices used for filtering by graph topology.
        e.__source = e.source;
        e.__target = e.target;
        e.__index = i;
      });

      // filtered elements
      this.fnodes = [];
      this.fedges = [];

      // visible elements
      this.vnodes = [];
      this.vedges = [];

      // States
      this.showNodeImage = false;
      this.showEdge = false;
      this.forceActive = true;
      this.stateChanged = false;  // if true, there are unsaved changes

      // Client event listeners
      this.zoomListener = null;
      this.dragListener = null;

      this.callbacks = {};

      // update coords and force indicators in each ticks
      this.updateForceIndicatorCallback = () => {};
      this.tickCallback = sim => {
        this.dispatch("updateCoords");
        this.updateForceIndicatorCallback(sim);
      };


      /* Initialize snapshot */

      this.name = "default"; // not shown

      // Filters
      this.filters = session.filters || [
        {field: 'edge.weight', operator: '>=', value: 0.7, groups: []}
      ];
      this.filters.forEach((r, i) => {  // fill null
        if (!r.hasOwnProperty("operator")) { this.filters[i].operator = null; }
        if (!r.hasOwnProperty("value")) { this.filters[i].value = null; }
        if (!r.hasOwnProperty("groups")) { this.filters[i].groups = []; }
      });

      // Config
      this.config = {
        numericFields: [],
        categoricalFields: [],
        imageFields: [],
        showNodeImageThreshold: 200,
        alwaysShowNodeImage: false,
        showEdgeThreshold: 1000,
        alwaysShowEdge: false,
        forceParam: 'dense'
      };
      if (session.hasOwnProperty("config")) {
        Object.assign(this.config, session.config);
      }
      // Field types
      this.imageFields = this.fields.filter(e => scale.fieldType(e, this.config) === "image");
      this.numericFields = this.fields.filter(e => scale.fieldType(e, this.config) === "numeric");
      this.categoricalFields = this.fields.filter(e => scale.fieldType(e, this.config) === "categorical");
      // default domain
      this.defaultDomain = {};
      this.numericFields.forEach(e => {
        this.defaultDomain[e] = scale.IQRAsymFence(
          e.startsWith("node.") ? this.nodes.map(n => n[e.substring(5)]) : this.edges.map(n => n[e.substring(5)]));
      });

      // Appearance
      this.appearance = {
        nodeColor: {range: ['#98fb98', '#98fb98'], unknown: '#98fb98'},
        nodeSize: {range: [40, 40], unknown: 40},
        nodeLabel: {size: 20, visible: false},
        nodeImage: {size: 180},
        edgeColor: {range: ['#cccccc', '#cccccc'], unknown: '#cccccc'},
        edgeWidth: {range: [10, 10], unknown: 10},
        edgeLabel: {size: 12, visible: false}
      };
      if (session.hasOwnProperty("appearance")) {
        Object.assign(this.appearance, session.appearance);
      }
      ["nodeColor", "nodeSize", "edgeColor", "edgeWidth"].forEach((k, i) => {
        // fill null
        if (!this.appearance[k].hasOwnProperty("field")) {
          this.appearance[k].field = null;
        }
        if (!this.appearance[k].hasOwnProperty("domain")) {
          this.appearance[k].domain = null;
        }
        if (!this.appearance[k].hasOwnProperty("range")) {
          this.appearance[k].range = null;
        }
        if (!this.appearance[k].hasOwnProperty("rangePreset")) {
          this.appearance[k].rangePreset = null;
        }
        if (!this.appearance[k].hasOwnProperty("unknown")) {
          this.appearance[k].unknown = null;
        }
      });

      this.snapshots = session.snapshots || [];
      this.snapshotIndex = this.snapshots.length - 1;
    }


    register(name, func) {
      this.callbacks[name] = func;
    }

    dispatch(name) {
      if (this.callbacks.hasOwnProperty(name)) {
        this.callbacks[name]();
      }
    }

    updateSnapshot(idx) {
      if (idx >= 0) {  // idx = -1 -> no snapshots (default configuration)
        this.snapshotIndex = idx;
        this.forceActive = false;
        const snapshot = this.snapshots[idx];
        this.name = snapshot.name;
        this.filters = JSON.parse(JSON.stringify(snapshot.filters));
        this.config = JSON.parse(JSON.stringify(snapshot.config));
        this.appearance = JSON.parse(JSON.stringify(snapshot.appearance));
        this.transform = Object.assign({}, snapshot.transform);
        snapshot.positions.forEach((e, i) => {
          this.nodes[i].x = e.x;
          this.nodes[i].y = e.y;
          this.nodes[i].fx = e.x;  // force will update x by fx
          this.nodes[i].fy = e.y;  // force will update y by fy
        });
      }
      this.setFocusArea();  // set focusArea of initial viewBox
      this.dispatch("updateSnapshot");
    }

    getSnapshot() {
      const today = new Date();
      const positions = this.nodes.map(e => {
        return {x: e.x || 0.0, y: e.y || 0.0}
      });
      return {
        name: `snapshot - ${today.toLocaleString('jp')}`,
        filters: this.filters,
        positions: positions,
        transform: this.transform,
        config: this.config,
        appearance: this.appearance
      };
    }

    /**
     * update this.nodes and this.edges used by d3.force
     */
    updateFilter() {
      // fnodes and fedges that are enabled and used for force layout
      // called by filterControlBox

      // default, no filter applied
      this.fnodes = this.nodes;
      this.fedges = this.edges;

      this.filters.forEach(cond => {
        const isNode = cond.field.startsWith("node.");
        const field = cond.field.substring(5);
        const isNum = this.numericFields.includes(cond.field);
        const isCat = this.categoricalFields.includes(cond.field);
        if (isNode) {
          if (isNum) {
            this.fnodes = this.fnodes.filter(
              e => misc.operatorFunction(cond.operator)(e[field], cond.value));
          } else if (isCat) {
            this.fnodes = this.fnodes.filter(e => cond.groups.includes(e[field]));
          }
          // node-induced subgraph edges
          const fn = new Set(this.fnodes.map(e => e.__index));
          this.fedges = this.fedges.filter(e => {
            return fn.has(e.__source) && fn.has(e.__target);
          });
        } else { // edge
          if (isNum) {
            this.fedges = this.fedges.filter(
              e => misc.operatorFunction(cond.operator)(e[field], cond.value));
          } else if (isCat) {
            this.fedges = this.fedges.filter(e => cond.groups.includes(e[field]));
          }
        }
      });

      this.dispatch("setForce");
      this.dispatch("updateControlBox");  // filter panes
      // set transform
      this.dispatch("updateField");
      this.dispatch("updateZoom");
      this.updateVisibility();
    }

    setViewBox(width, height) {
      super.setViewBox(width, height);
      this.dispatch("updateViewBox");
    }

    setTransform(tx, ty, tk) {
      super.setTransform(tx, ty, tk);
      this.dispatch("updateField");
      this.dispatch("updateZoom");
      this.updateVisibility();
    }

    fitTransform() {
      // calculate boundary
      const xs = this.fnodes.map(e => e.x);
      const ys = this.fnodes.map(e => e.y);
      const btop = Math.min(...ys);
      const bleft = Math.min(...xs);
      const bbottom = Math.max(...ys);
      const bright = Math.max(...xs);

      const vh = this.viewBox.bottom;
      const vw = this.viewBox.right;
      const vr = vw / vh;
      const bh = bbottom - btop;
      const bw = bright - bleft;
      const br = bw / bh;
      const isPortrait = vr >= br;
      const tk = isPortrait ? vh / bh : vw / bw;
      const adjustH = isPortrait ? (vw - bw * tk) / 2 : 0;
      const adjustV = isPortrait ? 0 : (vh - bh * tk) / 2;
      const tx = -bleft * tk + adjustH;
      const ty = -btop * tk + adjustV;
      this.setTransform(tx, ty, tk);
    }

    updateVisibility() {
      // vnodes and vedges used for component drawing
      // dispatched when fnodes or focusArea are changed
      this.vnodes = this.fnodes.filter(e => {
        return e.y > this.focusArea.top && e.x > this.focusArea.left
          && e.y < this.focusArea.bottom && e.x < this.focusArea.right;
      });
      // all incidences to the filtered nodes
      const vn = new Set(this.vnodes.map(e => e.__index));
      this.vedges = this.fedges.filter(e => {
        return vn.has(e.__source) || vn.has(e.__target);
      });

      // suppress node image rendering
      const ncnt = this.vnodes.length;
      this.showNodeImage = ncnt < this.config.showNodeImageThreshold || this.config.alwaysShowNodeImage;
      // suppress edge rendering
      const ecnt = this.vedges.length;
      if (ecnt > this.config.showEdgeThreshold && !this.config.alwaysShowEdge) {
        this.vedges = [];
      }
      this.dispatch("updateVisibility");
      this.dispatch("updateNodeInteraction");
      this.setStateChanged(true);
    }

    setAppearance(group, field, value) {  // TODO: e => d3.select(e.currentTarget)
      this.appearance[group][field] = value;
      if (group.startsWith("node")) {
        this.dispatch("updateNodeAttr");
      } else if (group.startsWith("edge")) {
        this.dispatch("updateEdgeAttr");
      }
      this.dispatch("updateControlBox");
      this.setStateChanged(true);
    }

    setStateChanged(value) {
      this.stateChanged = value;
      this.dispatch("updateHeader");
    }
  }

  function updateNodes(selection, records) {
    const nodes = selection.selectAll('.node')
      .data(records, d => d.__index);
    nodes.exit().remove();
    const entered = nodes.enter()
      .append('g')
        .attr('class', 'node');
    entered.append('circle')
        .attr('class', 'node-symbol');
    entered.append('foreignObject')
        .attr('class', 'node-image');
    entered.append('foreignObject')
        .attr('class', 'node-html')
      .append('xhtml:div');
    entered.merge(nodes)
        .call(updateNodeCoords);
  }


  function updateEdges(selection, records) {
    const edges = selection.selectAll('.link')
      .data(records, d => d.__index);
    edges.exit().remove();
    const entered = edges.enter()
      .append('g')
        .attr('class', 'link');
    entered.append('line')
        .attr('class', 'edge-line')
        .style('stroke-opacity', 0.6);
    entered.append('text')
        .attr('class', 'edge-label')
        .attr('text-anchor', 'middle');
    entered.merge(edges)
        .call(updateEdgeCoords);
  }


  function updateNodeAttrs(selection, state) {
    const colorField = state.appearance.nodeColor.field;
    const sizeField = state.appearance.nodeSize.field;
    const labelField = state.appearance.nodeLabel.field;
    const labelSize = state.appearance.nodeLabel.size;
    const labelVisible = state.appearance.nodeLabel.visible;
    const svgWidth = state.appearance.nodeImage.size;
    const svgHeight = state.appearance.nodeImage.size;
    const colorScaleFunc = scale.scaleFunction("color", state.appearance.nodeColor);
    const sizeScaleFunc = scale.scaleFunction("size", state.appearance.nodeSize);
    selection.selectAll('.node').select('.node-symbol')
        .attr('r', d => sizeScaleFunc(d[sizeField]))
        .style('fill', d => colorScaleFunc(d[colorField]));
    const htwidth = 200;

    const fo = selection.selectAll('.node').select('.node-html');
    fo.attr('x', -htwidth / 2)
        .attr('y', d => state.showNodeImage ? svgWidth / 2 - 10 : sizeScaleFunc(d[sizeField]))
        .attr('width', htwidth)
        .attr('height', 1)
        .attr('overflow', 'visible');
    fo.select('div')
        .style('font-size', `${labelSize}px`)
        .style('color', d => d.labelColor || "#666666")
        .style('text-align', 'center')
        .style('display', labelVisible ? 'block' : 'none')
        .html(d => d[labelField]);

    const image = selection.selectAll('.node').select('.node-image')
        .attr('width', svgWidth)
        .attr('height', svgHeight)
        .attr('x', -svgWidth / 2)
        .attr('y', -svgHeight / 2);
      if (state.showNodeImage) {
        image.html(d => d[state.appearance.nodeImage.field]);
      } else {
        image.select('svg').remove();
      }
  }


  function updateEdgeAttrs(selection, state) {
    const colorField = state.appearance.edgeColor.field;
    const widthField = state.appearance.edgeWidth.field;
    const labelField = state.appearance.edgeLabel.field;
    const labelSize = state.appearance.edgeLabel.size;
    const labelVisible = state.appearance.edgeLabel.visible;
    const colorScaleFunc = scale.scaleFunction("color", state.appearance.edgeColor);
    const widthScaleFunc = scale.scaleFunction("width", state.appearance.edgeWidth);
    selection.selectAll('.link').select('.edge-line')
      .style('stroke', d => colorScaleFunc(d[colorField]))
      .style('stroke-width', d => widthScaleFunc(d[widthField]));
    selection.selectAll('.link').select('.edge-label')
      .attr('font-size', labelSize)
      .attr('visibility', labelVisible ? 'inherit' : 'hidden')
      .style('fill', d => d.labelColor || "#666666")
      .text(d => d[labelField]);
  }


  function updateNodeCoords(selection) {
    selection.attr('transform', d => `translate(${d.x}, ${d.y})`);
  }


  function updateEdgeCoords(selection) {
    selection.attr('transform', d => `translate(${d.source.x}, ${d.source.y})`);
    selection.select('.edge-line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', d => d.target.x - d.source.x)
      .attr('y2', d => d.target.y - d.source.y);
    selection.select('.edge-label')
      .attr('x', d => (d.target.x - d.source.x) / 2)
      .attr('y', d => (d.target.y - d.source.y) / 2);
  }


  function updateNodeSelection(selection) {
    selection.select('.node-symbol')
      .attr('stroke', d => d.__selected ? 'red' : null)
      .attr('stroke-width', d => d.__selected ? 10 : null)
      .attr('stroke-opacity', d => d.__selected ? 0.5 : 0);
  }


  function updateComponents(selection, state) {
    selection.select('.node-layer')
      .call(updateNodes, state.vnodes)
      .call(updateNodeAttrs, state);
    selection.select('.edge-layer')
      .call(updateEdges, state.vedges)
      .call(updateEdgeAttrs, state);
  }


  function viewComponent(selection) {
    selection
        .attr('preserveAspectRatio', 'xMinYMin meet')
        .attr('pointer-events', 'all')
        .attr('viewBox', "0 0 0 0");

    // Boundary
    selection.append('rect')
        .classed('boundary', true)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', '#ffffff')
        .attr('stroke-width', 1)
        .attr('stroke', '#cccccc');

    // Field
    const field = selection.append('g')
        .classed('field', true)
        .style('opacity', 1e-6);
    field.transition()
        .duration(1000)
        .style('opacity', 1);
    field.append('g').classed('edge-layer', true);
    field.append('g').classed('node-layer', true);
  }


  function updateViewBox(selection, state) {
    selection
        .attr('viewBox', `0 0 ${state.viewBox.right} ${state.viewBox.bottom}`)
        .attr('width', `${state.viewBox.right}px`)
        .attr('height', `${state.viewBox.bottom}px`);
    selection.select(".boundary")
        .attr('width', state.viewBox.right)
        .attr('height', state.viewBox.bottom);
  }


  function updateField(selection, state) {
    const tf = state.transform;
    selection.select('.field')
        .attr('transform', `translate(${tf.x}, ${tf.y}) scale(${tf.k})`);
  }


  function setViewCallbacks(selection, state) {
    state.register("updateViewBox", () => {
      selection.call(updateViewBox, state);
    });
    state.register("updateField", () => {
      selection.call(updateField, state);
    });
    state.register("updateVisibility", () => {
      selection.call(updateComponents, state);
    });
    state.register("updateNodeAttr", () => {
      selection.select(".node-layer").call(updateNodeAttrs, state);
    });
    state.register("updateEdgeAttr", () => {
      selection.select(".edge-layer").call(updateEdgeAttrs, state);
    });
    state.register("updateCoords", () => {
      selection.selectAll(".node").call(updateNodeCoords);
      selection.selectAll(".link").call(updateEdgeCoords);
    });
  }


  var component = {
    updateNodes, updateEdges, updateNodeCoords, updateEdgeCoords,
    updateNodeAttrs, updateEdgeAttrs, updateNodeSelection,
    updateComponents, viewComponent, updateViewBox, updateField, setViewCallbacks
  };

  function dragListener(selection, state) {
    return d3.drag()
      .on('start', () => {
        state.setStateChanged(true);
      })
      .on('drag', event => {
        if (event.subject.__selected) {
          // multi selected node
          selection.selectAll(".node")
            .filter(d => d.__selected)
            .each(d => {
              d.x += event.dx;
              d.y += event.dy;
            });
          selection.selectAll(".node")
            .filter(d => d.__selected)
            .call(component.updateNodeCoords);
          selection.selectAll(".link")
            .filter(d => d.source.__selected || d.target.__selected)
            .call(component.updateEdgeCoords);
        } else {
          // single node
          event.subject.x = event.x;
          event.subject.y = event.y;
          const n = event.subject.__index;
          d3.selectAll(".node")
            .filter(d => d.__index == n)
            .call(component.updateNodeCoords);
          selection.selectAll(".link")
            .filter(d => d.source.__index == n || d.target.__index == n)
            .call(component.updateEdgeCoords);
        }
      });
  }


  function zoomListener(selection, state) {
    selection
      .on("dblclick.zoom", null)  // disable double-click zoom
      .on('.drag', null);  // disable rectSelect
    return d3.zoom()
      .on('start', () => {
        state.setStateChanged(true);
      })
      .on('zoom', event => {
        const t = event.transform;
        // direct DOM update
        selection.select('.field')
            .attr('transform', `translate(${t.x}, ${t.y}) scale(${t.k})`);
        // Smooth transition (continuously update components on zoom out)
        // temporary disabled due to performance reason
        /*
        if (!state.showNodeImage) {
          const xMoved = t.x > p.x + 20 || t.x < p.x - 20;
          const yMoved = t.y > p.y + 20 || t.y < p.y - 20;
          const zoomIn = t.k > p.k;
          if (xMoved || yMoved && !zoomIn) {
            state.setTransform(t.x, t.y, t.k);
            p.x = t.x;
            p.y = t.y;
            p.k = t.k;
          }
        }
        */
      })
      .on('end', event => {
        const t = event.transform;
        state.setTransform(t.x, t.y, t.k);
        t.x;
        t.y;
        t.k;
      });
  }


  function rectSelectListener(selection, state) {
    selection.on('.zoom', null);  // disable zoom
    const rect = selection.select('.interactions .rect-select');
    const origin = {x: 0, y: 0};
    const p = new Set();  // previous selection
    selection.selectAll('.node')
      .each(d => {
        if (d.__selected) { p.add(d.__index); }
      });
    return d3.drag()
      .on('start', event => {
        state.setStateChanged(true);
        origin.x = event.x;
        origin.y = event.y;
        rect.attr('visibility', 'visible')
            .attr('x', origin.x).attr('y', origin.y);
      })
      .on('drag', event => {
        const left = Math.min(origin.x, event.x);
        const width = Math.abs(origin.x - event.x);
        const top = Math.min(origin.y, event.y);
        const height = Math.abs(origin.y - event.y);
        rect.attr('x', left).attr('y', top)
          .attr('width', width).attr('height', height);
        const tf = state.transform;
        const xConv = x => (x - tf.x) / tf.k;
        const yConv = y => (y - tf.y) / tf.k;
        const l = xConv(left);
        const t = yConv(top);
        const r = xConv(left + width);
        const b = yConv(top + height);
        selection.selectAll('.node')
          .each(function(d) {
            const inside = d.x > l && d.y > t && d.x < r && d.y < b;
            state.nodes[d.__index].__selected = p.has(d.__index) !== inside;
          });
        selection.selectAll(".node")
          .call(component.updateNodeSelection);
      })
      .on('end', function () {
        p.clear();
        selection.selectAll('.node')
          .each(d => {
            if (d.__selected) { p.add(d.__index); }
          });
        rect.attr('visibility', 'hidden')
            .attr('width', 0).attr('height', 0);
      });
  }


  function selectListener(selection, state) {
    return node => {
      node.on('touchstart', event => { event.preventDefault(); })
          .on('touchmove', event => { event.preventDefault(); })
          .on('click.select', event => {
            event.stopPropagation();
            state.nodes.forEach((e, i) => {
              state.nodes[i].__selected = false;
            });
            const n = d3.select(event.currentTarget).datum().__index;
            state.nodes[n].__selected = true;
            selection.selectAll(".node")
              .call(component.updateNodeSelection);
          });
    };
  }


  function multiSelectListener(selection, state) {
    return node => {
      node.on('touchstart', event => { event.preventDefault(); })
          .on('touchmove', event => { event.preventDefault(); })
          .on('click.select', event => {
            event.stopPropagation();
            const n = d3.select(event.currentTarget).datum().__index;
            state.nodes[n].__selected = state.nodes[n].__selected ? false : true;
            selection.selectAll(".node")
              .call(component.updateNodeSelection);
          });
    };
  }


  function interactionComponent(selection) {
    // Rectangle selection layer
    selection.append('g')
        .classed('interactions', true)
      .append('rect')
        .classed('rect-select', true)
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5')
        .attr('visibility', 'hidden');
  }


  function setInteraction(selection, state) {
    // Background click to clear selection
    selection
        .on('touchstart', event => { event.preventDefault(); })
        .on('touchmove', event => { event.preventDefault(); })
        .on('click', event => {
          state.nodes.forEach((e, i) => {
            state.nodes[i].__selected = false;
          });
          selection.selectAll(".node")
            .call(component.updateNodeSelection);
        });

    // Enter multiple select mode
    document.addEventListener('keydown', event => {
      if (event.key !== 'Shift') return;
      selection.style("cursor", "crosshair");
      state.zoomListener = rectSelectListener(selection, state);
      state.selectListener = multiSelectListener(selection, state);
      selection.call(state.zoomListener);
      selection.selectAll('.node').call(state.selectListener);
    });

    // Exit multiple select mode
    document.addEventListener('keyup', event => {
      if (event.key !== 'Shift') return;
      selection.style("cursor", "auto");
      state.zoomListener = zoomListener(selection, state);
      state.selectListener = selectListener(selection, state);
      selection.call(state.zoomListener);
      selection.selectAll('.node').call(state.selectListener);
    });

    // Event listeners
    state.zoomListener = zoomListener(selection, state);
    state.selectListener = selectListener(selection, state);
    state.dragListener = dragListener(selection, state);

    state.register("updateZoom", () => {
      const tf = state.transform;
      selection.call(
        d3.zoom().transform,
        d3.zoomIdentity.translate(tf.x, tf.y).scale(tf.k)
      );
    });
    // Update interaction events
    state.register("updateNodeInteraction", () => {
      selection.call(state.zoomListener);
      selection.selectAll('.node').call(state.selectListener);
      selection.selectAll('.node').call(state.dragListener);
    });
  }


  var interaction = {
    dragListener, zoomListener, interactionComponent, setInteraction
  };

  const forceParam = {
    dense: {
      name: 'Dense',
      force: d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.__index).distance(60).strength(1))
        .force('charge',
          d3.forceManyBody().strength(-600).distanceMin(15).distanceMax(720))
        .force('collide', d3.forceCollide().radius(90))
        .force('x', d3.forceX().strength(0.002))
        .force('y', d3.forceY().strength(0.002))
    },
    moderate: {
      name: 'Moderate',
      force: d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.__index).distance(60).strength(1.3))
        .force('charge',
          d3.forceManyBody().strength(-2000).distanceMin(15).distanceMax(1200))
        .force('collide', d3.forceCollide().radius(90))
        .force('x', d3.forceX().strength(0.005))
        .force('y', d3.forceY().strength(0.005))
    },
    sparse: {
      name: 'Sparse',
      force: d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.__index).distance(60).strength(2))
        .force('charge',
          d3.forceManyBody().strength(-6000).distanceMin(15).distanceMax(3600))
        .force('collide', d3.forceCollide().radius(90))
        .force('x', d3.forceX().strength(0.01))
        .force('y', d3.forceY().strength(0.01))
    }
  };


  function forceSimulation(type, width, height) {
    return forceParam[type].force
      .force('center', d3.forceCenter(width / 2, height / 2))
      .stop();
  }


  function forceDragListener(selection, simulation, state) {
    return d3.drag()
      .on('start', event => {
        state.setStateChanged(true);
        if (!event.active) state.dispatch("relax");
      })
      .on('drag', event => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on('end', event => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      });
  }


  function stick(selection, simulation, state) {
    simulation.alpha(0).stop();
    selection.selectAll('.node')
      .each(d => {
        d.fx = d.x;
        d.fy = d.y;
      });
    // TODO: switch listeners by State method
    state.dragListener = interaction.dragListener(selection, state);
    state.forceActive = false;
  }


  function unstick(selection, simulation, state) {
    selection.selectAll('.node')
      .each(d => {
        d.fx = null;
        d.fy = null;
      });
    state.dragListener = forceDragListener(selection, simulation, state);
    state.forceActive = true;
  }


  function setForce(selection, state) {
    state.register("setForce", () => {
      const simulation = forceSimulation(
          state.config.forceParam, state.fieldWidth, state.fieldHeight);
      simulation.nodes(state.fnodes)
        .force('link').links(state.fedges);
      simulation
        .on('tick', () => {
          state.tickCallback(simulation);
        })
        .on('end', () => {
          state.tickCallback(simulation);
          state.updateVisibility();
        });

      state.register("stick", () => {
        selection.call(stick, simulation, state);
        state.updateVisibility();
      });
      state.register("relax", () => {
        selection.call(unstick, simulation, state);
        simulation.alpha(0.1).restart();
      });
      state.register("restart", () => {
        selection.call(unstick, simulation, state);
        simulation.alpha(1).restart();
      });
      state.register("resetCoords", () => {
        selection.selectAll('.node')
          .each(d => {
            delete d.x;
            delete d.y;
            delete d.vx;
            delete d.vy;
            delete d.fx;
            delete d.fy;
          });
        simulation.nodes(state.fnodes).alpha(1).restart();
      });
    });
  }


  var force = {
    forceParam, forceSimulation, setForce
  };

  function LayoutControlBox(selection) {
    // Fit
    selection.append('div')
        .classed('mb-0', true)
        .classed('fit', true)
        .call(button.buttonBox, 'Fit to screen', 'outline-primary');
    // Stick
    selection.append('div')
        .classed('mb-3', true)
        .classed('stick', true)
        .call(box.checkBox, 'Stick nodes');

    // Force control
    selection.append('div')
        .classed('forceparam', true)
        .classed('mb-1', true)
        .classed('align-items-center', true)
        .call(lbox.selectBox, 'Force parameter')
        .call(lbox.updateSelectBoxOptions, Object.keys(force.forceParam));
    const forceBox = selection.append('div')
        .classed('mb-3', true);
    forceBox.append('label')
        .classed('form-label', true)
        .classed('mb-0', true)
        .text('Temperature');
    forceBox.append('div')
        .classed('temperature', true)
        .classed('progress', true)
        .classed('mb-2', true)
      .append('div')
        .classed('progress-bar', true)
        .classed('w-30', true)
        .attr('id', 'temperature')
        .attr('role', 'progressbar')
        .attr('aria-valuemin', 0)
        .attr('aria-valuemax', 100);
    const activateButtons = forceBox.append('div')
        .classed('row', true);
    activateButtons.append('div')
        .classed('perturb', true)
        .classed('col-4', true)
        .call(button.buttonBox, 'Perturb', 'outline-success');
    activateButtons.append('div')
        .classed('reset', true)
        .classed('col-8', true)
        .call(button.buttonBox, 'Reset coords', 'outline-warning');
  }

  function updateLayoutControl(selection, state) {
    // Fit
    selection.select('.fit')
        .on('click', function () {
          state.fitTransform();
        });
    // Force layout
    state.updateForceIndicatorCallback = (simulation) => {
      const alpha = simulation.alpha();
      const isStopped = alpha <= simulation.alphaMin();
      const progress = parseInt(isStopped ? 0 : alpha * 100);
      selection.select('.temperature')
        .select('.progress-bar')
          .classed('bg-success', isStopped)
          .classed('bg-warning', !isStopped)
          .style('width', `${progress}%`)
          .attr('aria-valuenow', progress);
    };
    selection.select('.stick')
        .call(box.updateCheckBox, !state.forceActive)
        .on('change', event => {
          const value = box.checkBoxValue(d3.select(event.currentTarget));
          selection.select('.temperature')
              .style('background-color', value ? '#a3e4d7' : '#e9ecef')
            .select('.progress-bar')
              .style('width', `0%`)
              .attr('aria-valuenow', 0);
          value ? state.dispatch("stick") : state.dispatch("relax");
        });
    selection.select('.forceparam')
        .call(lbox.updateSelectBoxValue, state.config.forceParam)
        .on('change', event => {
          state.config.forceParam = lbox.selectBoxValue(d3.select(event.currentTarget));
          state.updateFilter();
        });
    selection.select('.perturb')
        .on('click', function () {
          selection.select('.stick')
              .call(box.updateCheckBox, false)
              .dispatch('change');
          state.dispatch("restart");
        });
    selection.select('.reset')
        .on('click', function () {
          selection.select('.stick')
              .call(box.updateCheckBox, false)
              .dispatch('change');
          state.dispatch("resetCoords");
        });
  }




  function FilterControlBox(selection) {
    // buttons
    selection.append('div')
        .classed('new', true)
        .call(button.buttonBox, '+ New filter', 'outline-primary')
        .select("button")
        .classed('mb-2', true);
    // filters
    selection.append('div')
        .classed('filter-container', true);
  }

  function updateFilterControl(selection, state) {
    selection.select('.new')
        .on('click', () => {
          state.filters.push({
            field: state.numericFields[0],
            operator: ">",
            value: 0,
            groups: []
          });
          state.updateFilter();
        });
    const container = selection.select(".filter-container");
    container.selectAll('.filter').remove();
    if (state.filters.length === 0) { return; }
    container.selectAll('.filter')
      .data(state.filters).enter()
      .append("div")
        .classed("filter", true)
      .each((d, i, nodes) => {
        d3.select(nodes[i])
          .call(filterComponent, d, i, state)
          .on('change', event => {
            state.filters[i] = filterValue(d3.select(event.currentTarget));
            state.updateFilter();
          })
          .on('remove', async event => {
            const ok = await modal.showConfirmDialog(
              'Are you sure you want to delete the filter?');
            if (ok) {
              state.filters.splice(i, 1);
              state.updateFilter();
            }
          });
        });
  }


  function filterComponent(selection, d, i, state) {
    selection
        .classed("card", true)
        .classed("mb-2", true);
    const header = selection.append("div")
        .classed("card-header", true)
        .classed("d-flex", true)
        .classed("py-1", true)
        .text(d.name || `Filter ${i + 1}`);
    header.append("button")
        .classed("btn-close", true)
        .classed("ms-auto", true)
        .classed("remove", true)
        .attr("type", "button")
        .attr('aria-label', 'Close')
        .on('click', event => {
          selection.dispatch('remove');
        });
    const body = selection.append("div")
        .classed("card-body", true)
        .classed("p-2", true);
    // field
    body.append("div")
        .classed("field", true)
        .classed("mb-1", true)
        .call(lbox.selectBox, "Field")
        .call(lbox.updateSelectBoxOptions, state.numericFields.concat(state.categoricalFields))
        .call(lbox.updateSelectBoxValue, d.field);
    // numeric: condition and value
    body.append("div")
        .classed("operator", true)
        .classed("mb-1", true)
        .classed("d-none", !state.numericFields.includes(d.field))
        .call(lbox.selectBox, "Operator")
        .call(lbox.updateSelectBoxOptions, [">", ">=", "<", "<=", "==", "!="])
        .call(lbox.updateSelectBoxValue, d.operator);
    body.append("div")
        .classed("value", true)
        .classed("mb-1", true)
        .classed("d-none", !state.numericFields.includes(d.field))
        .attr('required', 'required')
        .call(box.numberBox, "Value")
        .call(box.updateNumberRange, null, null, "any")
        .call(badge$1.updateInvalidMessage, 'Please provide a valid number')
        .call(box.updateFormValue, d.value)
      .select('.form-control')
        .attr('required', 'required');
    // categorical: checklistBox (top 20)
    body.append("div")
        .classed("selected", true)
        .classed("mb-1", true)
        .classed("mx-0", true)
        .classed("d-none", !state.categoricalFields.includes(d.field))
        .call(lbox.checklistBox, "Groups")
        .call(lbox.updateChecklistItems, misc.rank(state.nodes.map(e => e[d.field])).map(e => e[0]))
        .call(lbox.updateChecklistValues, d.groups);
  }


  function filterValue(selection) {
    return {
      field: lbox.selectBoxValue(selection.select(".field")),
      operator: lbox.selectBoxValue(selection.select(".operator")),
      value: box.formValue(selection.select(".value")),
      groups: lbox.checklistValues(selection.select(".groups"))
    }
  }



  function NodeControlBox(selection) {
    // Node color
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Node color");
    // Color field
    selection.append('div')
        .classed('colorfield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // Color range preset
    selection.append('div')
        .classed('colorrange', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.colorScaleBox, 'Range');
    // Color domain
    selection.append('div')
        .classed('colordomain', true)
        .classed('mb-3', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.domainBox, 'Domain')
        .call(badge$1.updateInvalidMessage, 'Please provide valid numbers');

    // Node size
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Node size");
    // Size field
    selection.append('div')
        .classed('sizefield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // Size range preset
    selection.append('div')
        .classed('sizerange', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Range');
    // Size domain
    selection.append('div')
        .classed('sizedomain', true)
        .classed('mb-3', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.domainBox, 'Domain')
        .call(badge$1.updateInvalidMessage, 'Please provide valid numbers');

    // Node label
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Node label");
    // Label visibility
    selection.append('div')
        .classed('labelvisible', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.checkBox, 'Show labels');
    // Label field
    selection.append('div')
        .classed('labelfield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // Label font size
    selection.append('div')
        .classed('labelsize', true)
        .classed('mb-3', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.numberBox, 'Font size')
        .call(box.updateNumberRange, 0.1, 999, 0.1)
        .call(badge$1.updateInvalidMessage,
              'Please provide a valid number (0.1-999)');
    // Node image
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Node image");
    // image field
    selection.append('div')
        .classed('imagefield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // always show image
    selection.append('div')
        .classed('shownodeimage', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.checkBox, 'Always show images');
  }

  function updateNodeControl(selection, state) {
    const nfields = state.numericFields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
    const cfields = state.categoricalFields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
    const qfields = nfields.concat(cfields);
    const ifields = state.imageFields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
    const fields = state.fields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
    const lfields = fields.filter(e => !ifields.includes(e));

    const color = state.appearance.nodeColor;
    const hasColorField = color.field !== null;
    const hasColorDomain = hasColorField && color.domain !== null;
    const colorRange = color.range === null ? scale.colorScales.find(e => e.name == color.rangePreset)
      : {name: "default", range: color.range};
    selection.select('.colorfield')
        .call(lbox.updateSelectBoxOptions, qfields, undefined, undefined, !hasColorField)
        .call(lbox.updateSelectBoxValue, color.field)
        .on('change', event => {
          const v = lbox.selectBoxValue(d3.select(event.currentTarget));
          if (color.domain === null) {  // set infered domain
            state.appearance.nodeColor.domain = state.defaultDomain[`node.${v}`];
          }
          state.setAppearance("nodeColor", "field", v);
        });
    selection.select('.colorrange')
        .call(lbox.updateColorScaleItems,
          scale.colorScales.filter(e => e.type == (hasColorDomain ? "continuous" : "discrete")))
        .call(lbox.updateColorScaleBox, colorRange)
        .on('change', event => {
          state.appearance.nodeColor.range = null;  // remove default range
          state.setAppearance(
            "nodeColor", "rangePreset", lbox.colorScaleBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.colorrange button')
        .property("disabled", !hasColorField);
    selection.select('.colordomain')
        .call(box.updateDomainValues, color.domain)
        .on('change', event => {
          state.setAppearance(
            "nodeColor", "domain", box.domainValues(d3.select(event.currentTarget)));
        });
    selection.select('.colordomain').selectAll('.min,.max')
        .attr('required', hasColorDomain ? 'required' : null)
        .property("disabled", !hasColorDomain);

    const size = state.appearance.nodeSize;
    const hasSizeField = size.field !== null;
    const hasSizeDomain = hasSizeField && size.domain !== null;
    const sizeRange = size.range === null ? size.rangePreset : "";
    selection.select('.sizefield')
        .call(lbox.updateSelectBoxOptions, nfields, undefined, undefined, !hasSizeField)
        .call(lbox.updateSelectBoxValue, size.field)
        .on('change', event => {
          const v = lbox.selectBoxValue(d3.select(event.currentTarget));
          if (size.domain === null) {  // set infered domain
            state.appearance.nodeSize.domain = state.defaultDomain[`node.${v}`];
          }
          state.setAppearance("nodeSize", "field", v);
        });
    selection.select('.sizerange')
        .call(lbox.updateSelectBoxOptions, scale.nodeSizeScales, d => d.name, d => d.name)
        .call(lbox.updateSelectBoxValue, sizeRange)
        .on('change', event => {
          state.appearance.nodeSize.range = null;  // remove default range
          state.setAppearance(
            "nodeSize", "rangePreset", lbox.selectBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.sizerange select')
        .attr("disabled", hasSizeDomain ? null : "disabled");
    selection.select('.sizedomain')
        .call(box.updateDomainValues, size.domain)
        .on('change', event => {
          state.setAppearance(
            "nodeSize", "domain", box.domainValues(d3.select(event.currentTarget)));
        });
    selection.select('.sizedomain').selectAll('.min,.max')
        .attr('required', hasSizeDomain ? 'required' : null)
        .property("disabled", !hasSizeDomain);

    const label = state.appearance.nodeLabel;
    selection.select('.labelvisible')
        .call(box.updateCheckBox, label.visible)
        .on('change', event => {
          state.setAppearance(
            "nodeLabel", "visible", box.checkBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.labelfield')
        .call(lbox.updateSelectBoxOptions, lfields, undefined, undefined, !label.hasOwnProperty("field"))
        .call(lbox.updateSelectBoxValue, label.field)
        .on('change', event => {
          state.setAppearance(
            "nodeLabel", "field", lbox.selectBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.labelsize')
        .call(box.updateFormValue, label.size)
        .on('change', event => {
          state.setAppearance(
            "nodeLabel", "size", box.formValue(d3.select(event.currentTarget)));
        });

    const image = state.appearance.nodeImage;
    selection.select('.imagefield')
        .call(lbox.updateSelectBoxOptions, ifields, undefined, undefined, !image.hasOwnProperty("field"))
        .call(lbox.updateSelectBoxValue, image.field)
        .on('change', event => {
          state.setAppearance(
            "nodeImage", "field", lbox.selectBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.shownodeimage')
        .call(box.updateCheckBox, state.config.alwaysShowNodeImage)
        .on('change', event => {
          state.config.alwaysShowNodeImage = box.checkBoxValue(d3.select(event.currentTarget));
          state.updateVisibility();
        });
  }

  function EdgeControlBox(selection) {
    // Edge color
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Edge color");
    // Color field
    selection.append('div')
        .classed('colorfield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // Color range preset
    selection.append('div')
        .classed('colorrange', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.colorScaleBox, 'Range');
    // Color scale type
    selection.append('div')
        .classed('colordomain', true)
        .classed('mb-3', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.domainBox, 'Domain');

    // Edge width
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Edge width");
    // Width field
    selection.append('div')
        .classed('widthfield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // Width range preset
    selection.append('div')
        .classed('widthrange', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Range');
    // Width scale type
    selection.append('div')
        .classed('widthdomain', true)
        .classed('mb-3', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.domainBox, 'Domain');

    // Edge label
    selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Edge label");
    // Label visibility
    selection.append('div')
        .classed('labelvisible', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.checkBox, 'Show labels');
    // Label field
    selection.append('div')
        .classed('labelfield', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(lbox.selectBox, 'Field');
    // Label font size
    selection.append('div')
        .classed('labelsize', true)
        .classed('mb-3', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.numberBox, 'Font size')
        .call(box.updateNumberRange, 0.1, 999, 0.1)
        .call(badge$1.updateInvalidMessage,
              'Please provide a valid number (0.1-999)');

    // Other settings
    selection.append('div')
        .classed('mb-1', true)
        .classed('small', true)
        .text("Settings");
    selection.append('div')
        .classed('showedge', true)
        .classed('mb-1', true)
        .classed('ms-3', true)
        .classed('gx-0', true)
        .call(box.checkBox, 'Always show edges');
  }

  function updateEdgeControl(selection, state) {
    const nfields = state.numericFields.filter(e => e.startsWith("edge.")).map(e => e.substring(5));
    const cfields = state.categoricalFields.filter(e => e.startsWith("edge.")).map(e => e.substring(5));
    const qfields = nfields.concat(cfields);
    const fields = state.fields.filter(e => e.startsWith("edge.")).map(e => e.substring(5));
    const lfields = fields.filter(e => !["source", "target"].includes(e));

    const color = state.appearance.edgeColor;
    const hasColorField = color.field !== null;
    const hasColorDomain = hasColorField && color.domain !== null;
    const colorRange = color.range === null ? scale.colorScales.find(e => e.name == color.rangePreset)
      : {name: "default", range: color.range};
    selection.select('.colorfield')
        .call(lbox.updateSelectBoxOptions, qfields, undefined, undefined, !hasColorField)
        .call(lbox.updateSelectBoxValue, color.field)
        .on('change', event => {
          const v = lbox.selectBoxValue(d3.select(event.currentTarget));
          if (color.domain === null) {  // set infered domain
            state.appearance.edgeColor.domain = state.defaultDomain[`edge.${v}`];
          }
          state.setAppearance("edgeColor", "field", v);
        });
    selection.select('.colorrange')
        .call(lbox.updateColorScaleItems,
          scale.colorScales.filter(e => e.type === (hasColorDomain ? "continuous" : "discrete")))
        .call(lbox.updateColorScaleBox, colorRange)
        .on('change', event => {
          state.appearance.edgeColor.range = null;  // remove default range
          state.setAppearance(
            "edgeColor", "rangePreset", lbox.colorScaleBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.colorrange button')
        .property("disabled", !hasColorField);
    selection.select('.colordomain')
        .call(box.updateDomainValues, color.domain)
        .on('change', event => {
          state.setAppearance(
            "edgeColor", "domain", box.domainValues(d3.select(event.currentTarget)));
        });
    selection.select('.colordomain').selectAll('.min,.max')
        .attr('required', hasColorDomain ? 'required' : null)
        .property("disabled", !hasColorDomain);

    const width = state.appearance.edgeWidth;
    const hasWidthField = width.field !== null;
    const hasWidthDomain = hasWidthField && width.domain !== null;
    const widthRange = width.range === null ? width.rangePreset : "";
    selection.select('.widthfield')
        .call(lbox.updateSelectBoxOptions, nfields, undefined, undefined, !hasWidthField)
        .call(lbox.updateSelectBoxValue, width.field)
        .on('change', event => {
          const v = lbox.selectBoxValue(d3.select(event.currentTarget));
          if (width.domain === null) {  // set infered domain
            state.appearance.edgeWidth.domain = state.defaultDomain[`edge.${v}`];
          }
          state.setAppearance("edgeWidth", "field", v);
        });
    selection.select('.widthrange')
        .call(lbox.updateSelectBoxOptions, scale.edgeWidthScales, d => d.name, d => d.name)
        .call(lbox.updateSelectBoxValue, widthRange)
        .on('change', event => {
          state.appearance.edgeWidth.range = null;  // remove default range
          state.setAppearance(
            "edgeWidth", "rangePreset", lbox.selectBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.widthrange select')
        .attr("disabled", hasWidthDomain ? null : "disabled");
    selection.select('.widthdomain')
        .call(box.updateDomainValues, width.domain)
        .on('change', event => {
          state.setAppearance(
            "edgeWidth", "domain", box.domainValues(d3.select(event.currentTarget)));
        });
    selection.select('.widthdomain').selectAll('.min,.max')
        .attr('required', hasWidthDomain ? 'required' : null)
        .property("disabled", !hasWidthDomain);

    const label = state.appearance.edgeLabel;
    selection.select('.labelvisible')
        .call(box.updateCheckBox, label.visible)
        .on('change', event => {
          state.setAppearance(
            "edgeLabel", "visible", box.checkBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.labelfield')
        .call(lbox.updateSelectBoxOptions, lfields, undefined, undefined, !label.hasOwnProperty("field"))
        .call(lbox.updateSelectBoxValue, label.field)
        .on('change', event => {
          state.setAppearance(
            "edgeLabel", "field", lbox.selectBoxValue(d3.select(event.currentTarget)));
        });
    selection.select('.labelsize')
        .call(box.updateFormValue, label.size)
        .on('change', event => {
          state.setAppearance(
            "edgeLabel", "size", box.formValue(d3.select(event.currentTarget)));
        });

    selection.select('.showedge')
        .call(box.updateCheckBox, state.config.alwaysShowEdge)
        .on('change', event => {
          state.config.alwaysShowEdge = box.checkBoxValue(d3.select(event.currentTarget));
          state.updateVisibility();
        });
  }




  /*
  - statistics (filter applied)
    - node count
    - edge count
    - logD (edge density)
    - number of connected components
    - number of isolated nodes
    - average path length
    - clustering coefficient
    - node/edge numeric fields min, mean, median, max, IQR...
  */


  function StatisticsBox(selection) {
    selection
        .classed('small', true);
    // Components
    const nodecount = selection.append('div')
        .classed('row', true);
    nodecount.append('div')
        .classed('col-8', true)
        .text("Nodes(shown/total): ");
    nodecount.append('div')
        .classed('col-4', true)
        .classed("nodecount", true);
    const edgecount = selection.append('div')
        .classed('row', true);
    edgecount.append('div')
        .classed('col-8', true)
        .text("Edges(shown/total): ");
    edgecount.append('div')
        .classed('col-4', true)
        .classed("edgecount", true);
    const logd = selection.append('div')
        .classed('row', true);
    logd.append('div')
        .classed('col-8', true)
        .text("logD(shown/total): ");
    logd.append('div')
        .classed('col-4', true)
        .classed("logd", true);

    const qtitle = selection.append('div')
        .classed('row', true)
        .classed('mt-3', true);
    qtitle.append('div')
        .classed('col-12', true)
        .text("Data quantiles: ");
    const quantiles = selection.append('div')
        .classed('row', true);
    quantiles.append('div')
        .classed('col-12', true)
        .classed("quantiles", true);
  }


  function updateStatistics(selection, state) {
    // topology
    const ncnt = state.nodes.length;
    const ecnt = state.edges.length;
    const maxedges = ncnt * (ncnt - 1) / 2;
    const fncnt = state.fnodes.length;
    const fecnt = state.fedges.length;
    const fmaxedges = fncnt * (fncnt - 1) / 2;
    const logd = d3.format('.2f')(Math.log10(ecnt / maxedges));
    const flogd = d3.format('.2f')(Math.log10(fecnt / fmaxedges));
    selection.select('.nodecount')
        .text(`${fncnt}/${ncnt}`);
    selection.select('.edgecount')
        .text(`${fecnt}/${ecnt}`);
    selection.select('.logd')
        .text(`${flogd}/${logd}`);

    // field statistics
    const qs = state.numericFields.map(e => {
      return `${e}: ${JSON.stringify(scale.quantiles(
      e.startsWith("node.") ? state.nodes.map(n => n[e.substring(5)]) : state.edges.map(n => n[e.substring(5)])))}`;
    });
    
    const stats = selection.select('.quantiles')
        .selectAll('div')
        .data(qs, d => d);
    stats.exit().remove();
    stats.enter()
        .append('div')
        .merge(stats)
          .text(d => d);
  }


  function controlBoxNav(selection, id, label, active) {
    selection
        .classed('nav-item', true)
        .attr('role', 'presentation')
      .append("button")
        .classed('nav-link', true)
        .classed('active', active)
        .classed('py-1', true)
        .attr('id', `${id}-tab`)
        .attr('data-bs-toggle', 'tab')
        .attr('data-bs-target', `#${id}`)
        .attr('type', 'button')
        .attr('role', 'tab')
        .attr('aria-controls', id)
        .attr('aria-selected', active ? "true" : "false")
        .text(label);
  }


  function controlBoxItem(selection, id, active) {
    selection
        .classed('tab-pane', true)
        .classed('fade', true)
        .classed('px-0', true)
        .classed('show', active)
        .classed('active', active)
        .attr('id', id)
        .attr('role', 'tabpanel')
        .attr('aria-labelledby', `${id}-tab`);
  }



  function controlBox(selection) {
    const tabs = selection.append("ul")
        .classed("nav", true)
        .classed("nav-tabs", true)
        .attr("id", "control-tab")
        .attr("role", "tablist");
    const content = selection.append("div")
        .classed("tab-content", true)
        .classed('p-2', true)
        .attr("id", "control-tab-content")
        .style("overflow-y", "scroll");

    // Layout
    tabs.append('li')
        .call(controlBoxNav, 'control-layout', 'Layout', true);
    content.append('div')
        .call(controlBoxItem, 'control-layout', true)
        .call(LayoutControlBox);

    // Filter
    tabs.append('li')
        .call(controlBoxNav, 'control-filter', 'Filter', false);
    content.append('div')
        .call(controlBoxItem, 'control-filter', false)
        .call(FilterControlBox);

    // Node
    tabs.append('li')
        .call(controlBoxNav, 'control-node', 'Node', false);
    content.append('div')
        .call(controlBoxItem, 'control-node', false)
        .call(NodeControlBox);

    // Edge
    tabs.append('li')
        .call(controlBoxNav, 'control-edge', 'Edge', false);
    content.append('div')
        .call(controlBoxItem, 'control-edge', false)
        .call(EdgeControlBox);

    // Statistics
    tabs.append('li')
        .call(controlBoxNav, 'control-stat', 'Statistics', false);
    content.append('div')
        .call(controlBoxItem, 'control-stat', false)
        .call(StatisticsBox);
  }


  function updateControlBox(selection, state) {
    selection.select('#control-layout')
        .call(updateLayoutControl, state);
    selection.select('#control-filter')
        .call(updateFilterControl, state);
    selection.select('#control-node')
        .call(updateNodeControl, state);
    selection.select('#control-edge')
        .call(updateEdgeControl, state);
    selection.select('#control-stat')
        .call(updateStatistics, state);

    state.register("updateControlBox", () => {
      selection.call(updateControlBox, state);
    });
  }


  var control = {
    controlBox, updateControlBox
  };

  function sessionMenu(selection) {
    selection
        .classed('row', true)
        .classed('mb-1', true);
    // switch
    const selectbox = selection.append('div')
        .classed('switch', true)
        .classed('col-6', true)
        .call(lbox.selectBox, 'Session');
    selectbox.select("select")
        .attr('disabled', true);
    selectbox.select("label")
        .classed('col-4', false)
        .classed('col-3', true)
        .classed('text-end', true);
    selectbox.select("div")
        .classed('col-8', false)
        .classed('col-9', true);
    

    const menu = selection.append('div')
        .classed('col-6', true);
    // open new file
    menu.append('span')
        .classed('open', true)
      .append('a')
        .call(button.fileButton, 'New', '.json,.gz', 'menu-import')
        .on('change', async () => {
          // store json data
          // TODO: allow duplicate ID?
          const file = button.fileValue(menu);
          const json = await hfile.loadJSON(file);
          json.name = file.name.split(".")[0]; // use file basename as the session name
          json.id = await idb.putSession(json);  // issue session ID
          await idb.putConfig("currentSession", json.id);
          // establish state
          setState(json);
        });
    // export
    menu.append('span')
        .classed('export', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Export', 'menu-export');
    // delete
    menu.append('span')
        .classed('delete', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Delete', 'delete-gray');
    // delete all
    menu.append('span')
        .classed('deleteall', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Delete all', 'delete-gray');
  }


  async function updateSessionMenu(selection, state) {
    const currentID = await idb.getConfig("currentSession");
    const sessions = await idb.getSessionHeaders();
    // switch
    selection.select('.switch')
        .call(lbox.updateSelectBoxOptions, sessions, d => d.id, d => d.name)
        .call(lbox.updateSelectBoxValue, currentID)
        .on('change', async event => {
          const newID = lbox.selectBoxValue(d3.select(event.currentTarget));
          await idb.putConfig("currentSession", newID);
          const session = await idb.getSession(newID);
          // establish state
          setState(session);
        })
        .select("select")
          .attr('disabled', state.stateChanged ? true : null);
    // import
    selection.select('.open')
        .classed('d-none', state.stateChanged);
    // export
    selection.select('.export')
        .classed('d-none', state.stateChanged)
        .on('click', async () => {
          const session = await idb.getSession(currentID);
          hfile.downloadJSON(session, session.name);
        });
    // delete session
    selection.select('.delete')
        .classed('d-none', state.stateChanged)
        .on('click', async () => {
          const ok = await modal.showConfirmDialog(
            'Are you sure you want to delete the session?');
          if (ok) {
            const headers = await idb.getSessionHeaders();
            if (headers.length == 1) {
              await idb.clearAll();  // Clear all
            } else {
              await idb.deleteSession(state.sessionID);
              const deleted = await idb.getSessionHeaders();
              await idb.putConfig("currentSession", deleted.slice(-1)[0].id);
            }
            location.reload();
          }
        });
    // delete all
    selection.select('.deleteall')
        .classed('d-none', state.stateChanged)
        .on('click', async () => {
          const ok = await modal.showConfirmDialog(
            'Are you sure you want to delete all local tables and reset the datastore?');
          if (ok) {
            await idb.clearAll();
            location.reload();
          }
        });
  }



  function snapshotMenu(selection) {
    selection
        .classed('row', true)
        .classed('mb-1', true);
    // switch
    const selectbox = selection.append('div')
        .classed('switch', true)
        .classed('col-6', true)
        .call(lbox.selectBox, 'Snapshot');
    selectbox.select("select")
        .attr('disabled', true);
    selectbox.select("label")
        .classed('col-4', false)
        .classed('col-3', true)
        .classed('text-end', true);
    selectbox.select("div")
        .classed('col-8', false)
        .classed('col-9', true);

    const menu = selection.append('div')
        .classed('col-6', true);
    // save
    menu.append('span')
        .classed('save', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Save', 'menu-save');
    // discard
    menu.append('span')
        .classed('discard', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Discard', 'delete-gray');
    // rename
    menu.append('span')
        .classed('rename', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Rename', 'menu-edittext');
    // delete
    menu.append('span')
        .classed('delete', true)
        .classed('d-none', true)
        .call(button.menuIcon, 'Delete', 'delete-gray');
  }


  function updateSnapshotMenu(selection, state) {
    // switch
    selection.select('.switch')
        .call(lbox.updateSelectBoxOptions, state.snapshots, (d, i) => i, d => d.name)
        .call(lbox.updateSelectBoxValue, state.snapshotIndex)
        .on('change', event => {
          const i = lbox.selectBoxValueIndex(d3.select(event.currentTarget));
          state.updateSnapshot(i);
        })
      .select("select")
        .attr('disabled', state.stateChanged ? true : null);
    // Save snapshot
    selection.select('.save')
        .classed('d-none', !state.stateChanged)
        .on('click', async () => {
          state.dispatch("stick");
          const snapshot = state.getSnapshot();
          await idb.appendSnapshot(state.sessionID, snapshot);
          state.snapshots.push(snapshot);
          state.updateSnapshot(state.snapshots.length - 1);
        });
    // discard change
    selection.select('.discard')
        .classed('d-none', !state.stateChanged || state.snapshots.length == 0)
        .on('click', async () => {
          const ok = await modal.showConfirmDialog(
            'Are you sure you want to discard changes?');
          if (ok) {
            state.updateSnapshot(state.snapshotIndex);
          }
        });
    // rename
    selection.select('.rename')
        .classed('d-none', state.stateChanged)
        .on('click', async () => {
          const newName = await modal.showRenameDialog(state.name);
          if (newName) {
            await idb.renameSnapshot(state.sessionID, state.snapshotIndex, newName);
            state.snapshots[state.snapshotIndex].name = newName;
            state.name = newName;
            state.dispatch("updateHeader");
          }
        });
    // delete
    selection.select('.delete')
        .classed('d-none', state.stateChanged)
        .on('click', async () => {
          const ok = await modal.showConfirmDialog(
            'Are you sure you want to delete the snapshot?');
          if (ok) {
            await idb.deleteSnapshot(state.sessionID, state.snapshotIndex);
            location.reload();
          }
        });
  }


  function headerMenu(selection) {
    selection
        .classed("my-1", true);
    selection.append("div")
        .attr("id", 'header-session')
        .call(sessionMenu);
    selection.append("div")
        .attr("id", 'header-snapshot')
        .call(snapshotMenu);
  }


  function updateHeaderMenu(selection, state) {
    selection.select("#header-session")
        .call(updateSessionMenu, state);
    selection.select("#header-snapshot")
        .call(updateSnapshotMenu, state);

    state.register("updateHeader", () => {
      selection.call(updateHeaderMenu, state);
    });
  }


  function setState(data) {
    // set view frame size (depends on browser)
    function setFrameSize() {
      const width = d3.select(".container-fluid").property("offsetWidth");
      const height = d3.select(".container-fluid").property("offsetHeight");
      const headerH = d3.select("#header").property("offsetHeight");
      const tabH = d3.select("#control-tab").property("offsetHeight");
      const controlW = d3.select("#control").property("offsetWidth");
      d3.select("#workspace").style("height", `${height - headerH - 15}px`);
      d3.select(".tab-content").style("max-height", `${height - headerH - tabH - 25}px`);
      return [width - controlW - 15, height - headerH - 15]
    }

    const fsize = setFrameSize();
    const state = new NetworkState(data, fsize[0], fsize[1]);

    // Title
    d3.select('title').text(state.sessionName);

    // Update contents
    d3.select('#header')
        .call(updateHeaderMenu, state);
    d3.select("#view")
        .call(component.setViewCallbacks, state)
        .call(force.setForce, state)
        .call(interaction.setInteraction, state);
    d3.select('#control')
        .call(control.updateControlBox, state);

    // Resize window
    window.onresize = () => {
      const fsize = setFrameSize();
      state.setViewBox(fsize[0], fsize[1]);
    };

    // Update all
    state.register("updateSnapshot", () => {
      state.dispatch("updateViewBox");
      state.updateFilter();
      state.dispatch("updateControlBox");
      if (state.snapshots.length === 0) {
        state.dispatch("restart");
        state.setStateChanged(true);
      } else {
        state.setStateChanged(false);
      }
    });

    // dispatch
    state.updateSnapshot(state.snapshotIndex);
  }


  async function run() {
    // Check web browser compatibility
    const err = misc.compatibility();
    if (err) {
      d3.select('body')
        .style('color', '#ff0000')
        .text(err);
      return;
    }

    // Render contents
    d3.select('#header').call(headerMenu);
    d3.select('#frame')
      .append('svg')
        .attr("id", "view")
        .call(component.viewComponent)
        .call(interaction.interactionComponent);
    d3.select('#control')
        .call(control.controlBox);

    const dialogs = d3.select('#dialogs');
    dialogs.append('div')
        .attr("id", "renamed")
        .call(modal.renameDialog);
    dialogs.append('div')
        .attr("id", "confirmd")
        .call(modal.confirmDialog);

    const sessionid = await idb.getConfig("currentSession");
    if (!sessionid) { return; } // start from new session

    // open session
    const session = await idb.getSession(sessionid);
    setState(session);
  }


  var app = {
    run
  };

  return app;

})(d3, pako);
