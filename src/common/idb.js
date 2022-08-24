
/** @module common/idb */

import {default as misc} from './misc.js';

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
  const transaction = db.transaction(db.name)
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
  const transaction = db.transaction(db.name, 'readwrite')
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
  const transaction = db.transaction(db.name)
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
  const transaction = db.transaction(db.name)
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
  const transaction = db.transaction(db.name, 'readwrite')
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
  const transaction = db.transaction(db.name, 'readwrite')
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
  const transaction = db.transaction(db.name, 'readwrite')
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


export default {
  clear, clearAll,
  getConfig, putConfig,
  getSessionHeaders,
  getSession, putSession, deleteSession,
  appendSnapshot, renameSnapshot, deleteSnapshot
};
