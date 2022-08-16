var app = (function (d3, _, pako) {
  'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
      Object.keys(e).forEach(function (k) {
        if (k !== 'default') {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function () { return e[k]; }
          });
        }
      });
    }
    n["default"] = e;
    return Object.freeze(n);
  }

  var d3__default = /*#__PURE__*/_interopDefaultLegacy(d3);
  var d3__namespace = /*#__PURE__*/_interopNamespace(d3);
  var ___default = /*#__PURE__*/_interopDefaultLegacy(_);
  var pako__default = /*#__PURE__*/_interopDefaultLegacy(pako);

  function URLQuery() {
    const pairs = window.location.search.substring(1).split("&")
      .map(e => e.split('='));
    return ___default["default"].fromPairs(pairs);
  }


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


  function registerCtrlCommand(key, callback) {
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.key === key) {
        callback();
      }
    });
  }


  var client = {
    URLQuery, compatibility, registerCtrlCommand
  };

  // TODO: re-define
  function sortType(fmt) {
    if (['numeric', 'd3_format'].includes(fmt)) return 'numeric';
    if (['text', 'compound_id', 'assay_id', 'list'].includes(fmt)) return 'text';
    if (['text_field', 'checkbox', 'html'].includes(fmt)) return 'html';
    return 'none';
  }


  /**
   * Format number
   * @param {object} value - value
   * @param {string} type - si | scientific | rounded | raw
   */
  function formatNum(value, d3format) {
    if (value === undefined || value === null || Number.isNaN(value)) return '';
    return value == parseFloat(value) ? d3__default["default"].format(d3format)(value) : value;
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


  var misc = {
    sortType, formatNum, partialMatch, uuidv4
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
    const tr = db.transaction(db.name, 'readwrite').objectStore(db.name);
    return new Promise((resolve, reject) => {
      const req = tr.clear();
        req.onsuccess = () => resolve();
        req.onerror = event => reject(event);
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
    const tr = db.transaction(db.name).objectStore(db.name);
    return new Promise((resolve, reject) => {
      const req = tr.get(key);
      req.onsuccess = event => resolve(event.target.result && event.target.result.value);
      req.onerror = event => reject(event);
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
    const tr = db.transaction(db.name, 'readwrite').objectStore(db.name);
    return new Promise((resolve, reject) => {
      const req = tr.put({key: key, value: value});
      req.onsuccess = () => resolve();
      req.onerror = event => reject(event);
    });
  }


  /**
   * Returns all sessions
   * @return {Promise} Promise of list of sessions
   */
   async function getSessionHeaders() {
    const db = await instance.session;
    const tr = db.transaction(db.name).objectStore(db.name);
    return new Promise(resolve => {
      const res = [];
      tr.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) {
          const rcd = {
            id: cursor.value.id,
            name: cursor.value.name
          };
          res.push(rcd);
          cursor.continue();
        } else {
          resolve(res);
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
    const tr = db.transaction(db.name).objectStore(db.name);
    return new Promise((resolve, reject) => {
      const req = tr.get(id);
      req.onsuccess = event => resolve(event.target.result);
      req.onerror = event => reject(event);
    });
  }


  /**
   * Put data object in the store
   * @param {*} data - data to store
   * @return {Promise<string>} session ID
   */
  async function putSession(data) {
    const db = await instance.session;
    const tr = db.transaction(db.name, 'readwrite').objectStore(db.name);
    if (!data.hasOwnProperty("id")) {
      data.id = misc.uuidv4();  // new ID
    }
    return new Promise((resolve, reject) => {
      const req = tr.put(data);
      req.onsuccess = () => resolve(data.id);
      req.onerror = event => reject(event);
    });
  }


  /**
   * Delete a session
   * @param {string} id - session ID
   * @return {Promise} resolve with nothing
   */
  async function deleteSession(id) {
    const db = await instance.session;
    const tr = db.transaction(db.name, 'readwrite').objectStore(db.name);
    return new Promise((resolve, reject) => {
      const req = tr.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = event => reject(event);
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
    const tr = db.transaction(db.name).objectStore(db.name);
    const data = await new Promise((resolve, reject) => {
      const req = tr.get(sessionid);
      req.onsuccess = event => resolve(event.target.result);
      req.onerror = event => reject(event);
    });
    data.snapshot.push(snapshot);
    return new Promise((resolve, reject) => {
      const req = tr.put(data);
      req.onsuccess = () => resolve();
      req.onerror = event => reject(event);
    });
  }


  /**
   * Update package in the store
   * @param {string} id - Package instance ID
   * @param {function} updater - update function
   */
   async function deleteSnapshot(sessionid, idx) {
    const db = await instance.session;
    const tr = db.transaction(db.name).objectStore(db.name);
    const data = await new Promise((resolve, reject) => {
      const req = tr.get(sessionid);
      req.onsuccess = event => resolve(event.target.result);
      req.onerror = event => reject(event);
    });
    data.snapshot.splice(idx, 1);
    return new Promise((resolve, reject) => {
      const req = tr.put(data);
      req.onsuccess = () => resolve();
      req.onerror = event => reject(event);
    });
  }


  var idb = {
    clear, clearAll,
    getConfig, putConfig,
    getSessionHeaders,
    getSession, putSession, deleteSession,
    appendSnapshot, deleteSnapshot
  };

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
    const text = compressed ? pako__default["default"].inflate(data, {to: 'string'}) : data;
    return JSON.parse(text);
  }


  function loadJSON(file) {
    const compressed = file.name.endsWith('c') || file.name.endsWith('.gz');
    return readFile(file, false, compressed)
      .then(data => parseJSON(data, compressed));
  }


  function fetchJSON(url) {
    const decoded = decodeURIComponent(url);
    const compressed = decoded.endsWith('c') || decoded.endsWith('.gz');
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
    const data = compress ? pako__default["default"].gzip(str) : str;
    const ext = `.ap${compress ? 'c' : 'r'}`;
    downloadDataFile(data, `${name}${ext}`);
  }


  var hfile = {
    readFile, parseJSON, loadJSON, fetchJSON,
    downloadDataFile, downloadJSON
  };

  const assetBaseURL = '../assets/';
  const iconBaseURL$1 = '../assets/icon/';


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
        .ease(d3__default["default"].easeLinear)
        .style("opacity", 1.0)
      .transition()
        .delay(3000)
        .duration(1000)
        .ease(d3__default["default"].easeLinear)
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

  const iconBaseURL = './asset/icon/';


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
          d3__default["default"].select(this).select('input').node().click();
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


  function dropdownMenuFileValue(selection) {
    return selection.select('input').node().files[0];
  }


  var button = {
    iconBaseURL, buttonBox, menuButton, menuButtonLink, menuModalLink,
    dropdownMenuButton, dropdownMenuItem, dropdownMenuModal,
    dropdownMenuFile, dropdownMenuFileValue
  };

  const scales = {
    color: {
      default: {
        range: ['#7fffd4'],
        unknown: '#7fffd4'
      },
      monogray: {
        range: ['#cccccc'],
        unknown: '#cccccc'
      },
      blue: {
        range: ['#778899', '#7fffd4'],
        unknown: '#f0f0f0'
      },
      green: {
        range: ['#778899', '#7fff00'],
        unknown: '#f0f0f0'
      },
      red: {
        range: ['#778899', '#fa8072'],
        unknown: '#f0f0f0'
      },
      category10: {
        range: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
          '#b3de69','#fccde5','#bc80bd','#ccebc5'],
        unknown: '#f0f0f0'
      },
      cbsafe: {
        range: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5',
          '#80cdc1','#35978f','#01665e','#003c30'],
        unknown: '#f0f0f0'
      }
    },
    nodeSize: {
      small: {
        range: [10, 40],
        unknown: 10
      },
      medium: {
        range: [20, 80],
        unknown: 20
      },
      large: {
        range: [40, 160],
        unknown: 40
      }
    },
    edgeWidth: {
      thin: {
        range: [2, 10],
        unknown: 10
      },
      medium: {
        range: [4, 20],
        unknown: 20
      },
      thick: {
        range: [8, 40],
        unknown: 40
      }
    }
  };

  const types = [
    {key: 'linear', name: 'Linear', func: d3__default["default"].scaleLinear},
    {key: 'log', name: 'Log', func: d3__default["default"].scaleLog},
    {key: 'quantize', name: 'Quantize', func: d3__default["default"].scaleQuantize},
    {key: 'ordinal', name: 'Ordinal', func: d3__default["default"].scaleOrdinal}
  ];


  function scaleFunction(params, rangeType) {
    const scale = scales[rangeType][params.rangePreset];
    const range = scale.range;
    const unknown = scale.unknown;

    let domain = null;
    if (range.length === 3) {
      const mid = (parseFloat(params.domain[0]) + parseFloat(params.domain[1])) / 2;
      domain = [params.domain[0], mid, params.domain[1]];
    } else {
      domain = params.domain;
    }
    // Build
    let scaleFunc = types.find(e => e.key === params.scale).func();
    scaleFunc = scaleFunc.domain(domain);
    scaleFunc = scaleFunc.range(range);
    if (['linear', 'log'].includes(params.scale)) {
      scaleFunc = scaleFunc.clamp(true);
    }

    return d => {
      // Sanitize
      if (d === '' || typeof d === 'undefined' || d === null) {
        return unknown;  // invalid values
      }
      if (['linear', 'log'].includes(params.scale) && parseFloat(d) != d) {
        return unknown;  // texts
      }
      if (params.scale === 'log' && d <= 0) {
        return unknown;  // negative values in log scale
      }
      // Apply function
      const result = scaleFunc(d);
      if (result === undefined) {
        return unknown;  // TODO: specify unexpected behavior
      }
      return result;
    };
  }


  function isD3Format(notation) {
    try {
      d3__default["default"].format(notation);
    } catch (err) {
      return false;
    }
    return true;
  }


  var cscale = {
    scales, types, scaleFunction, isD3Format
  };

  function monocolorBar(selection, colors, text) {
    const group = selection.append('g');
    group.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', 100).attr('height', 10)
        .attr('fill', colors[0]);
    group.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', 50).attr('y', 10)
        .attr('font-size', 12)
        .text(text);
  }

  function bicolorBar(selection, colors, text) {
    const id = misc.uuidv4().slice(0, 8);  // Aboid inline SVG ID dupulicate
    selection.call(monocolorBar, colors, text);
    const grad = selection.append('defs')
      .append('linearGradient')
        .attr('id', id);
    grad.append('stop')
        .attr('offset', 0).attr('stop-color', colors[0]);
    grad.append('stop')
        .attr('offset', 1).attr('stop-color', colors[1]);
    selection.select('rect')
        .attr('fill', `url(#${id})`);
  }

  function tricolorBar(selection, colors, text) {
    const id = misc.uuidv4().slice(0, 8);  // Aboid inline SVG ID dupulicate
    selection.call(monocolorBar, colors, text);
    const grad = selection.append('defs')
      .append('linearGradient')
        .attr('id', id);
    grad.append('stop')
      .attr('offset', 0).attr('stop-color', colors[0]);
    grad.append('stop')
      .attr('offset', 0.5).attr('stop-color', colors[1]);
    grad.append('stop')
      .attr('offset', 1).attr('stop-color', colors[2]);
    selection.select('rect')
        .attr('fill', `url(#${id})`);
  }

  function categoricalBar(selection, colors, text) {
    const sw = 100 / colors.length;
    const group = selection.append('g');
    colors.forEach((e, i) => {
      group.append('rect')
          .attr('x', sw * i).attr('y', 0)
          .attr('width', sw).attr('height', 10)
          .attr('fill', colors[i]);
    });
    group.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', 50).attr('y', 10)
        .attr('font-size', 12)
        .text(text);
  }

  function setSize(selection, width, height) {
    selection.attr('width', width).attr('height', height);
  }


  const colorBar = {
    'monocolor': monocolorBar,
    'bicolor': bicolorBar,
    'tricolor': tricolorBar,
    'categorical': categoricalBar,
    'custom': monocolorBar
  };


  var shape = {
    colorBar, setSize
  };

  function colorBarLegend(selection) {
    selection.append('rect')
        .classed('bg', true)
        .attr('x', 0).attr('y', 0)
        .attr('width', 120).attr('height', 50)
        .attr('fill', 'white')
        .attr('opacity', 0.9);
    selection.append('text')
        .classed('title', true)
        .attr('text-anchor', 'middle')
        .attr('x', 60).attr('y', 15)
        .style('font-size', 12);
    selection.append('g')
        .classed('colorbar', true)
        .attr('transform', 'translate(10, 20)');
    const domains = selection.append('g')
        .classed('label', true)
        .attr('transform', 'translate(10, 40)')
        .style('font-size', 12);
    domains.append('text')
        .classed('min', true)
        .attr('text-anchor', 'start')
        .attr('x', 0).attr('y', 0);
    domains.append('text')
        .classed('max', true)
        .attr('text-anchor', 'end')
        .attr('x', 100).attr('y', 0);
  }


  function updateColorBarLegend(selection, colorState) {
    const field = cscale.colorScales.find(e => e.key === colorState.color);
    const colorBar = shape.colorBar[field.type];
    const range = field.key === 'custom' ? colorState.range : field.colors;
    selection.select('.title').text(colorState.field);
    selection.select('.colorbar').selectAll('g,defs').remove();
    selection.select('.colorbar').call(colorBar, range);
    selection.select('.min')
      .attr('visibility',
            ['bicolor', 'tricolor'].includes(field.type) ? 'inherit' : 'hidden')
      .text(colorState.domain[0]);
    selection.select('.max')
      .attr('visibility',
            ['bicolor', 'tricolor'].includes(field.type) ? 'inherit' : 'hidden')
      .text(colorState.domain[1]);
  }


  /**
   * Legend group component
   * @param {d3.selection} selection - selection of group container (svg:g)
   */
  function updateLegendGroup(selection, viewBox, orient) {
    const widthFactor = 0.2;
    const scaleF = viewBox.right * widthFactor / 120;
    const o = orient.split('-');
    const viewW = viewBox.right;
    const viewH = viewBox.bottom;
    const legW = viewW * widthFactor;
    const legH = legW * 50 / 120;
    const posX = {left: legW / 10, right: viewW - legW - (legW / 10)}[o[1]];
    const posY = {top: legH / 10, bottom: viewH - legH - (legH / 10)}[o[0]];
    selection.attr('transform',
                   `translate(${posX}, ${posY}) scale(${scaleF})`);
  }


  var legend = {
    colorBarLegend, updateColorBarLegend, updateLegendGroup
  };

  function transform(selection, tx, ty, tk) {
    selection.select('.field')
      .attr('transform', `translate(${tx}, ${ty}) scale(${tk})`);
  }

  function transform2(selection, state) {
    const st = state.transform;
    selection.select('.field')
      .attr('transform', `translate(${st.x}, ${st.y}) scale(${st.k})`);
  }

  function resize(selection, state) {
    const area = selection.node();
    const width = area.offsetWidth;
    const height = area.offsetHeight;
    selection.select('.view')
        .attr('viewBox', `0 0 ${width} ${height}`)
      .select('.boundary')
        .attr('width', width)
        .attr('height', height);
    state.setViewBox(width, height);
    state.resizeNotifier();
  }


  function viewFrame(selection, state) {
    selection.select('.view').remove(); // Clean up
    selection.append('svg')
      .classed('view', true);
    selection.call(resize, state);
  }


  function view(selection, state) {
    selection
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('pointer-events', 'all')
      .attr('viewBox', `0 0 ${state.viewBox.right} ${state.viewBox.bottom}`);

    // Clean up
    selection.selectAll('g, rect').remove();

    // Boundary
    selection.append('rect')
        .classed('boundary', true)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', state.viewBox.right)
        .attr('height', state.viewBox.bottom)
        .attr('fill', '#ffffff')
        .attr('stroke-width', 1)
        .attr('stroke', '#cccccc');
    // Field
    selection.append('g')
        .classed('field', true)
        .style('opacity', 1e-6)
      .transition()
        .duration(1000)
        .style('opacity', 1);
  }


  var transform$1 = {
    transform, transform2, resize, viewFrame, view
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


  function textareaBox(selection, label, rows, placeholder) {
    selection
        .classed('form-group', true)
        .classed('form-row', true);
    const formLabel = selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    formLabel.append('div')
        .call(badge$1.invalidFeedback);
    selection.append('textarea')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('col-8', true)
        .attr('rows', rows)
        .attr('placeholder', placeholder)
        .on('input', function () {
          const valid = textareaValid(selection);
          selection.call(setValidity, valid);
        });
  }

  function textareaBoxLines(selection) {
    const value = selection.select('textarea').property('value');
    if (value) return value.split('\n')
      .map(e => e.replace(/^\s+|\s+$/g, ''))  // strip spaces
      .filter(e => e.length > 0);
    return [];
  }

  function textareaValid(selection) {
    return /\s*?\w\s*?/.test(formValue(selection));
  }


  function checkBox(selection, label) {
    const box = selection
        .classed('form-group', true)
        .classed('form-row', true)
        .classed('form-check', true)
      .append('label')
        .classed('form-check-label', true)
        .classed('col-form-label-sm', true);
    box.append('input')
        .classed('form-check-input', true)
        .attr('type', 'checkbox');
    box.append('span')
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
        .attr('type', 'number')
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
          d3__default["default"].event.stopPropagation();
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
    textareaBox, textareaBoxLines, textareaValid,
    numberBox, updateNumberRange,
    checkBox, updateCheckBox, checkBoxValue,
    colorBox,
    fileInputBox, clearFileInput, fileInputValue, fileInputValid
  };

  function dialogBase(selection, id) {
    selection
        .classed('modal', true)
        .attr('tabindex', -1)
        .attr('role', 'dialog')
        .attr('aria-labelledby', '')
        .attr('aria-hidden', true)
        .attr('id', id);
    selection.append('div')
        .classed('modal-dialog', true)
        .attr('role', 'document')
      .append('div')
        .classed('modal-content', true);
  }


  function confirmDialog(selection, id) {
    const base = selection.call(dialogBase, id)
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
        .attr('data-dismiss', 'modal')
        .text('Cancel');
    footer.append('button')
        .classed('btn', true)
        .classed('btn-warning', true)
        .classed('ok', true)
        .attr('type', 'button')
        .attr('data-dismiss', 'modal')
        .text('OK')
        .on('click', () => {
          selection.dispatch('submit');
        });
  }


  function updateConfirmDialog(selection, message) {
    selection.select('.message').text(message);
  }


  function submitDialog(selection, id, title) {
    const base = selection.call(dialogBase, id)
        .select('.modal-content');
    // header
    const header = base.append('div')
        .classed('modal-header', true);
    header.append('h4')
        .classed('modal-title', true)
        .text(title);
    header.append('button')
        .attr('type', 'button')
        .attr('data-dismiss', 'modal')
        .attr('aria-label', 'Close')
        .classed('close', true)
      .append('span')
        .attr('aria-hidden', true)
        .html('&times;');
    // body
    base.append('div')
        .classed('modal-body', true);
    // footer
    base.append('div')
        .classed('modal-footer', true)
      .append('button')
        .classed('btn', true)
        .classed('btn-primary', true)
        .classed('submit', true)
        .attr('type', 'button')
        .attr('data-dismiss', 'modal')
        .text('Submit')
        .on('click', () => {
          // Dismiss before submit
          // Submit event can update the modal itself
          // (ex. disable submit button before onSubmit call has completed)
          $(`#${id}`).modal('hide');
          selection.dispatch('submit');
        });
  }


  var modal = {
    confirmDialog, updateConfirmDialog, submitDialog
  };

  const id = 'rename-dialog';
  const title = 'Rename';


  function menuLink(selection) {
    selection.call(button.dropdownMenuModal, title, id, 'menu-edittext');
  }


  function body(selection) {
    const renameBox = selection.call(modal.submitDialog, id, title)
      .select('.modal-body').append('div')
        .classed('rename', true)
        .call(box.textBox, 'New name');
    renameBox.select('.form-control')
        .attr('required', 'required');
    renameBox.select('.invalid-feedback')
        .call(badge$1.updateInvalidMessage, 'Please provide a valid name');
  }


  function updateBody(selection, name) {
    selection.select('.rename')
        .call(box.updateFormValue, name)
        .on('input', function () {
          const valid = box.formValid(d3__default["default"].select(this));
          selection.select('.submit').property('disabled', !valid);
        })
        .dispatch('input');
  }


  function value(selection) {
    return box.formValue(selection.select('.rename'));
  }


  var renameDialog = {
    menuLink, body, updateBody, value
  };

  class TransformState {
    constructor(width, height, transform) {
      this.fieldWidth = width;
      this.fieldHeight = height;

      this.viewBox = {
        top: 0,
        right: this.fieldWidth,
        bottom: this.fieldHeight,
        left: 0
      };

      this.focusArea = {};
      this.focusAreaMargin = 50;

      this.boundary = {
        top: 0,
        right: this.fieldWidth,
        bottom: this.fieldHeight,
        left: 0
      };

      this.transform = transform || {x: 0, y: 0, k: 1};
      this.prevTransform = {
        x: this.transform.x,
        y: this.transform.y,
        k: this.transform.k
      };

      this.resizeNotifier = () => {};
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
      this.viewBox.right = width;
      this.viewBox.bottom = height;
      // this.showViewBox();  // debug
      this.setFocusArea();
    }

    setTransform(tx, ty, tk) {
      this.transform.x = tx;
      this.transform.y = ty;
      this.transform.k = tk;
      // this.showTransform(); // debug
      this.setFocusArea();
    }

    fitTransform() {
      const vh = this.viewBox.bottom;
      const vw = this.viewBox.right;
      const vr = vw / vh;
      const bh = this.boundary.bottom - this.boundary.top;
      const bw = this.boundary.right - this.boundary.left;
      const br = bw / bh;
      const isPortrait = vr >= br;
      const tk = isPortrait ? vh / bh : vw / bw;
      const adjustH = isPortrait ? (vw - bw * tk) / 2 : 0;
      const adjustV = isPortrait ? 0 : (vh - bh * tk) / 2;
      const tx = -(this.boundary.left) * tk + adjustH;
      const ty = -(this.boundary.top) * tk + adjustV;
      this.setTransform(tx, ty, tk);
    }

    showTransform() {
      d3__default["default"].select('#debug-transform')
        .text(JSON.stringify(this.transform));
    }

    showFocusArea() {
      d3__default["default"].select('#debug-focusarea')
        .text(JSON.stringify(this.focusArea));
    }

    showViewBox() {
      d3__default["default"].select('#debug-viewbox')
        .text(JSON.stringify(this.viewBox));
    }
  }

  class NetworkState extends TransformState {
    constructor(session) {
      super(1200, 1200, null);
      // Session properties
      this.sessionName = session.name;
      this.nodes = session.nodes;
      this.nodes.forEach((e, i) => {
        e.__index = i;  // internal id for d3.force
        e.__selected = false;  // for multiple selection
      });
      this.edges = session.edges;
      this.edges.forEach((e, i) => {
        // internal id for d3.force
        e.__source = e.source;
        e.__target = e.target;
        e.__index = i;
      });

      // Snapshot properties
      this.name = null;
      this.filters = null;
      this.positions = null;
      this.config = null;
      this.appearance = null;

      // filtered elements
      this.fnodes = [];
      this.fedges = [];
      this.adjacency = [];

      // visible elements
      this.vnodes = [];
      this.vedges = [];

      // Visibility
      this.showNodeImage = false;
      this.showEdge = false;

      // Force
      this.forceActive = true;  // TODO: if no initial positions

      // Event listeners
      this.zoomListener = null;
      this.dragListener = null;

      // Event notifiers
      this.updateAllNotifier = null;
      this.updateComponentNotifier = null;
      this.updateNodeNotifier = null;
      this.updateEdgeNotifier = null;
      this.updateNodeAttrNotifier = null;
      this.updateEdgeAttrNotifier = null;
      this.updateLegendNotifier = null;
      this.updateControlBoxNotifier = () => {};
      this.updateInteractionNotifier = () => {};
      this.fitNotifier = () => {};
      this.setForceNotifier = () => {};
      this.stickNotifier = () => {};
      this.relaxNotifier = () => {};
      this.restartNotifier = () => {};
      this.tickCallback = () => {};

      // Initialize snapshot
      let snapshot = {};
      if (session.hasOwnProperty("snapshots") && session.snapshots.length > 0) {
        snapshot = session.snapshots.slice(-1)[0];
      }
      this.applySnapshot(snapshot);
    }

    applySnapshot(snapshot) {
      this.name = snapshot.hasOwnProperty("name") ? snapshot.name : "default";
      this.filters = snapshot.hasOwnProperty("filters") ? snapshot.filters : [];
      this.positions = snapshot.hasOwnProperty("positions") ? snapshot.filters : [];
      this.config = snapshot.hasOwnProperty("config") ? snapshot.config : {
        showNodeImageThreshold: 100,
        alwaysShowNodeImage: false,
        showEdgeThreshold: 500,
        alwaysShowEdge: false,
        legendOrientation: 'top-left',
        forceParam: 'aggregate'
      };
      this.appearance = snapshot.hasOwnProperty("appearance") ? snapshot.appearance : {
        nodeColor: {
          field: null, rangePreset: 'default',
          scale: 'linear', domain: [0, 1]
        },
        nodeSize: {
          field: null, rangePreset: 'medium',
          scale: 'linear', domain: [1, 1]
        },
        nodeLabel: {
          field: null, size: 20, visible: false
        },
        edgeColor: {
          field: null, rangePreset: 'monogray',
          scale: 'linear', domain: [0, 1]
        },
        edgeWidth: {
          field: null, rangePreset: 'medium',
          scale: 'linear', domain: [0.5, 1]
        },
        edgeLabel: {
          field: null, size: 12, visible: false
        }
      };
    }

    takeSnapshot() {
      // TODO: save coords
      return {
        name: this.name,
        filters: this.filters,
        positions: this.positions,
        config: this.config,
        appearance: this.appearance
      }
    }

    /**
     * update this.nodes and this.edges used by d3.force
     */
    updateFilter() {
      // TODO: apply filters
      /*
      this.snapshot.filters.forEach(filter => {
        const component = filter.type == "edge" ? this.session.edges : this.session.nodes;
        const workingCopy = filter.type == "edge" ? this.edges : this.nodes;
        component.filter(e => {
          if (filter.scale == "nominal") {
            filter.key
          } else {

          }
        });
      });
      */
      this.fnodes = this.nodes;
      this.fedges = this.edges;
      // update adjacency
      this.adjacency.splice(0);
      this.nodes.forEach(e => {
        this.adjacency.push([]);
      });
      this.fedges.forEach(e => {
        this.adjacency[e.__source].push([e.__target, e]);
        this.adjacency[e.__target].push([e.__source, e]);
      });
      // this.setAllCoords(this.coords);
    }

    setBoundary() {
      const xs = [];
      const ys = [];
      this.fnodes.forEach(e => {
        xs.push(e.x);
        ys.push(e.y);
      });
      this.boundary.top = Math.min.apply(null, ys);
      this.boundary.left = Math.min.apply(null, xs);
      this.boundary.bottom = Math.max.apply(null, ys);
      this.boundary.right = Math.max.apply(null, xs);
      // this.showBoundary(); // debug
    }

    setAllCoords(coordsList) {
      this.ns.forEach(n => {
        n.x = coordsList[n.index].x;
        n.y = coordsList[n.index].y;
        // this.es can be changed by forceSimulation so use adjacency
        n.adjacency.forEach(e => {
          const nbr = e[0];
          const edge = e[1];
          if (n.index < nbr) {
            this.es[edge].sx = coordsList[n.index].x;
            this.es[edge].sy = coordsList[n.index].y;
          } else {
            this.es[edge].tx = coordsList[n.index].x;
            this.es[edge].ty = coordsList[n.index].y;
          }
        });
      });
      this.setBoundary();
    }

    setCoords(n, x, y) {
      this.nodes[n].x = x;
      this.nodes[n].y = y;
      this.nodes[n].adjacency.forEach(e => {
        const nbr = e[0];
        const edge = e[1];
        if (n < nbr) {
          this.edges[edge].sx = x;
          this.edges[edge].sy = y;
        } else {
          this.edges[edge].tx = x;
          this.edges[edge].ty = y;
        }
      });
      this.setBoundary();
    }

    updateVisibility() {
      this.vnodes = this.fnodes; /*this.fnodes.filter(e => {
        return e.y > this.focusArea.top && e.x > this.focusArea.left
          && e.y < this.focusArea.bottom && e.x < this.focusArea.right;
      });*/
      this.vedges = this.fedges; /*this.fedges.filter(e => {
        return this.vnodes.includes(e.__source) || this.vnodes.includes(e.__target);
      });*/
    }

  }

  const svgWidth = 180;  //TODO
  const svgHeight = 180;  //TODO


  function updateNodes(selection, records, showStruct) {
    const nodes = selection.selectAll('.node')
      .data(records, d => d.__index);
    nodes.exit().remove();
    const entered = nodes.enter()
      .append('g')
        .attr('class', 'node')
        .call(updateNodeCoords);
    entered.append('circle')
        .attr('class', 'node-symbol');
    entered.append('g')
        .attr('class', 'node-content')
        .attr('transform', `translate(${-svgWidth / 2},${-svgHeight / 2})`);
    entered.append('foreignObject')
        .attr('class', 'node-html')
      .append('xhtml:div');
    const merged = entered.merge(nodes);
    if (showStruct) {
      merged.select('.node-content').html(d => d.structure);
    } else {
      merged.select('.node-content').select('svg').remove();
    }
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
    // draw all components and then
    entered.call(updateEdgeCoords);
  }


  function updateNodeAttrs(selection, state) {
    const colorScaleFunc = cscale.scaleFunction(state.appearance.nodeColor, "color");
    const sizeScaleFunc = cscale.scaleFunction(state.appearance.nodeSize, "nodeSize");
    state.appearance.nodeLabel.field;
    const textFormatFunc = value => {
      return value
      // return labelField.format === 'd3_format'
      //  ? misc.formatNum(value, labelField.d3_format) : value;
    };
    selection.selectAll('.node').select('.node-symbol')
        .attr('r', d => sizeScaleFunc(d[state.appearance.nodeSize.field]))
        .style('fill', d => colorScaleFunc(d[state.appearance.nodeColor.field]));
    // TODO: tidy up (like rowFactory?)
    const htwidth = 200;
    const fo = selection.selectAll('.node').select('.node-html');
    fo.attr('x', -htwidth / 2)
      .attr('y', d => state.showNodeImage ? svgWidth / 2 - 10
        : parseFloat(sizeScaleFunc(d[state.appearance.nodeSize.field])))
      .attr('width', htwidth)
      .attr('height', 1)
      .attr('overflow', 'visible');
    fo.select('div')
      .style('font-size', `${state.appearance.nodeLabel.size}px`)
      .style('color', d => d.labelColor || "#cccccc")
      .style('text-align', 'center')
      .style('display', state.appearance.nodeLabel.visible ? 'block' : 'none')
      .html(d => textFormatFunc(d[state.appearance.nodeLabel.field]));
  }


  function updateEdgeAttrs(selection, state) {
    const colorScaleFunc = cscale.scaleFunction(state.appearance.edgeColor, "color");
    const widthScaleFunc = cscale.scaleFunction(state.appearance.edgeWidth, "edgeWidth");
    state.appearance.edgeLabel.field;
    const textFormatFunc = value => {
      return value
      //return labelField.format === 'd3_format'
      //  ? misc.formatNum(value, labelField.d3_format) : value;
    };
    selection.selectAll('.link').select('.edge-line')
      .style('stroke', d => colorScaleFunc(d[state.appearance.edgeColor.field]))
      .style('stroke-width', d => widthScaleFunc(d[state.appearance.edgeWidth.field]));
    selection.selectAll('.link').select('.edge-label')
      .attr('font-size', state.appearance.edgeLabel.size)
      .attr('visibility', state.appearance.edgeLabel.visible ? 'inherit' : 'hidden')
      .style('fill', d => d.labelColor || "#cccccc")
      .text(d => textFormatFunc(d[state.appearance.edgeLabel.field]));
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

  function updateAttrs(selection, state) {
    selection.call(updateNodeAttrs, state);
    selection.call(updateEdgeAttrs, state);
  }


  function updateComponents(selection, state) {
    selection.select('.node-layer')
      .call(updateNodes, state.vnodes, false);
    selection.select('.edge-layer')
      .call(updateEdges, state.vedges);
    selection.call(updateAttrs, state);
  }


  function moveNode(selection, x, y) {
    selection.attr('transform', `translate(${x}, ${y})`);
  }


  function moveEdge(selection, sx, sy, tx, ty) {
    selection.attr('transform', `translate(${sx}, ${sy})`);
    selection.select('.edge-line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', tx - sx)
      .attr('y2', ty - sy);
    selection.select('.edge-label')
      .attr('x', (tx - sx) / 2)
      .attr('y', (ty - sy) / 2);
  }


  function move(selection, node, state, x, y) {
    const n = d3__default["default"].select(node).call(moveNode, x, y).datum();
    selection.select('.edge-layer')
      .selectAll(".link")
      .filter(d => state.adjacency.map(e => e[1].__index).includes(d.__index))
      .each(function (d) {
        if (n.__index === d.source.index) {
          d3__default["default"].select(this).call(moveEdge, x, y, d.target.x, d.target.y);
        } else if (n.__index === d.target.index) {
          d3__default["default"].select(this).call(moveEdge, d.source.x, d.source.y, x, y);
        }
      });
  }


  function networkView(selection, state) {
    selection.call(transform$1.view, state);
    const field = selection.select('.field');
    const edges = field.append('g').classed('edge-layer', true);
    const nodes = field.append('g').classed('node-layer', true);
    const legendGroup = selection.append('g')
        .classed('legends', true);
    legendGroup.append('g')
        .classed('nodecolor', true)
        .call(legend.colorBarLegend);
    // Apply changes in datasets
    state.updateAllNotifier = () => {
      state.updateFilter();
      state.updateVisibility();
      //state.updateControlBoxNotifier();  // Update selectBox options
      state.setForceNotifier();
      state.updateComponentNotifier();
    };
    // Apply changes in nodes and edges displayed
    state.updateComponentNotifier = () => {
      // state.updateLegendNotifier();
      // const coords = state.ns.map(e => ({x: e.x, y: e.y}));
      // state.setAllCoords(coords);
      selection.call(updateComponents, state);
      state.updateInteractionNotifier();  // Apply drag events to each nodes
    };
    state.updateNodeNotifier = () => {
      nodes.call(updateNodes, state.vnodes);
      // state.updateLegendNotifier();
    };
    state.updateEdgeNotifier = () => {
      edges.call(updateEdges, state.vedges);
    };
    state.updateNodeAttrNotifier = () => {
      nodes.call(updateNodeAttrs, state);
      // state.updateLegendNotifier();
    };
    state.updateEdgeAttrNotifier = () => {
      edges.call(updateEdgeAttrs, state);
    };
    /*
    state.updateLegendNotifier = () => {
      legendGroup.call(legend.updateLegendGroup,
                       state.viewBox, state.legendOrient);
      legendGroup.select('.nodecolor')
          .attr('visibility', state.nodeColor.legend ? 'inherit' : 'hidden')
          .call(legend.updateColorBarLegend, state.nodeColor);
    };
    */
  }


  var component = {
    updateNodes, updateEdges, updateNodeCoords, updateEdgeCoords,
    updateNodeAttrs, updateEdgeAttrs, updateNodeSelection,
    updateAttrs, updateComponents,
    move, moveEdge, networkView
  };

  function dragListener(selection, state) {
    return d3__default["default"].drag()
      .on('drag', event => {
        if (event.subject.__selected) {
          // multi selected node
          selection.selectAll(".node")
            .filter(d => d.__selected)
            .each(d => {  // TODO: d.x += dx can work?
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
          d3__default["default"].selectAll(".node")
            .filter(d => d.__index == n)
            .call(component.updateNodeCoords);
          selection.selectAll(".link")
            .filter(d => d.source.__index == n || d.target.__index == n)
            .call(component.updateEdgeCoords);
        }
      });
  }


  function zoomListener(selection, state) {
    const p = {x: 0, y: 0, k: 1};  // previous transform
    selection
      .on("dblclick.zoom", null)  // disable double-click zoom
      .on('.drag', null);  // disable rectSelect
    return d3__default["default"].zoom()
      .on('zoom', event => {
        const t = event.transform;
        selection.call(transform$1.transform, t.x, t.y, t.k);
        // Smooth transition (continuously update components on zoom out)
        // only work for showNodeImage=false due to performance reason
        if (!state.showNodeImage) {
          const xMoved = t.x > p.x + 20 || t.x < p.x - 20;
          const yMoved = t.y > p.y + 20 || t.y < p.y - 20;
          const zoomIn = t.k > p.k;
          if (xMoved || yMoved && !zoomIn) {
            state.setTransform(t.x, t.y, t.k);
            p.x = t.x;
            p.y = t.y;
            p.k = t.k;
            state.updateComponentNotifier();
          }
        }
      })
      .on('end', event => {
        const t = event.transform;
        state.setTransform(t.x, t.y, t.k);
        p.x = t.x;
        p.y = t.y;
        p.k = t.k;
        state.updateComponentNotifier();
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
    return d3__default["default"].drag()
      .on('start', event => {
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
            const n = d3__default["default"].select(event.currentTarget).datum().__index;
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
            const n = d3__default["default"].select(event.currentTarget).datum().__index;
            state.nodes[n].__selected = state.nodes[n].__selected ? false : true;
            selection.selectAll(".node")
              .call(component.updateNodeSelection);
          });
    };
  }


  function resume(selection, tf) {
    selection
        .call(transform$1.transform, tf.x, tf.y, tf.k)
        .call(
          d3__default["default"].zoom().transform,
          d3__default["default"].zoomIdentity.translate(tf.x, tf.y).scale(tf.k)
        );
  }


  function setInteraction(selection, state) {
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
      state.updateInteractionNotifier();
    });

    // Exit multiple select mode
    document.addEventListener('keyup', event => {
      if (event.key !== 'Shift') return;
      selection.style("cursor", "auto");
      state.zoomListener = zoomListener(selection, state);
      state.selectListener = selectListener(selection, state);
      state.updateInteractionNotifier();
    });

    // Event listeners
    state.zoomListener = zoomListener(selection, state);
    state.selectListener = selectListener(selection, state);
    state.dragListener = dragListener(selection);

    // Update interaction events
    state.updateInteractionNotifier = () => {
      selection.call(state.zoomListener);
      selection.selectAll('.node').call(state.selectListener);
      selection.selectAll('.node').call(state.dragListener);
      selection.call(resume, state.transform);
    };

    // Fit to the viewBox
    state.fitNotifier = () => {
      state.fitTransform();
      state.updateComponentNotifier();
      selection.call(resume, state.transform);
    };
  }


  var interaction = {
    dragListener, zoomListener, setInteraction
  };

  const forceType = [
    {
      key: 'aggregate',
      name: 'Aggregate',
      force: d3__default["default"].forceSimulation()
        .force('link', d3__default["default"].forceLink().id(d => d.__index).distance(60).strength(1))
        .force('charge',
          d3__default["default"].forceManyBody().strength(-600).distanceMin(15).distanceMax(720))
        .force('collide', d3__default["default"].forceCollide().radius(90))
        .force('x', d3__default["default"].forceX().strength(0.002))
        .force('y', d3__default["default"].forceY().strength(0.002))
    },
    {
      key: 'tree',
      name: 'Tree',
      force: d3__default["default"].forceSimulation()
        .force('link', d3__default["default"].forceLink().id(d => d.__index).distance(60).strength(2))
        .force('charge',
          d3__default["default"].forceManyBody().strength(-6000).distanceMin(15).distanceMax(720))
        .force('collide', d3__default["default"].forceCollide().radius(90))
        .force('x', d3__default["default"].forceX().strength(0.0002))
        .force('y', d3__default["default"].forceY().strength(0.0002))
    },
    {
      key: 'sparse',
      name: 'Sparse',
      force: d3__default["default"].forceSimulation()
        .force('link', d3__default["default"].forceLink().id(d => d.__index).distance(60).strength(2))
        .force('charge',
          d3__default["default"].forceManyBody().strength(-6000).distanceMin(15).distanceMax(3600))
        .force('collide', d3__default["default"].forceCollide().radius(90))
        .force('x', d3__default["default"].forceX().strength(0.0002))
        .force('y', d3__default["default"].forceY().strength(0.0002))
    }
  ];


  function forceSimulation(type, width, height) {
    return forceType.find(e => e.key === type).force
      .force('center', d3__default["default"].forceCenter(width / 2, height / 2))
      .stop();
  }


  function forceDragListener(selection, simulation, state) {
    return d3__default["default"].drag()
      .on('start', event => {
        if (!event.active) state.relaxNotifier();
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
    state.dragListener = interaction.dragListener(selection, state);
    state.forceActive = false;
    console.log("stick");
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


  function activate(selection, state) {
    state.setForceNotifier = () => {
      const simulation = forceSimulation(
          state.config.forceParam, state.fieldWidth, state.fieldHeight);
      simulation.nodes(state.fnodes)
        .force('link').links(state.fedges);
      simulation
        .on('tick', () => {
          // const coords = state.fnodes.map(e => ({x: e.x, y: e.y}));
          // state.setAllCoords(coords);
          selection.selectAll(".node")
            .call(component.updateNodeCoords);
          selection.selectAll(".link")
            .call(component.updateEdgeCoords);
          state.tickCallback(simulation);
        })
        .on('end', () => {
          state.setBoundary();
          state.updateComponentNotifier();
          selection.call(stick, simulation, state);
          state.tickCallback(simulation);
        });

      state.stickNotifier = () => {
        selection.call(stick, simulation, state);
      };
      state.relaxNotifier = () => {
        selection.call(unstick, simulation, state);
        simulation.alpha(0.1).restart();
      };
      state.restartNotifier = () => {
        selection.call(unstick, simulation, state);
        simulation.alpha(1).restart();
      };


      if (state.forceActive) {
        state.restartNotifier();
      } else {
        state.stickNotifier();
      }
    };
  }


  var force = {
    forceType, forceSimulation, activate
  };

  function updateApp(state) {
    // Title
    d3__namespace.select('title').text(state.name);

    // Status
    d3__namespace.select('#menubar .name').text(state.name);

    const onLoading = d3__namespace.select('#menubar .loading-circle');
    const commaf = d3__namespace.format(',');
    d3__namespace.select('#menubar .nodes-count')
        .call(badge$1.updateBadge, `${commaf(state.nodes.length)} nodes`,
              'light', 'nodes-gray')
      .select('.text')
        .style('color', 'gray');
    d3__namespace.select('#menubar .edges-count')
        .call(badge$1.updateBadge, `${commaf(state.edges.length)} edges`,
              'light', 'edges-gray')
      .select('.text')
        .style('color', 'gray');


    // Dialogs
    const dialogs = d3__namespace.select('#dialogs');

    // Rename dialog
    dialogs.select('.renamed')
        .call(renameDialog.updateBody, state.name)
        .on('submit', function () {
          onLoading.style('display', 'inline-block');
          state.name = renameDialog.value(d3__namespace.select(this));
          updateApp(state);
        });

    onLoading.style('display', 'none');
  }


  async function run() {
    const err = client.compatibility();
    if (err) {
      d3__namespace.select('body')
        .style('color', '#ff0000')
        .text(err);
      return;
    }

    const header1 = d3__namespace.select('#header1')
        .classed('my-1', true);
    const header2 = d3__namespace.select('#header2')
        .classed('my-1', true);
    d3__namespace.select('#dialogs');
    // header1.selectAll('div,span,a').remove();  // Clean up
    // header2.selectAll('div,span,a').remove();  // Clean up
    // dialogs.selectAll('div').remove();  // Clean up


    const actionIcon = (sel, icon) => sel.append('img')
        .attr('src', `${button.iconBaseURL}${icon}.svg`)
        .classed('mx-1', true)
        .style('width', '1.25rem')
        .style('height', '1.25rem');
    // Header
    header1.append('span')
        .classed('name', true);
    header1.append('a')
        .call(button.dropdownMenuFile, 'Open new session',
          '.json,.gz', 'menu-import')
        .on('change', function () {
          d3__namespace.select('#menubar .loading-circle').style('display', 'inline-block');
          const file = button.dropdownMenuFileValue(d3__namespace.select(this));
          return hfile.loadJSON(file)
            .then(idb.importItem)
            .then(updateApp);
        });
    header1.append('a')
        .call(button.dropdownMenuItem, 'Export current session', 'menu-export')
        .on('click', () => {
          const data = JSON.parse(JSON.stringify(record));
          delete data.instance;
          delete data.sessionStarted;
          hfile.downloadJSON(data, data.name);
        });
    header1.append('span')
        .classed('loading-circle', true)
        .call(badge$1.loadingCircle);

    header2.append('a').call(actionIcon, 'menu-export')
        .on('click', function () {
          return state.saveSnapshot(idb)
            .then(menubar.select('.notify-saved').call(badge$1.notify));
        });
    header2.append('span')
        .classed('notify-saved', true)
        .call(badge$1.alert)
        .call(badge$1.updateAlert, 'State saved', 'success', 'check-green')
        .style('display', 'none');
    //const sid = await idb.putSession(stub);
    //await idb.putConfig("currentSession", sid);

    const sessionid = await idb.getConfig("currentSession");
    if (!sessionid) { return; }
    const session = await idb.getSession(sessionid);
    const state = new NetworkState(session);
    // TODO: define field size according to the data size
    state.fieldWidth = 1200;
    state.fieldHeight = 1200;


    // TODO: export session (json.tar.gz)

    // snapshotはcontrolでpull down選択?にする
    // save snapshotもcontrolに表示
    // 初期は最新のsnapshotを表示

    // Jupyter notebook風に
    // TODO: rename session
    // TODO: rename snapshot

    // TODO: 座標の初期化(0,0付近にランダム配置)

    // Contents
    const frame = d3__namespace.select('#frame')
        .call(transform$1.viewFrame, state);
    frame.select('.view')
        .call(component.networkView, state)
        .call(force.activate, state)
        .call(interaction.setInteraction, state);
    //d3.select('#control')
    //    .call(control.controlBox, state);

    // Resize window
    window.onresize = () =>
      d3__namespace.select('#frame').call(transform$1.resize, state);

    // Update
    state.updateAllNotifier();
    updateApp(state);
  }


  var app = {
    run
  };

  return app;

})(d3, _, pako);
