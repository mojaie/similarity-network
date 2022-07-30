
/** @module common/idb */

import _ from 'lodash';

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
 */
function clear(dbid) {
  return new Promise((resolve, reject) => {
    return instance[dbid].then(db => {
      const req = db.transaction(db.name, 'readwrite')
          .objectStore(db.name).clear();
        req.onsuccess = () => resolve();
        req.onerror = event => reject(event);
    });
  });
}


/**
 * Delete all data in the local storage
 */
function clearAll() {
  return Promise.all([clear('session'), clear('config')]);
}


/**
 * Returns all sessions
 * @return {Promise} Promise of list of sessions
 */
async function getAllItems() {
  const db = await instance.session
  return new Promise(resolve => {
    const res = [];
    db.transaction(db.name)
      .objectStore(db.name).openCursor()
      .onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) {
          res.push(cursor.value);
          cursor.continue();
        } else {
          resolve(res);
        }
      };
  });
}


/**
 * Get packages by instance ID
 * @param {string} id - Package instance ID
 * @return {array} data store object
 */
async function getItem(id) {
  const db = instance.session
  return new Promise((resolve, reject) => {
    const req = db.transaction(db.name)
      .objectStore(db.name).get(id);
    req.onsuccess = event => resolve(event.target.result);
    req.onerror = event => reject(event);
  });
}


/**
 * Put data object in the store
 * @param {string} value - value to store
 */
function putItem(value) {
  return new Promise((resolve, reject) => {
    return instance.session.then(db => {
      const obj = db.transaction(db.name, 'readwrite')
        .objectStore(db.name);
      const req = obj.put(value);
      req.onerror = event => reject(event);
      req.onsuccess = () => resolve();
    });
  });
}


/**
 * Update package in the store
 * @param {string} id - Package instance ID
 * @param {function} updater - update function
 */
function updateItem(id, updater) {
  return new Promise((resolve, reject) => {
    return instance.session.then(db => {
      const obj = db.transaction(db.name, 'readwrite')
        .objectStore(db.name);
      const req = obj.get(id);
      req.onerror = event => reject(event);
      req.onsuccess = event => {
        const res = event.target.result;
        updater(res);
        const upd = obj.put(res);
        upd.onsuccess = () => resolve();
        upd.onerror = event => reject(event);
      };
    });
  });
}


/**
 * Delete a package
 * @param {string} id - Package instance ID
 */
function deleteItem(id) {
  return new Promise((resolve, reject) => {
    return instance.session.then(db => {
      const req = db.transaction(db.name, 'readwrite')
        .objectStore(db.name).delete(id);
      req.onerror = event => reject(event);
      req.onsuccess = () => resolve();
    });
  });
}


/**
 * Returns a view
 * @param {string} id - Package instance ID
 * @param {string} viewID - view ID
 * @return {array} view objects
 */
async function getSnapshot(id, viewID) {
  const session = await getItem(id);
  return session.snapshot.find(e => e.viewID === viewID);
}


/**
 * Append a view next to a specific view
 * @param {string} id - Package instance ID
 * @param {string} viewID - view ID
 * @param {object} viewObj - view object
 */
function appendView(id, viewID, viewObj) {
  return updateItem(id, item => {
    const pos = item.views.findIndex(e => e.viewID === viewID);
    item.views.splice(pos + 1, 0, viewObj);
  });
}


/**
 * Update view
 * @param {string} id - Package instance ID
 * @param {string} viewID - view ID
 * @param {object} viewObj - view object or update function
 */
function updateView(id, viewID, viewObj) {
  return updateItem(id, item => {
    const pos = item.views.findIndex(e => e.viewID === viewID);
    if (_.isFunction(viewObj)) {
      viewObj(item.views[pos]);
    } else {
      item.views[pos] = viewObj;
    }
  });
}


/**
 * Delete a data object from the store
 * @param {string} id - Package instance ID
 * @return {integer} - number of deleted items
 */
function deleteView(id, viewID) {
  return updateItem(id, item => {
    const pos = item.views.findIndex(e => e.viewID === viewID);
    item.views.splice(pos, 1);
    // prune orphaned collections
    const bin = {};
    item.dataset.forEach(e => { bin[e.collectionID] = 0; });
    item.views.forEach(view => {
      ['rows', 'items', 'nodes', 'edges']
        .filter(e => view.hasOwnProperty(e))
        .forEach(e => { bin[view[e]] += 1; });
    });
    Object.entries(bin).forEach(entry => {
      if (!entry[1]) {
        const i = item.dataset.findIndex(e => e.collectionID === entry[0]);
        item.dataset.splice(i, 1);
      }
    });
  });
}


/**
 * Returns all collections in the store
 * @return {array} Collection objects
 */
function getAllCollections() {
  return getAllItems()
    .then(items => _.flatten(
      items.map(item => {
        return item.dataset.map(coll => {
          coll.instance = item.id;
          return coll;
        });
      })
    ));
}


/**
 * Returns a collection
 * @param {string} id - Package instance ID
 * @param {string} collID - Collection ID
 * @return {array} Collection objects
 */
function getCollection(id, collID) {
  return getItem(id)
    .then(pkg => pkg.dataset.find(e => e.collectionID === collID));
}


function addCollection(id, collID, collObj) {
  return updateItem(id, item => {
    item.dataset.push(collObj);
  });
}

/**
 * Update collection
 * @param {string} id - Package instance ID
 * @param {string} collID - Collection ID
 * @param {object} collObj - Collection object or update function
 */
function updateCollection(id, collID, collObj) {
  return updateItem(id, item => {
    const pos = item.dataset.findIndex(e => e.collectionID === collID);
    if (_.isFunction(collObj)) {
      collObj(item.dataset[pos]);
    } else {
      item.dataset[pos] = collObj;
    }
  });
}


/**
 * Insert a data object to the store
 * @param {object} data - data
 * @return {string} - id if sucessfully added
 */
function importItem(data) {
  // Legacy format converter
  data = legacy.convertPackage(data);

  const now = new Date();
  data.id = misc.uuidv4().slice(0, 8);
  data.sessionStarted = now.toString();
  return putItem(data);
}




/**
 * Get asset by a key
 * @param {string} key - key
 * @return {array} asset object (if not found, resolve with undefined)
 */
function getConfig(key) {
  return new Promise((resolve, reject) => {
    return instance.assets.then(db => {
      const req = db.transaction(db.name)
        .objectStore(db.name).get(key);
      req.onsuccess = event => {
        const undef = event.target.result === undefined;
        const value = undef ? undefined : event.target.result.value;
        resolve(value);
      };
      req.onerror = event => reject(event);
    });
  });
}

/**
 * Put asset object with a key
 * @param {string} key - key
 * @param {string} content - asset to store
 */
function putConfig(key, content) {
  return new Promise((resolve, reject) => {
    return instance.assets.then(db => {
      const obj = db.transaction(db.name, 'readwrite')
        .objectStore(db.name);
      const req = obj.put({key: key, value: content});
      req.onerror = event => reject(event);
      req.onsuccess = () => resolve();
    });
  });
}


export default {
  clear, clearAll, getAllItems, getItem, updateItem, deleteItem,
  getView, appendView, updateView, deleteView,
  getAllCollections, getCollection, addCollection, updateCollection,
  importItem, newNetwork,
  getAsset, putAsset
};
