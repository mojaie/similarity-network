var app = (function (d3, _) {
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

  const statusConv = {
    Queued: 'ready',
    'In progress': 'running',
    Aborting: 'running',
    Aborted: 'aborted',
    Completed: 'done',
    Failure: 'failure'
  };

  const dataTypeConv = {
    datatable: 'nodes',
    connection: 'edges'
  };

  function v07_to_v08_nodes(json) {
    const fields = json.columns.map(e => {
      if (e.sort === 'numeric') {
        e.format = 'numeric';
      } else if (e.sort === 'text') {
        e.format = 'text';
      } else if (e.sort === 'none') {
        e.format = 'raw';
      }
      return e;
    });
    return {
      id: json.id,
      name: json.name,
      dataType: dataTypeConv[json.format],
      schemaVersion: 0.8,
      revision: 0,
      status: statusConv[json.status],
      fields: fields,
      records: json.records,
      query: json.query,
      taskCount: json.searchCount,
      doneCount: json.searchDoneCount | json.searchCount,
      resultCount: json.recordCount,
      progress: json.progress | 100,
      execTime: json.execTime,
      created: json.startDate | json.responseDate,
    };
  }

  function v07_to_v08_edges(json, nodeFields) {
    const snp = {
      fieldTransform: json.snapshot.fieldTransform,
      nodePositions: json.snapshot.nodePositions,
      nodeColor: {},
      nodeSize: {},
      nodeLabel: {},
      edge: {}
    };
    if (json.snapshot.hasOwnProperty('nodeColor')) {
      snp.nodeColor.id = json.snapshot.nodeColor.id;
      snp.nodeColor.scale = json.snapshot.nodeColor.scale;
      snp.nodeColor.field = nodeFields.find(e => e.key === json.snapshot.nodeColor.column);
    } else {
      snp.nodeColor = {
        id: 'color', field: nodeFields[0],
        scale: {scale: 'linear', domain: [0, 1], range: ['black', 'white'], unknown: 'gray'}
      };
    }
    if (json.snapshot.hasOwnProperty('nodeSize')) {
      snp.nodeSize.id = json.snapshot.nodeSize.id;
      snp.nodeSize.scale = json.snapshot.nodeSize.scale;
      snp.nodeSize.field = nodeFields.find(e => e.key === json.snapshot.nodeSize.column);
    } else {
      snp.nodeSize = {
        id: 'size', field: nodeFields[0],
        scale: {scale: 'linear', domain: [0, 1], range: [20, 20], unknown: 20}
      };
    }
    if (json.snapshot.hasOwnProperty('nodeLabel')) {
      snp.nodeLabel.id = json.snapshot.nodeLabel.id;
      snp.nodeLabel.size = json.snapshot.nodeLabel.size;
      snp.nodeLabel.text = json.snapshot.nodeLabel.text;
      snp.nodeLabel.visible = json.snapshot.nodeLabel.visible;
      snp.nodeLabel.scale = json.snapshot.nodeLabel.scale;
      snp.nodeLabel.field = nodeFields.find(e => e.key === json.snapshot.nodeLabel.column);
    } else {
      snp.nodeLabel = {
        id: 'label', size: 12, text: 'index', visible: false, field: nodeFields[0],
        scale: {scale: 'linear', domain: [0, 1], range: ['black', 'white'], unknown: 'gray'}
      };
    }
    if (json.snapshot.hasOwnProperty('nodeContent')) {
      snp.nodeContent = json.snapshot.nodeContent;
    } else {
      snp.nodeContent = {structure: {visible: false}};
    }
    if (json.snapshot.hasOwnProperty('edge')) {
      snp.edge = json.snapshot.edge;
    } else {
      snp.edge = {
        id: 'label', label: {size: 10, visible: false}, visible: true,
        scale: {scale: 'linear', domain: [0, 1], range: [5, 5], unknown: 5}
      };
    }
    return {
      id: json.id,
      name: json.name,
      dataType: dataTypeConv[json.format],
      schemaVersion: 0.8,
      revision: 0,
      reference: {
        nodes: json.nodeTableId
      },
      status: statusConv[json.status],
      fields: [
        {'key': 'source'},
        {'key': 'target'},
        {'key': 'weight'}
      ],
      records: json.records,
      query: json.query,
      networkThreshold: json.networkThreshold,
      taskCount: json.searchCount,
      doneCount: json.searchDoneCount | json.searchCount,
      resultCount: json.recordCount,
      progress: json.progress | 100,
      execTime: json.execTime,
      created: json.startDate | json.responseDate,
      snapshot: snp
    };
  }


  function v08_nodes(json) {
    json.records.forEach((e, i) => {
      e.index = i;
      e.structure = e._structure;
      delete e._index;
      delete e._structure;
    });
    json.fields.forEach(e => {
      if (e.key === '_index') e.key = 'index';
      if (e.key === '_structure') e.key = 'structure';
      if (e.sort === 'numeric') e.format = 'numeric';
      if (e.sort === 'text') e.format = 'text';
      if (e.sort === 'none') e.format = 'raw';
    });
    return json;
  }

  function v08_graph(json) {
    if (!json.edges.hasOwnProperty('reference')) { // ver0.8.0-0.8.1
      json.edges.reference = {nodes: json.edges.nodesID};
    }
    if (json.nodes.fields.find(e => e.key === '_index')) {
      const idx_converter = {};
      json.nodes.records.forEach((e, i) => {
          e.index = i;
          e.structure = e._structure;
          idx_converter[e._index] = e.index;
          delete e._index;
          delete e._structure;
      });
      json.edges.records.forEach(e => {
          e.source = idx_converter[e.source];
          e.target = idx_converter[e.target];
      });
      json.nodes.fields.forEach(e => {
        if (e.key === '_index') e.key = 'index';
        if (e.key === '_structure') e.key = 'structure';
        if (e.sort === 'numeric') e.format = 'numeric';
        if (e.sort === 'text') e.format = 'text';
        if (e.sort === 'none') e.format = 'raw';
      });
    }
    return json;
  }

  function v10_nodes(json) {
    return {
      id: json.id,
      name: json.name,
      dataType: json.dataType,
      schemaVersion: '0.10',
      revision: json.revision,
      status: json.status,
      fields: json.fields,
      records: json.records,
      query: json.query,
      progress: json.progress,
      execTime: json.execTime,
      created: json.created,
      reference: {}
    };
  }


  function v10_edges(json) {
    const snapshot = {
      networkThreshold: json.networkThreshold
    };
    snapshot.nodeContentVisible = json.snapshot.nodeContent.structure.visible;
    snapshot.nodeColor = json.snapshot.nodeColor.scale || {};
    if (snapshot.nodeColor.field) {
      snapshot.nodeColor.field = json.snapshot.nodeColor.field.key;
      if (snapshot.nodeColor.field === '_index') {
        snapshot.nodeColor.field = 'index';
      }
    }
    if (snapshot.nodeColor.scale === 'ordinal') {
      snapshot.nodeColor.range = d3__default["default"].schemeCategory20;
    }
    snapshot.nodeSize = json.snapshot.nodeSize.scale || {};
    if (json.snapshot.nodeSize.field) {
      snapshot.nodeSize.field = json.snapshot.nodeSize.field.key;
      if (snapshot.nodeSize.field === '_index') {
        snapshot.nodeSize.field = 'index';
      }
    }
    snapshot.nodeLabel = {};
    if (json.snapshot.nodeLabel.text) {
      snapshot.nodeLabel.text = json.snapshot.nodeLabel.text.key;
      if (snapshot.nodeLabel.text === '_index') {
        snapshot.nodeLabel.text = 'index';
      }
    }
    snapshot.nodeLabel.size = json.snapshot.nodeLabel.size;
    snapshot.nodeLabel.visible = json.snapshot.nodeLabel.visible;
    snapshot.nodeLabelColor = json.snapshot.nodeLabel.scale || {};
    if (json.snapshot.nodeLabel.field) {
      snapshot.nodeLabelColor.field = json.snapshot.nodeLabel.field.key;
      if (snapshot.nodeLabelColor.field === '_index') {
        snapshot.nodeLabelColor.field = 'index';
      }
    }
    if (snapshot.nodeLabelColor.scale === 'ordinal') {
      snapshot.nodeLabelColor.range = d3__default["default"].schemeCategory20;
    }
    snapshot.edgeVisible = json.snapshot.edge.visible;
    snapshot.edgeWidth = json.snapshot.edge.scale || {};
    snapshot.edgeLabel = {};
    snapshot.edgeLabel.size = json.snapshot.edge.label.size;
    snapshot.edgeLabel.visible = json.snapshot.edge.label.visible;
    snapshot.networkThreshold = json.networkThreshold || json.query.threshold;
    snapshot.coords = json.snapshot.nodePositions;
    // TODO: when created date is lost
    return {
      id: json.id,
      name: json.name,
      dataType: json.dataType,
      schemaVersion: '0.10',
      revision: json.revision,
      status: json.status,
      fields: json.fields,
      records: json.records,
      query: {params: json.query},
      progress: json.progress,
      execTime: json.execTime,
      created: json.created,
      snapshot: snapshot,
      reference: json.reference
    };
  }

  function convertTable(json) {
    let data = json;
    if (!(data.hasOwnProperty('schemaVersion') || data.hasOwnProperty('$schema'))) { // v0.7
      data = v07_to_v08_nodes(data);
    }
    if (data.schemaVersion == '0.8') {
      data = v08_nodes(data);
      data = v10_nodes(data);
    }
    if (!data.hasOwnProperty('$schema')) {
      delete data.schemaVersion;
      delete data.revision;
      data.$schema = "https://mojaie.github.io/flashflood/_static/specs/job_result_v1.0.json";
    }
    data.fields.forEach(e => {
      if (e.key === 'structure') {
        e.format = 'svg';
      }
      delete e.width;
      delete e.height;
    });
    return data;
  }

  function convertNetwork(json) {
    let data = json;
    if (!(data.edges.hasOwnProperty('schemaVersion') || data.edges.hasOwnProperty('$schema'))) { // v0.7
      data.nodes = v07_to_v08_nodes(data.nodes);
      data.edges = v07_to_v08_edges(data.edges, data.nodes.fields);
    }
    if (data.edges.schemaVersion == '0.8' || data.edges.schemaVersion === 0.1) {  // wrong conversion of '0.10'
      data = v08_graph(data);
      data.nodes = v10_nodes(data.nodes);
      data.edges = v10_edges(data.edges);
    }
    if (!data.edges.hasOwnProperty('$schema')) {
      delete data.nodes.schemaVersion;
      delete data.edges.schemaVersion;
      delete data.nodes.revision;
      delete data.edges.revision;
      data.nodes.$schema = "https://mojaie.github.io/flashflood/_static/specs/job_result_v1.0.json";
      data.edges.$schema = "https://mojaie.github.io/flashflood/_static/specs/job_result_v1.0.json";
    }
    return data;
  }


  function convertPackage(json) {
    let specs = {};
    if (!json.hasOwnProperty('views')) {
      const now = new Date();
      const isNW = json.hasOwnProperty('edges');
      const data = isNW ? convertNetwork(json) : convertTable(json);
      const nodes = isNW ? data.nodes : data;
      specs = {
        $schema: "https://mojaie.github.io/kiwiii/specs/package_v1.0.json",
        name: data.edges.name,
        views: [],
        dataset: []
      };
      specs.dataset.push({
        $schema: "https://mojaie.github.io/kiwiii/specs/collection_v1.0.json",
        collectionID: nodes.id,
        name: nodes.name,
        contents: [{
          $schema: nodes.$schema,
          workflowID: nodes.reference.workflow,
          name: nodes.name,
          fields: nodes.fields,
          records: nodes.records,
          created: nodes.created,
          status: nodes.status,
          query: nodes.query,
          execTime: nodes.execTime,
          progress: nodes.progress
        }]
      });
      specs.views.push({
        $schema: "https://mojaie.github.io/kiwiii/specs/datagrid_v1.0.json",
        viewID: nodes.id,
        name: nodes.name,
        viewType: "datagrid",
        rows: nodes.id,
        fields: nodes.fields,
        sortOrder: null,
        filterText: null,
        checkpoints: [{
          type: 'convert',
          date: now.toString(),
          description: 'converted from legacy format'
        }]
      });
      if (isNW) {
        specs.dataset.push({
          $schema: "https://mojaie.github.io/kiwiii/specs/collection_v1.0.json",
          collectionID: data.edges.id,
          name: data.edges.name,
          contents: [{
            $schema: data.edges.$schema,
            workflowID: data.edges.reference.workflow,
            name: data.edges.name,
            fields: data.edges.fields,
            records: data.edges.records,
            created: data.edges.created,
            status: data.edges.status,
            query: data.edges.query,
            execTime: data.edges.execTime,
            progress: data.edges.progress
          }]
        });
        specs.views.push({
          $schema: "https://mojaie.github.io/kiwiii/specs/network_v1.0.json",
          viewID: data.edges.id,
          name: data.edges.name,
          viewType: "network",
          nodes: nodes.id,
          edges: data.edges.id,
          nodeColor: data.edges.snapshot.nodeColor,
          nodeSize: data.edges.snapshot.nodeSize,
          nodeLabel: data.edges.snapshot.nodeLabel,
          nodeLabelColor: data.edges.snapshot.nodeLabelColor,
          edgeWidth: data.edges.snapshot.edgeWidth,
          edgeLabel: data.edges.snapshot.edgeLabel,
          networkThreshold: data.edges.snapshot.networkThreshold,
          networkThresholdCutoff: data.edges.snapshot.networkThresholdCutoff,
          fieldTransform: data.edges.snapshot.fieldTransform,
          coords: data.edges.snapshot.coords,
          checkpoints: [{
            type: 'convert',
            date: now.toString(),
            description: 'converted from legacy format'
          }]
        });
      }
      specs.views.filter(e => e.viewType === 'network')
        .forEach(view => {
          view.minConnThld = view.networkThresholdCutoff;
          view.currentConnThld = view.networkThreshold;
          if (view.hasOwnProperty('nodeLabel')) {
            view.nodeLabel.field = view.nodeLabel.text;
          }
          if (view.hasOwnProperty('edgeLabel')) {
            view.edgeLabel.field = 'weight';
          }
          if (view.hasOwnProperty('edgeWidth')) {
            view.edgeWidth.field = 'weight';
          }
        });
    } else {
      specs = json;
    }
    specs.views.filter(e => e.viewType === 'network')
      .forEach(view => {
        if (!view.nodeColor.field) { view.nodeColor.field = 'index' ;}
        if (!view.nodeSize.field) { view.nodeSize.field = 'index' ;}
        if (!view.nodeLabel.field) { view.nodeLabel.field = 'index' ;}
        if (!view.nodeLabelColor.field) { view.nodeLabelColor.field = 'index' ;}
        if (!view.edgeColor) {
          view.edgeColor = {
            field: 'weight', color: 'monogray',
            scale: 'linear', domain: [0, 1],
            range: ['#999999', '#999999'], unknown: '#cccccc'
          };
        } else if (!view.edgeColor.field) { view.edgeColor.field = 'weight' ;}
        if (!view.edgeWidth.field) { view.edgeWidth.field = 'weight' ;}
        if (!view.edgeLabel.field) { view.edgeLabel.field = 'weight' ;}
        if (!view.edgeLabelColor) {
          view.edgeLabelColor = {
            field: 'weight', color: 'monoblack',
            scale: 'linear', domain: [1, 1],
            range: ['#333333', '#333333'], unknown: '#cccccc'
          };
        } else if (!view.edgeLabelColor.field) { view.edgeLabelColor.field = 'weight' ;}
      });
    return specs;
  }


  var legacy = {
    convertPackage
  };

  // Increment versions if IDB schema has updated.
  const pkgStoreVersion = 2;
  const assetStoreVersion = 1;


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
    pkgs: connect("Packages", pkgStoreVersion, db => {
      db.createObjectStore("Packages", {keyPath: 'id'});
    }),
    assets: connect("Assets", assetStoreVersion, db => {
      db.createObjectStore("Assets", {keyPath: 'key'});
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
    return Promise.all([clear('pkgs'), clear('assets')]);
  }


  /**
   * Returns all packages
   * @return {Promise} Promise of list of packages
   */
  function getAllItems() {
    return new Promise(resolve => {
      const res = [];
      return instance.pkgs.then(db => {
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
    });
  }


  /**
   * Get packages by instance ID
   * @param {string} id - Package instance ID
   * @return {array} data store object
   */
  function getItem(id) {
    return new Promise((resolve, reject) => {
      return instance.pkgs.then(db => {
        const req = db.transaction(db.name)
          .objectStore(db.name).get(id);
        req.onsuccess = event => resolve(event.target.result);
        req.onerror = event => reject(event);
      });
    });
  }


  /**
   * Put data object in the store
   * @param {string} value - value to store
   */
  function putItem(value) {
    return new Promise((resolve, reject) => {
      return instance.pkgs.then(db => {
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
      return instance.pkgs.then(db => {
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
      return instance.pkgs.then(db => {
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
  function getView(id, viewID) {
    return getItem(id)
      .then(pkg => pkg.views.find(e => e.viewID === viewID));
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
      if (___default["default"].isFunction(viewObj)) {
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
      .then(items => ___default["default"].flatten(
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
      if (___default["default"].isFunction(collObj)) {
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
   * Store new network view
   * @param {string} instance - Package instance ID
   * @param {string} nodesID - ID of nodes collection
   * @param {string} nodesName - Name of nodes collection
   * @param {object} response - Response object
   */
  function newNetwork(instance, nodesID, nodesName, response) {
    const viewID = misc.uuidv4().slice(0, 8);
    const edgesID = response.workflowID.slice(0, 8);
    return updateItem(instance, item => {
      item.views.push({
        $schema: "https://mojaie.github.io/kiwiii/specs/network_v1.0.json",
        viewID: viewID,
        name: `${nodesName}_${response.name}`,
        viewType: 'network',
        nodes: nodesID,
        edges: edgesID,
        minConnThld: response.query.params.threshold
      });
      item.dataset.push({
        $schema: "https://mojaie.github.io/kiwiii/specs/collection_v1.0.json",
        collectionID: edgesID,
        name: response.name,
        contents: [response]
      });
    }).then(() => viewID);
  }


  /**
   * Get asset by a key
   * @param {string} key - key
   * @return {array} asset object (if not found, resolve with undefined)
   */
  function getAsset(key) {
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
  function putAsset(key, content) {
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


  var idb = {
    clear, clearAll, getAllItems, getItem, updateItem, deleteItem,
    getView, appendView, updateView, deleteView,
    getAllCollections, getCollection, addCollection, updateCollection,
    importItem, newNetwork,
    getAsset, putAsset
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

  const iconBaseURL = '../assets/icon/';


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

  const colorScales = [
    {key: 'monoblack', type: 'monocolor', colors: ['#333333'], unknown: '#333333'},
    {key: 'monogray', type: 'monocolor', colors: ['#cccccc'], unknown: '#cccccc'},
    {key: 'nodeDefault', type: 'monocolor', colors: ['#7fffd4'], unknown: '#7fffd4'},
    {key: 'aquamarine', type: 'bicolor',
     colors: ['#778899', '#7fffd4'], unknown: '#f0f0f0'},
    {key: 'chartreuse', type: 'bicolor',
     colors: ['#778899', '#7fff00'], unknown: '#f0f0f0'},
    {key: 'salmon', type: 'bicolor',
     colors: ['#778899', '#fa8072'], unknown: '#f0f0f0'},
    {key: 'violet', type: 'bicolor',
     colors: ['#778899', '#ee82ee'], unknown: '#f0f0f0'},
    {key: 'temperature', type: 'tricolor',
     colors: ['#87ceeb', '#fff5ee', '#fa8072'], unknown: '#f0f0f0'},
    {key: 'spectrum', type: 'tricolor',
     colors: ['#6495ed', '#ccff66', '#ffa500'], unknown: '#f0f0f0'},
    {key: 'category10', type: 'categorical',
     colors: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
      '#b3de69','#fccde5','#bc80bd','#ccebc5'], unknown: '#f0f0f0'},
    {key: 'cbsafe', type: 'categorical',
     colors: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5',
     '#80cdc1','#35978f','#01665e','#003c30'], unknown: '#f0f0f0'},
    {key: 'category20', type: 'categorical',
     colors: d3__default["default"].schemePaired.concat(d3__default["default"].schemeSet2), unknown: '#f0f0f0'},
    {key: 'category40', type: 'categorical',
     colors: d3__default["default"].schemePaired.concat(d3__default["default"].schemePastel2, d3__default["default"].schemeSet2, d3__default["default"].schemeSet3),
     unknown: '#f0f0f0'},
    {key: 'custom', type: 'custom', colors: ['#ffffff'], text: 'custom'}
  ];


  const types = [
    {key: 'linear', name: 'Linear', func: d3__default["default"].scaleLinear},
    {key: 'log', name: 'Log', func: d3__default["default"].scaleLog},
    {key: 'quantize', name: 'Quantize', func: d3__default["default"].scaleQuantize},
    {key: 'ordinal', name: 'Ordinal', func: d3__default["default"].scaleOrdinal}
  ];


  function scaleFunction(state) {
    const cscale = colorScales.find(e => e.key === state.color);
    let range;
    let unknown;
    if (cscale && cscale.key !== 'custom') {
        range = cscale.colors;
        unknown = cscale.unknown;
    } else {
      range = state.range;
      unknown = state.unknown;
    }
    let domain = null;
    if (range.length === 3) {
      const mid = (parseFloat(state.domain[0]) + parseFloat(state.domain[1])) / 2;
      domain = [state.domain[0], mid, state.domain[1]];
    } else {
      domain = state.domain;
    }
    // Build
    let scaleFunc = types.find(e => e.key === state.scale).func();
    scaleFunc = scaleFunc.domain(domain);
    scaleFunc = scaleFunc.range(range);
    if (['linear', 'log'].includes(state.scale)) {
      scaleFunc = scaleFunc.clamp(true);
    }

    return d => {
      // Sanitize
      if (d === '' || typeof d === 'undefined' || d === null) {
        return unknown;  // invalid values
      }
      if (['linear', 'log'].includes(state.scale) && parseFloat(d) != d) {
        return unknown;  // texts
      }
      if (state.scale === 'log' && d <= 0) {
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
    colorScales, types, scaleFunction, isD3Format
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
    selection
      .style('width', '100%')
      .style('height', '100%');
    selection.select('.view').remove(); // Clean up
    selection.append('svg')
      .classed('view', true);
    selection.call(resize, state);
  }


  function view(selection, state) {
    selection
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('pointer-events', 'all')
      .attr('viewBox', `0 0 ${state.viewBox.right} ${state.viewBox.bottom}`)
      .style('width', '100%')
      .style('height', '100%');

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
    transform, resize, viewFrame, view
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

  /**
   * Convert single field mapping to multi field mapping
   * @param {object} mapping - single field mapping
   * @return {object} multi field mapping
   */
  function singleToMulti(mapping) {
    const newMapping = {};
    Object.entries(mapping.mapping).forEach(m => {
      newMapping[m[0]] = [m[1]];
    });
    return {
      created: mapping.created,
      fields: [mapping.field],
      key: mapping.key,
      mapping: newMapping
    };
  }


  /**
   * Convert field mapping to table
   * @param {object} mapping - field mapping
   * @return {object} table object
   */
  function mappingToTable(mapping) {
    const mp = mapping.hasOwnProperty('field') ? singleToMulti(mapping) : mapping;
    const keyField = {key: mp.key, format: 'text'};
    const data = {
      fields: [keyField].concat(mp.fields),
      records: Object.entries(mp.mapping).map(entry => {
        const rcd = {};
        rcd[mp.key] = entry[0];
        mp.fields.forEach((f, i) => {
          rcd[f.key] = entry[1][i];
        });
        return rcd;
      })
    };
    return data;
  }


  /**
   * Convert table to field mapping
   * @param {object} table - table
   * @param {object} key - key
   * @return {object} field mapping
   */
  function tableToMapping(table, key, ignore=['index']) {
    const now = new Date();
    const mapping = {
      created: now.toString(),
      fields: table.fields.filter(e => e.key !== key)
        .filter(e => !ignore.includes(e.key)),
      key: key,
      mapping: {}
    };
    table.records.forEach(row => {
      mapping.mapping[row[key]] = mapping.fields.map(e => row[e.key]);
    });
    return mapping;
  }


  /**
   * Convert csv text to field mapping
   * @param {string} csvString - csv data text
   * @return {object} field mapping
   */
  function csvToMapping(csvString) {
    const lines = csvString.split(/\n|\r|\r\n/);
    const header = lines.shift().split(',');
    const key = header.shift();
    const now = new Date();
    const headerIdx = [];
    const fields = [];
    header.forEach((h, i) => {
      if (h === '') return;
      headerIdx.push(i);
      fields.push({key: h, format: 'text'});
    });
    const mapping = {
      created: now.toString(),
      fields: fields,
      key: key,
      mapping: {}
    };
    lines.forEach(line => {
      const values = line.split(',');
      const k = values.shift();
      mapping.mapping[k] = Array(headerIdx.length);
      headerIdx.forEach(i => {
        mapping.mapping[k][i] = values[i];
      });
    });
    return mapping;
  }


  /**
   * Apply mapping to the data (in-place)
   * @param {object} data - datatable JSON
   * @param {object} mapping - mapping JSON
   * @return {undefined} undefined
   */
  function apply(data, mapping) {
    const mp = mapping.hasOwnProperty('field') ? singleToMulti(mapping) : mapping;
    data.records
      .filter(rcd => mp.mapping.hasOwnProperty(rcd[mp.key]))
      .forEach(rcd => {
        mp.fields.forEach((fd, i) => {
          rcd[fd.key] = mp.mapping[rcd[mp.key]][i];
        });
      });
    data.fields =  ___default["default"](data.fields)
      .concat(mp.fields)
      .uniqBy('key')
      .value();
  }

  var mapper = {
    singleToMulti, mappingToTable, tableToMapping, csvToMapping, apply
  };

  class Collection {
    /**
     * Create Collection from a flashflood response datatable
     * If data is not specified, put datatables later by this.append(data)
     * @param {object} coll - Collection or response object
     */
    constructor(coll) {
      // Settings
      this.autoIndex = 'index';  // enumerate records

      this.collectionID = coll.collectionID || null;
      this.instance = coll.instance || null;
      this.name = coll.name || null;
      if (coll.records) {
        this.contents = [coll];
        this.fields = [];
      } else {
        this.contents = coll.contents;
        this.fields = coll.fields || [];
      }
      this.contents.forEach(content => {
        content.fields.forEach(e => this.addField(e));
      });
    }

    /**
     * Add fields
     * @param {array} fs - list of fields
     */
    addField(field) {
      if (this.fields.find(e => e.key === field.key)) return;
      if (!field.hasOwnProperty('name')) field.name = field.key;
      if (!field.hasOwnProperty('visible')) field.visible = true;
      if (field.hasOwnProperty('d3_format')) field.format = 'd3_format';
      if (!field.hasOwnProperty('format')) field.format = 'raw';
      this.fields.push(field);
    }

    /**
     * Update fields properties
     * @param {array} fs - list of fields
     */
    updateFields(fs) {
      this.fields = [];
      fs.forEach(e => this.addField(e));
    }

    /**
     * Join fields
     * @param {object} mapping - column mapper object
     */
    joinFields(mapping) {
      this.contents.forEach(c => {
        mapper.apply(c, mapping);
      });
      if (mapping.hasOwnProperty('fields')) {
        mapping.fields.forEach(e => this.addField(e));
      } else {
        this.addField(mapping.field);
      }
    }

    /**
     * Apply function to the original data records
     * new fields should be manually added by Collection.addField
     * @param {function} func - function to be applied
     */
    apply(func) {
      this.contents.forEach(content => {
        content.records.forEach(rcd => {
          func(rcd);
        });
      });
    }

    /**
     * Return all records of the collection
     * @return {array} records
     */
    records() {
      return ___default["default"].flatten(this.contents.map(e => e.records));
    }


    /**
     * Return total number of records
     * @return {float} total number of records
     */
    size() {
      return ___default["default"].sum(this.contents.map(e => e.records.length));
    }


    /**
     * Export collection object as JSON
     * @return {object} collection JSON
     */
    // TODO: new method that exports only visible fields
    export() {
      return {
        $schema: "https://mojaie.github.io/kiwiii/specs/collection_v1.0.json",
        collectionID: this.collectionID,
        name: this.name,
        fields: this.fields,
        contents: this.contents
      };
    }
  }

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
    constructor(view, nodes, edges) {
      super(1200, 1200, view.fieldTransform);

      /* Settings */

      // Focused view mode (num of nodes displayed are less than the thld)
      // Show node contents
      // Disable smooth transition
      this.focusedViewThreshold = 100;
      this.enableFocusedView = true;
      this.focusedView = false;
      // Overlook view mode (num of nodes displayed are less than the thld)
      // Hide edges
      this.overlookViewThreshold = 500;
      this.enableOverlookView = true;
      this.overlookView = false;

      // Legend orientation
      this.legendOrient = 'top-left';

      /* Attributes */

      this.viewID = view.viewID || null;
      this.instance = view.instance || null;
      this.name = view.name;

      this.nodes = new Collection(nodes);
      this.edges = new Collection(edges);

      /* Appearance */
      const defaultNodeField = 'index';
      const defaultEdgeField = 'weight';

      this.nodeColor = {
        field: defaultNodeField, color: 'nodeDefault',
        scale: 'linear', domain: [0, 1],
        range: ['#7fffd4', '#7fffd4'], unknown: '#7fffd4',
        legend: true
      };
      Object.assign(this.nodeColor, view.nodeColor || {});

      this.nodeSize = {
        field: defaultNodeField, scale: 'linear', domain: [1, 1],
        range: [40, 40], unknown: 40, legend: false
      };
      Object.assign(this.nodeSize, view.nodeSize || {});

      this.nodeLabel = {
        field: defaultNodeField, size: 20, visible: false
      };
      Object.assign(this.nodeLabel, view.nodeLabel || {});

      this.nodeLabelColor = {
        field: defaultNodeField, color: 'monoblack',
        scale: 'linear', domain: [1, 1],
        range: ['#333333', '#333333'], unknown: '#cccccc',
        legend: false
      };
      Object.assign(this.nodeLabelColor, view.nodeLabelColor || {});

      this.edgeColor = {
        field: defaultEdgeField, color: 'monogray',
        scale: 'linear', domain: [0, 1],
        range: ['#999999', '#999999'], unknown: '#cccccc'
      };
      Object.assign(this.edgeColor, view.edgeColor || {});

      this.edgeWidth = {
        field: defaultEdgeField, scale: 'linear', domain: [0.5, 1],
        range: [10, 10], unknown: 1
      };
      Object.assign(this.edgeWidth, view.edgeWidth || {});

      this.edgeLabel = {
        field: defaultEdgeField, size: 12, visible: false
      };
      Object.assign(this.edgeLabel, view.edgeLabel || {});

      this.edgeLabelColor = {
        field: defaultEdgeField, color: 'monoblack',
        scale: 'linear', domain: [1, 1],
        range: ['#333333', '#333333'], unknown: '#cccccc'
      };
      Object.assign(this.edgeLabelColor, view.edgeLabelColor || {});

      // Connection threshold
      this.connThldField = view.connThldField || defaultEdgeField;
      this.minConnThld = view.minConnThld;
      this.currentConnThld = view.currentConnThld || view.minConnThld;

      // Force
      this.coords = view.coords;
      this.forceActive = !this.coords;
      this.forceType = view.forceType || 'aggregate';

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

      // Working copies
      // D3.force does some destructive operations
      this.ns = null;
      this.es = null;
    }

    updateWorkingCopy() {
      if (this.ns) {
        this.coords = this.ns.map(e => ({x: e.x, y: e.y}));
      }
      this.ns = JSON.parse(JSON.stringify(this.nodes.records()));
      this.ns.forEach(n => { n.adjacency = []; });
      this.es = JSON.parse(JSON.stringify(this.edges.records()));
      this.es.forEach((e, i) => {
        e.num = i;  // e.index will be overwritten by d3-force
        this.ns[e.source].adjacency.push([e.target, i]);
        this.ns[e.target].adjacency.push([e.source, i]);
      });
      if (this.coords) {
        this.setAllCoords(this.coords);
      }
    }

    setBoundary() {
      const xs = this.ns.map(e => e.x);
      const ys = this.ns.map(e => e.y);
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
      this.ns[n].x = x;
      this.ns[n].y = y;
      this.ns[n].adjacency.forEach(e => {
        const nbr = e[0];
        const edge = e[1];
        if (n < nbr) {
          this.es[edge].sx = x;
          this.es[edge].sy = y;
        } else {
          this.es[edge].tx = x;
          this.es[edge].ty = y;
        }
      });
      this.setBoundary();
    }

    nodesToRender() {
      return this.ns.filter(
        e => e.y > this.focusArea.top && e.x > this.focusArea.left
          && e.y < this.focusArea.bottom && e.x < this.focusArea.right
      );
    }

    currentEdges() {
      return this.es.filter(e => e[this.connThldField] >= this.currentConnThld);
    }

    edgesToRender() {
      return this.currentEdges().filter(
        e => this.focusArea.top < Math.max(e.sy, e.ty)
          && this.focusArea.left < Math.max(e.sx, e.tx)
          && this.focusArea.bottom > Math.min(e.sy, e.ty)
          && this.focusArea.right > Math.min(e.sx, e.tx)
      );
    }

    save() {
      this.coords = this.ns.map(n => ({x: n.x, y: n.y}));
      return idb.updateItem(this.instance, item => {
        const ni = item.dataset
          .findIndex(e => e.collectionID === this.nodes.collectionID);
        item.dataset[ni] = this.nodes.export();
        const ei = item.dataset
          .findIndex(e => e.collectionID === this.edges.collectionID);
        item.dataset[ei] = this.edges.export();
        const vi = item.views
          .findIndex(e => e.viewID === this.viewID);
        item.views[vi] = this.export();
      });
    }

    export() {
      return {
        $schema: "https://mojaie.github.io/kiwiii/specs/network_v1.0.json",
        viewID: this.viewID,
        name: this.name,
        viewType: "network",
        nodes: this.nodes.collectionID,
        edges: this.edges.collectionID,
        nodeColor: this.nodeColor,
        nodeSize: this.nodeSize,
        nodeLabel: this.nodeLabel,
        nodeLabelColor: this.nodeLabelColor,
        edgeColor: this.edgeColor,
        edgeWidth: this.edgeWidth,
        edgeLabel: this.edgeLabel,
        edgeLabelColor: this.edgeLabelColor,
        connThldField: this.connThldField,
        currentConnThld: this.currentConnThld,
        minConnThld: this.minConnThld,
        fieldTransform: this.transform,
        coords: this.coords
      };
    }
  }

  /**
   * Render select box components
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function selectBox(selection, label) {
    selection
        .classed('form-group', true)
        .classed('form-row', true)
        .classed('align-items-center', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    selection.append('select')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('col-8', true)
        .on('input', function () {
          const valid = box.formValid(selection);
          selection.call(box.setValidity, valid);
        });
  }

  function updateSelectBoxOptions(selection, items) {
    const options = selection.select('select')
      .selectAll('option')
        .data(items, d => d.key);
    options.exit().remove();
    options.enter()
      .append('option')
        .attr('value', d => d.key)
        .text(d => d.name);
  }

  function selectedRecord(selection) {
    const value = box.formValue(selection);
    return selection.selectAll('select option').data()
        .find(e => e.key === value);
  }


  /**
   * Render select box components
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function checklistBox(selection, label) {
    // TODO: scroll
    selection
        .classed('form-group', true)
        .classed('form-row', true)
        .classed('align-items-center', true);
    const formLabel = selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label);
    formLabel.append('div')
        .call(badge$1.invalidFeedback);
    selection.append('ul')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('col-8', true);
  }

  function updateChecklistItems(selection, items) {
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
        .property('value', d => d.key);
    form.append('span')
        .text(d => d.name);
  }

  function checkRequired(selection) {
    selection.selectAll('input')
        .on('change', function () {
          const valid = anyChecked(selection);
          selection.call(setChecklistValidity, valid);
        });
  }

  function updateChecklistValues(selection, values) {
    selection.selectAll('input')
      .each(function (d) {
        d3__default["default"].select(this).property('checked', values.includes(d.key));
      });
    selection.call(setChecklistValidity, true);  // Clear validity state
  }

  function checklistValues(selection) {
    return selection.selectAll('input:checked').data().map(d => d.key);
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
        .classed('form-group', true)
        .classed('form-row', true)
        .classed('align-items-center', true);
    selection.append('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('col-4', true)
        .text(label || 'Colorscale');
    const form = selection.append('div')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .classed('col-8', true);
    const dropdown = form.append('div')
        .classed('btn-group', true)
        .classed('mr-1', true);
    dropdown.append('button')
        .classed('btn', true)
        .classed(`btn-light`, true)
        .classed('btn-sm', true)
        .classed('dropdown-toggle', true)
        .attr('data-toggle', 'dropdown');
    dropdown.append('div')
        .classed('dropdown-menu', true)
        .classed('py-0', true);
    form.append('span')
        .classed('selected', true);
  }

  function colorScaleBoxItems(selection, items) {
    const listitems = selection.select('.dropdown-menu')
      .selectAll('a')
        .data(items, d => d);
    listitems.exit().remove();
    listitems.enter()
      .append('a')
        .classed('dropdown-item', true)
        .classed('py-0', true)
        .attr('href', '#')
        .attr('title', d => d.key)
        .on('click', function (d) {
          selection.call(setSelectedColorScale, d);
          selection.dispatch('change', {bubbles: true});
        })
      .append('svg')
        .each(function (d) {
          d3__default["default"].select(this)
            .attr('viewBox', '0 0 100 10')
            .attr('preserveAspectRatio', 'none')
            .call(shape.colorBar[d.type], d.colors, d.text)
            .call(shape.setSize, 100, 10);
        });
  }

  function setSelectedColorScale(selection, item) {
    const selected = selection.select('.selected');
    selected.selectAll('svg').remove();
    selected.datum(item);  // Bind selected item record
    selected.append('svg')
        .attr('viewBox', '0 0 100 10')
        .attr('preserveAspectRatio', 'none')
        .call(shape.colorBar[item.type], item.colors, item.text)
        .call(shape.setSize, 100, 10);
  }

  function updateColorScaleBox(selection, key) {
    const data = selection.select('.dropdown-menu')
      .selectAll('a').data();
    const item = data.find(e => e.key === key);
    selection.call(setSelectedColorScale, item);
  }

  function colorScaleBoxValue(selection) {
    return selection.select('.selected').datum().key;
  }

  function colorScaleBoxItem(selection) {
    return selection.select('.selected').datum();
  }


  var lbox = {
    selectBox, updateSelectBoxOptions, selectedRecord,
    checklistBox, updateChecklistItems, checkRequired, updateChecklistValues,
    checklistValues, anyChecked, setChecklistValidity,
    colorScaleBox, colorScaleBoxItems, updateColorScaleBox,
    colorScaleBoxValue, colorScaleBoxItem
  };

  /**
   * Render range box components
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function rangeBox(selection, label) {
    selection
        .classed('form-row', true)
        .classed('form-group', true)
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
        .classed('mb-0', true);

    selection.selectAll('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('py-0', true);

    selection.selectAll('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .attr('type', 'number');

    selection.append('div')
        .classed('col-4', true);
    selection.append('div')
        .call(badge$1.invalidFeedback)
        .classed('col-8', true);
  }


  function linearRange(selection, min, max, step) {
    selection.selectAll('.min, .max')
        .attr('min', min || null)
        .attr('max', max || null)
        .attr('step', step || null)
        .attr('required', 'required')
        .on('input', function () {
          const valid = linearValid(this, step);
          d3__default["default"].select(this)
            .style('background-color', valid ? null : '#ffcccc');
          selection.select('.invalid-feedback')
            .style('display', linearRangeValid(selection) ? 'none': 'inherit');
        })
        .dispatch('input');
  }


  function logRange(selection) {
    selection.selectAll('.min, .max')
        .attr('required', 'required')
        .on('input', function () {
          const valid = logValid(this);
          d3__default["default"].select(this)
            .style('background-color', valid ? null : '#ffcccc');
          selection.select('.invalid-feedback')
            .style('display', logRangeValid(selection) ? 'none': 'inherit');
        })
        .dispatch('input');
  }


  function updateRangeValues(selection, range) {
    selection.select('.min').property('value', range[0]);
    selection.select('.max').property('value', range[1]);
    selection.selectAll('.min,.max')
        .dispatch('input', {bubbles: true});
  }


  function linearValid(node, step) {
    // If step is not specified, accept stepMismatch
    const stepm = step ? false : node.validity.stepMismatch;
    return  node.checkValidity() || stepm;
  }


  function linearRangeValid(selection) {
    const step = selection.select('.min').attr('step');
    const minValid = linearValid(selection.select('.min').node(), step);
    const maxValid = linearValid(selection.select('.max').node(), step);
    return minValid && maxValid;
  }


  function logValid(node) {
    // Accept stepMismatch
    const stepm = node.validity.stepMismatch;
    return (node.checkValidity() || stepm) && node.value > 0;
  }


  function logRangeValid(selection) {
    const minPos = logValid(selection.select('.min').node());
    const maxPos = logValid(selection.select('.max').node());
    return linearRangeValid(selection) && minPos && maxPos;
  }


  function rangeValues(selection) {
    return [
      selection.select('.min').property('value'),
      selection.select('.max').property('value')
    ];
  }


  /**
   * Render color scale box components
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function colorRangeBox(selection, label) {
    selection
        .classed('form-row', true)
        .classed('form-group', true)
        .classed('align-items-center', true);
    selection.append('div')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .text(label);

    const minBox = selection.append('div');
    minBox.append('label').text('min');
    minBox.append('input').classed('min', true);

    const midBox = selection.append('div');
    midBox.append('label').text('mid');
    midBox.append('input').classed('mid', true);

    const maxBox = selection.append('div');
    maxBox.append('label').text('max');
    maxBox.append('input').classed('max', true);

    selection.on('change', () => {
      // avoid update by mousemove on the colorpicker
      d3__default["default"].event.stopPropagation();
    });

    selection.selectAll('div')
        .classed('form-group', true)
        .classed('col-3', true)
        .classed('mb-0', true);

    selection.selectAll('label')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('py-0', true);

    selection.selectAll('input')
        .classed('form-control', true)
        .classed('form-control-sm', true)
        .attr('type', 'color');
  }


  function updateColorRangeValues(selection, range) {
    selection.select('.min').property('value', range[0]);
    selection.select('.mid').property('value', range[1]);
    selection.select('.max').property('value', range[2]);
  }


  function colorRangeValues(selection) {
    return [
      selection.select('.min').property('value'),
      selection.select('.mid').property('value'),
      selection.select('.max').property('value')
    ];
  }


  var rbox = {
    rangeBox, linearRange, logRange, updateRangeValues,
    rangeValues, linearRangeValid, logRangeValid,
    colorRangeBox, updateColorRangeValues, colorRangeValues
  };

  function dropdownFormGroup(selection, label) {
    const id = misc.uuidv4().slice(0, 8);
    selection.classed('mb-3', true)
      .append('div')
        .classed('form-group', true)
        .classed('form-row', true)
        .classed('justify-content-end', true)
      .append('button')
        .classed('btn', true)
        .classed('btn-sm', true)
        .classed('btn-outline-primary', true)
        .classed('dropdown-toggle', true)
        .attr('data-toggle', 'collapse')
        .attr('data-target', `#${id}-collapse`)
        .attr('aria-expanded', 'false')
        .attr('aria-controls', `${id}-collapse`)
        .text(label);
    selection.append('div')
        .classed('collapse', true)
        .attr('id', `${id}-collapse`)
      .append('div')
        .classed('card', true)
        .classed('card-body', true);
  }


  var dropdown = {
    dropdownFormGroup
  };

  /**
   * Render color range control box group
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function colorRangeGroup(selection, colorScales) {
    selection
        .classed('mb-3', true);
    selection.append('div')
        .classed('colorscale', true)
        .classed('mb-2', true)
        .call(lbox.colorScaleBox, 'Colorscale')
        .call(lbox.colorScaleBoxItems, colorScales);

    // Custom colorscale
    const collapse = selection.append('div')
        .call(dropdown.dropdownFormGroup, 'Custom color')
      .select('.card-body')
        .classed('p-2', true);

    const customColorRanges = [
      {key: 'continuous', name: 'Continuous'},
      {key: 'two-piece', name: 'Two-piece'}
    ];
    collapse.append('div')
        .classed('rangetype', true)
        .classed('mb-1', true)
        .call(lbox.selectBox, 'Range type')
        .call(lbox.updateSelectBoxOptions, customColorRanges);
    collapse.append('div')
        .classed('range', true)
        .classed('mb-1', true)
        .call(rbox.colorRangeBox, 'Range');
    collapse.append('div')
        .classed('unknown', true)
        .classed('mb-1', true)
        .call(box.colorBox, 'Unknown');
  }


  function updateColorRangeGroup(selection, cscale, range, unknown) {
    const customRange = () => {
      const cs = lbox.colorScaleBoxValue(selection.select('.colorscale'));
      const rg = box.formValue(selection.select('.rangetype'));
      const customScale = cs === 'custom';
      selection.selectAll('.rangetype, .range, .unknown')
          .selectAll('select, input')
          .property('disabled', !customScale);
      selection.select('.range').select('.mid')
          .property('disabled', !customScale || rg === 'continuous');
    };
    selection.select('.colorscale')
        .call(lbox.updateColorScaleBox, cscale)
        .on('change', function () {
          customRange();
        });
    const rtype = range.length === 2 ? 'continuous' : 'two-piece';
    selection.select('.rangetype')
        .call(box.updateFormValue, rtype)
        .on('change', function () {
          customRange();
        })
        .dispatch('change');
    const rboxValues = range.length === 2  ? [range[0], null, range[1]] : range;
    selection.select('.range')
        .call(rbox.updateColorRangeValues, rboxValues)
        .on('focusin', () => {
          selection.dispatch('change', {bubbles: true});
        });
    selection.select('.unknown')
        .call(box.updateFormValue, unknown)
        .on('focusin', () => {
          selection.dispatch('change', {bubbles: true});
        });
  }


  function colorGroupValues(selection) {
    const colorScale = lbox.colorScaleBoxItem(selection.select('.colorscale'));
    const rtype = box.formValue(selection.select('.rangetype'));
    const range = rbox.colorRangeValues(selection.select('.range'));
    const unknown = box.formValue(selection.select('.unknown'));
    return {
      color: colorScale.key,
      colorScaleType: colorScale.type,
      range: rtype === 'continuous' ? [range[0], range[2]] : range,
      unknown: unknown
    };
  }


  /**
   * Render scale and domain control box group
   * @param {d3.selection} selection - selection of box container (div element)
   */
  function scaleBoxGroup(selection) {
    selection.classed('mb-3', true);

    // Scale type
    const scaleOptions = [
      {key: 'linear', name: 'Linear'},
      {key: 'log', name: 'Log'}
    ];
    selection.append('div')
        .classed('scale', true)
        .classed('mb-1', true)
        .call(lbox.selectBox, 'Scale')
        .call(lbox.updateSelectBoxOptions, scaleOptions)
        .on('change', function () {
          const isLog = box.formValue(d3__default["default"].select(this)) === 'log';
          selection.select('.domain')
            .call(isLog ? rbox.logRange : rbox.linearRange)
            .call(badge$1.updateInvalidMessage,
                  isLog ? 'Please provide a valid range (larger than 0)'
                  : 'Please provide a valid number');
        });
    selection.append('div')
        .classed('domain', true)
        .classed('mb-1', true)
        .call(rbox.rangeBox, 'Domain');
  }


  function updateScaleBoxGroup(selection, scale, domain) {
    selection.select('.scale')
        .call(box.updateFormValue, scale)
        .dispatch('change');
    selection.select('.domain')
        .call(rbox.updateRangeValues, domain);
  }


  function scaleBoxGroupValid(selection) {
    const isLog = box.formValue(selection.select('.scale')) === 'log';
    const dm = selection.select('.domain');
    return isLog ? rbox.logRangeValid(dm) : rbox.linearRangeValid(dm);
  }


  function scaleGroupValues(selection) {
    const scale = box.formValue(selection.select('.scale'));
    const domain = rbox.rangeValues(selection.select('.domain'));
    return {
      scale: scale || 'linear',
      domain: domain
    };
  }


  var group = {
    colorRangeGroup, updateColorRangeGroup, colorGroupValues,
    scaleBoxGroup, updateScaleBoxGroup, scaleGroupValues, scaleBoxGroupValid
  };

  function colorControlBox(selection, colorScales, fieldName) {
    // Color field
    selection.append('div')
        .classed('field', true)
        .call(lbox.selectBox, fieldName || 'Field');

    // Colorscale and custom range
    selection.append('div')
        .classed('range', true)
        .call(group.colorRangeGroup, colorScales)
        .on('change', function () {
          const values = group.colorGroupValues(d3__default["default"].select(this));
          const noScale = ['categorical', 'monocolor']
            .includes(values.colorScaleType);
          selection.select('.scale').selectAll('select,input')
              .property('disabled', noScale);
        });

    // Scale
    selection.append('div')
        .classed('scale', true)
        .call(group.scaleBoxGroup);

    // Legend
    selection.append('div')
        .classed('legend', true)
        .call(box.checkBox, 'Show legend');
  }


  function updateColorControl(selection, fieldOptions, colorState) {
    selection.select('.field')
        .call(lbox.updateSelectBoxOptions, fieldOptions)
        .call(box.updateFormValue, colorState.field);
    selection.select('.range')
        .call(group.updateColorRangeGroup, colorState.color,
              colorState.range, colorState.unknown);
    selection.select('.scale')
        .call(group.updateScaleBoxGroup, colorState.scale, colorState.domain)
        .dispatch('change');
    selection.select('.legend')
        .call(box.updateCheckBox, colorState.legend);
  }


  function colorControlValid(selection) {
    return group.scaleBoxGroupValid(selection.select('.scale'));
  }


  function colorControlState(selection) {
    const range = group.colorGroupValues(selection.select('.range'));
    const scale = group.scaleGroupValues(selection.select('.scale'));
    return {
      field: box.formValue(selection.select('.field')),
      color: range.color,
      range: range.range,
      unknown: range.unknown,
      scale: range.colorScaleType === 'categorical' ? 'ordinal': scale.scale,
      domain: scale.domain,
      legend: box.checkBoxValue(selection.select('.legend'))
    };
  }


  function sizeControlBox(selection, fieldName) {
    // Size field
    selection.append('div')
        .classed('field', true)
        .call(lbox.selectBox, fieldName || 'Field');

    // Size range
    selection.append('div')
        .classed('range', true)
        .classed('mb-2', true)
        .call(rbox.rangeBox, 'Range')
        .call(rbox.linearRange, 0.1, 999, 0.1)
        .call(badge$1.updateInvalidMessage,
              'Please provide a valid range (0.1-999)');

    // Size unknown
    selection.append('div')
        .classed('unknown', true)
        .call(box.numberBox, 'Unknown')
        .call(box.updateNumberRange, 0.1, 999, 0.1)
        .call(badge$1.updateInvalidMessage,
              'Please provide a valid number (0.1-999)')
      .select('input')
        .classed('col-8', false)
        .classed('col-3', true);

    // Size scale
    selection.append('div')
        .classed('scale', true)
        .call(group.scaleBoxGroup);
  }


  function updateSizeControl(selection, fieldOptions, sizeState) {
    selection.select('.field')
        .call(lbox.updateSelectBoxOptions, fieldOptions)
        .call(box.updateFormValue, sizeState.field);
    selection.select('.range')
        .call(rbox.updateRangeValues, sizeState.range);
    selection.select('.unknown')
        .call(box.updateFormValue, sizeState.unknown);
    selection.select('.scale')
        .call(group.updateScaleBoxGroup, sizeState.scale, sizeState.domain);
  }


  function sizeControlValid(selection) {
    const rangeValid = rbox.linearRangeValid(selection.select('.range'));
    const unkValid = box.formValid(selection.select('.unknown'));
    const scaleValid = group.scaleBoxGroupValid(selection.select('.scale'));
    return rangeValid && unkValid && scaleValid;
  }


  function sizeControlState(selection) {
    const scale = group.scaleGroupValues(selection.select('.scale'));
    return {
      field: box.formValue(selection.select('.field')),
      range: rbox.rangeValues(selection.select('.range')),
      unknown: box.formValue(selection.select('.unknown')),
      scale: scale.scale,
      domain: scale.domain
    };
  }


  function labelControlBox(selection, colorScales) {
    // nodeLabel.visible
    selection.append('div')
      .append('div')
        .classed('visible', true)
        .call(box.checkBox, 'Show labels');

    // nodeLabel
    const labelGroup = selection.append('div')
        .classed('mb-3', true);
    labelGroup.append('div')
        .classed('text', true)
        .classed('mb-1', true)
        .call(lbox.selectBox, 'Text field');
    labelGroup.append('div')
        .classed('size', true)
        .classed('mb-1', true)
        .call(box.numberBox, 'Font size')
        .call(box.updateNumberRange, 0.1, 999, 0.1)
        .call(badge$1.updateInvalidMessage,
              'Please provide a valid number (0.1-999)')
      .select('.form-control')
        .attr('required', 'required');

    // nodeLabelColor
    selection.call(colorControlBox, colorScales, 'Color field');
    // TODO: not implemented yet
    selection.select('.legend input').property('disabled', true);
  }


  function updateLabelControl(selection, fieldOptions,
                                 labelState, colorState) {
    selection.select('.visible')
        .call(box.updateCheckBox, labelState.visible);
    selection.select('.text')
        .call(lbox.updateSelectBoxOptions, fieldOptions)
        .call(box.updateFormValue, labelState.field);
    selection.select('.size')
        .call(box.updateFormValue, labelState.size);
    selection.call(updateColorControl, fieldOptions, colorState);
  }


  function labelControlValid(selection) {
    const fontValid = box.formValid(selection.select('.size'));
    return fontValid && colorControlValid(selection);
  }


  function labelControlState(selection) {
    return {
      label: {
        field: box.formValue(selection.select('.text')),
        size: box.formValue(selection.select('.size')),
        visible: box.checkBoxValue(selection.select('.visible'))
      },
      labelColor: colorControlState(selection)
    };
  }


  function controlBoxFrame(selection, navID, contentID) {
    selection.append('nav')
      .append('div')
        .classed('nav', true)
        .classed('nav-tabs', true)
        .attr('id', navID)
        .attr('role', 'tablist');
    selection.append('div')
        .classed('tab-content', true)
        .classed('p-2', true)
        .attr('id', contentID);
  }


  function controlBoxNav(selection, id, label) {
    selection
        .classed('nav-item', true)
        .classed('nav-link', true)
        .classed('py-1', true)
        .attr('id', `${id}-tab`)
        .attr('data-toggle', 'tab')
        .attr('href', `#${id}`)
        .attr('role', 'tab')
        .attr('aria-controls', id)
        .attr('aria-selected', 'false')
        .text(label);
  }


  function controlBoxItem(selection, id) {
    selection
        .classed('tab-pane', true)
        .classed('fade', true)
        .classed('container', true)
        .classed('px-0', true)
        .attr('id', id)
        .attr('role', 'tabpanel')
        .attr('aria-labelledby', `${id}-tab`);
  }


  var cbox = {
    colorControlBox, updateColorControl, colorControlValid, colorControlState,
    sizeControlBox, updateSizeControl, sizeControlValid, sizeControlState,
    labelControlBox, updateLabelControl, labelControlValid, labelControlState,
    controlBoxFrame, controlBoxNav, controlBoxItem
  };

  const svgWidth = 180;  //TODO
  const svgHeight = 180;  //TODO


  function updateNodes(selection, records, showStruct) {
    const nodes = selection.selectAll('.node')
      .data(records, d => d.index);
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
    entered.append('text')
        .attr('class', 'node-label')
        .attr('x', 0)
        .attr('text-anchor', 'middle');
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
      .data(records, d => `${d.source.index}_${d.target.index}`);
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
    const colorConv = cscale.scaleFunction(state.nodeColor);
    const sizeConv = cscale.scaleFunction(state.nodeSize);
    const labelColorConv = cscale.scaleFunction(state.nodeLabelColor);
    const field = state.nodes.fields
      .find(e => e.key === state.nodeLabel.field);
    const textConv = value => {
      return field.format === 'd3_format'
        ? misc.formatNum(value, field.d3_format) : value;
    };
    selection.selectAll('.node').select('.node-symbol')
        .attr('r', d => sizeConv(d[state.nodeSize.field]))
        .style('fill', d => colorConv(d[state.nodeColor.field]));
    // TODO: tidy up (like rowFactory?)
    if (field.format === 'html') {
      const htwidth = 200;
      const fo = selection.selectAll('.node').select('.node-html');
      fo.attr('x', -htwidth / 2)
        .attr('y', d => state.focusedView ? svgWidth / 2 - 10
          : parseFloat(sizeConv(d[state.nodeSize.field])))
        .attr('width', htwidth)
        .attr('height', 1)
        .attr('overflow', 'visible');
      fo.select('div')
        .style('font-size', `${state.nodeLabel.size}px`)
        .style('color', d => labelColorConv(d[state.nodeLabelColor.field]))
        .style('text-align', 'center')
        .style('display', state.nodeLabel.visible ? 'block' : 'none')
        .html(d => d[state.nodeLabel.field]);
      selection.selectAll('.node').select('.node-label').text('');
    } else {
      selection.selectAll('.node').select('.node-label')
          .attr('font-size', state.nodeLabel.size)
          .attr('y', d => state.focusedView ? svgWidth / 2 - 10
            : parseFloat(sizeConv(d[state.nodeSize.field])))
          .attr('visibility', state.nodeLabel.visible ? 'inherit' : 'hidden')
          .style('fill', d => labelColorConv(d[state.nodeLabelColor.field]))
          .text(d => textConv(d[state.nodeLabel.field]));
      selection.selectAll('.node').select('.node-html div').html('');
    }
  }


  function updateEdgeAttrs(selection, state) {
    const colorConv = cscale.scaleFunction(state.edgeColor);
    const widthConv = cscale.scaleFunction(state.edgeWidth);
    const labelColorConv = cscale.scaleFunction(state.edgeLabelColor);
    const field = state.edges.fields
      .find(e => e.key === state.edgeLabel.field);
    const textConv = value => {
      return field.format === 'd3_format'
        ? misc.formatNum(value, field.d3_format) : value;
    };
    selection.selectAll('.link').select('.edge-line')
      .style('stroke', d => colorConv(d[state.edgeColor.field]))
      .style('stroke-width', d => widthConv(d[state.edgeWidth.field]));
    selection.selectAll('.link').select('.edge-label')
      .attr('font-size', state.edgeLabel.size)
      .attr('visibility', state.edgeLabel.visible ? 'inherit' : 'hidden')
      .style('fill', d => labelColorConv(d[state.edgeLabelColor.field]))
      .text(d => textConv(d[state.edgeLabel.field]));
  }


  function updateNodeCoords(selection) {
    selection.attr('transform', d => `translate(${d.x}, ${d.y})`);
  }


  function updateEdgeCoords(selection) {
    selection.attr('transform', d => `translate(${d.sx}, ${d.sy})`);
    selection.select('.edge-line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', d => d.tx - d.sx)
      .attr('y2', d => d.ty - d.sy);
    selection.select('.edge-label')
      .attr('x', d => (d.tx - d.sx) / 2)
      .attr('y', d => (d.ty - d.sy) / 2);
  }


  function updateAttrs(selection, state) {
    selection.call(updateNodeAttrs, state);
    selection.call(updateEdgeAttrs, state);
  }


  function updateComponents$1(selection, state) {
    const nodesToRender = state.nodesToRender();
    const numNodes = nodesToRender.length;
    if (state.enableFocusedView) {
      state.focusedView = numNodes < state.focusedViewThreshold;
    }
    if (state.enableOverlookView) {
      state.overlookView = numNodes > state.overlookViewThreshold;
    }
    const edgesToRender = state.overlookView ? [] : state.edgesToRender();
    selection.select('.node-layer')
      .call(updateNodes, nodesToRender, state.focusedView);
    selection.select('.edge-layer')
      .call(updateEdges, edgesToRender);
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


  function move(selection, node, x, y) {
    const n = d3__default["default"].select(node).call(moveNode, x, y).datum();
    selection.select('.edge-layer')
      .selectAll(".link")
      .filter(d => n.adjacency.map(e => e[1]).includes(d.num))
      .each(function (d) {
        if (n.index === d.source.index) {
          d3__default["default"].select(this).call(moveEdge, x, y, d.tx, d.ty);
        } else if (n.index === d.target.index) {
          d3__default["default"].select(this).call(moveEdge, d.sx, d.sy, x, y);
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
      state.updateWorkingCopy();
      state.updateControlBoxNotifier();  // Update selectBox options
      state.setForceNotifier();
      state.updateComponentNotifier();
    };
    // Apply changes in nodes and edges displayed
    state.updateComponentNotifier = () => {
      state.updateLegendNotifier();
      const coords = state.ns.map(e => ({x: e.x, y: e.y}));
      state.setAllCoords(coords);
      selection.call(updateComponents$1, state);
      state.updateInteractionNotifier();  // Apply drag events to each nodes
    };
    state.updateNodeNotifier = () => {
      nodes.call(updateNodes, state.nodesToRender());
      state.updateLegendNotifier();
    };
    state.updateEdgeNotifier = () => {
      edges.call(updateEdges, state.edgesToRender());
    };
    state.updateNodeAttrNotifier = () => {
      nodes.call(updateNodeAttrs, state);
      state.updateLegendNotifier();
    };
    state.updateEdgeAttrNotifier = () => {
      edges.call(updateEdgeAttrs, state);
    };
    state.updateLegendNotifier = () => {
      legendGroup.call(legend.updateLegendGroup,
                       state.viewBox, state.legendOrient);
      legendGroup.select('.nodecolor')
          .attr('visibility', state.nodeColor.legend ? 'inherit' : 'hidden')
          .call(legend.updateColorBarLegend, state.nodeColor);
    };
  }


  var component = {
    updateNodes, updateEdges, updateNodeCoords, updateEdgeCoords,
    updateNodeAttrs, updateEdgeAttrs, updateAttrs, updateComponents: updateComponents$1,
    move, moveEdge, networkView
  };

  function dragListener(selection, state) {
    return d3__default["default"].drag()
      .on('drag', function () {
        selection.call(component.move, this, d3__default["default"].event.x, d3__default["default"].event.y);
      })
      .on('end', function (d) {
        state.setCoords(d.index, d3__default["default"].event.x, d3__default["default"].event.y);
      });
  }


  function multiDragListener(selection, state) {
    const origin = {x: 0, y: 0};
    return d3__default["default"].drag()
      .on('start', function () {
        origin.x = d3__default["default"].event.x;
        origin.y = d3__default["default"].event.y;
      })
      .on('drag', function () {
        const dx = d3__default["default"].event.x - origin.x;
        const dy = d3__default["default"].event.y - origin.y;
        d3__default["default"].select(this).attr('transform', `translate(${dx}, ${dy})`);
        selection.selectAll('.selected-nodes .node')
          .each(function (n) {
            const newX = n.x + dx;
            const newY = n.y + dy;
            selection.selectAll('.edge-layer .link')
              .filter(d => n.adjacency.map(e => e[1]).includes(d.num))
              .each(function (d) {
                if (n.index === d.source.index) {
                  d3__default["default"].select(this)
                      .call(component.moveEdge, newX, newY, d.tx, d.ty);
                } else if (n.index === d.target.index) {
                  d3__default["default"].select(this)
                      .call(component.moveEdge, d.sx, d.sy, newX, newY);
                }
              });
          });
      })
      .on('end', function () {
        const dx = d3__default["default"].event.x - origin.x;
        const dy = d3__default["default"].event.y - origin.y;
        selection.selectAll('.selected-nodes .node')
          .each(function (n) {
            const newX = n.x + dx;
            const newY = n.y + dy;
            state.setCoords(n.index, newX, newY);
            d3__default["default"].select(this).attr('transform', `translate(${newX}, ${newY})`);
          });
        selection.selectAll('.selected-edges .link')
            .attr('transform', d => `translate(${d.sx}, ${d.sy})`);
        d3__default["default"].select(this).attr('transform', `translate(0, 0)`);
      });
  }


  function zoomListener(selection, state) {
    let prevTransform = {x: 0, y: 0, k: 1};
    selection
        .on("dblclick.zoom", null)  // disable double-click zoom
        .on('.drag', null);  // disable rectSelect
    return d3__default["default"].zoom()
      .on('zoom', function() {
        const t = d3__default["default"].event.transform;
        selection.call(transform$1.transform, t.x, t.y, t.k);
        // Smooth transition
        if (!state.focusedView) {
          const p = prevTransform;
          const xMoved = t.x > p.x + 20 || t.x < p.x - 20;
          const yMoved = t.y > p.y + 20 || t.y < p.y - 20;
          const zoomIn = t.k > p.k;
          if (xMoved || yMoved && !zoomIn) {
            state.setTransform(t.x, t.y, t.k);
            prevTransform = {x: t.x, y: t.y, k: t.k};
            state.updateComponentNotifier();
          }
        }
      })
      .on('end', function() {
        const t = d3__default["default"].event.transform;
        state.setTransform(t.x, t.y, t.k);
        prevTransform = {x: t.x, y: t.y, k: t.k};
        state.updateComponentNotifier();
      });
  }


  function rectSelectListener(selection, state) {
    selection.on('.zoom', null);  // disable zoom
    const rect = selection.select('.interactions .rect-select');
    const origin = {x: 0, y: 0};
    let initSel = [];
    return d3__default["default"].drag()
      .on('start', function () {
        origin.x = d3__default["default"].event.x;
        origin.y = d3__default["default"].event.y;
        initSel = state.ns.map(e => e.selected);
        rect.attr('visibility', 'visible')
            .attr('x', origin.x).attr('y', origin.y);
      })
      .on('drag', function () {
        const left = Math.min(origin.x, d3__default["default"].event.x);
        const width = Math.abs(origin.x - d3__default["default"].event.x);
        const top = Math.min(origin.y, d3__default["default"].event.y);
        const height = Math.abs(origin.y - d3__default["default"].event.y);
        const tf = state.transform;
        const xConv = x => (x - tf.x) / tf.k;
        const yConv = y => (y - tf.y) / tf.k;
        selection.selectAll('.node')
          .each(function(d) {
            const selected = d3__default["default"].select(this.parentNode).classed('selected-nodes');
            const inside = d.x > xConv(left) && d.y > yConv(top)
                && d.x < xConv(left + width) && d.y < yConv(top + height);
            const sel = selected !== inside;
            d3__default["default"].select(this)
              .select('.node-symbol')
                .attr('stroke', sel ? 'red' : null)
                .attr('stroke-width', sel ? 10 : null)
                .attr('stroke-opacity', sel ? 0.5 : 0);
          rect.attr('x', left).attr('y', top)
              .attr('width', width).attr('height', height);

        });
      })
      .on('end', function () {
        const left = Math.min(origin.x, d3__default["default"].event.x);
        const width = Math.abs(origin.x - d3__default["default"].event.x);
        const top = Math.min(origin.y, d3__default["default"].event.y);
        const height = Math.abs(origin.y - d3__default["default"].event.y);
        const tf = state.transform;
        const xConv = x => (x - tf.x) / tf.k;
        const yConv = y => (y - tf.y) / tf.k;
        state.ns.filter(
          n => n.x > xConv(left) && n.y > yConv(top)
            && n.x < xConv(left + width) && n.y < yConv(top + height)
        ).forEach(n => {
          n.selected = !initSel[n.index];
          // Selection should be an induced subgraph of the network
          n.adjacency.forEach(adj => {
            state.es[adj[1]].selected = (
              state.ns[n.index].selected && state.ns[adj[0]].selected);
          });
        });
        state.updateComponentNotifier();
        rect.attr('visibility', 'hidden')
            .attr('width', 0).attr('height', 0);
      });
  }


  function selectListener(selection, state) {
    return sel => {
      sel.on('touchstart', function () { d3__default["default"].event.preventDefault(); })
          .on('touchmove', function () { d3__default["default"].event.preventDefault(); })
          .on('click.select', function () {
            d3__default["default"].event.stopPropagation();
            const n = d3__default["default"].select(this).datum().index;
            const isSel = state.ns[n].selected;
            state.ns.forEach(e => { e.selected = false; });
            state.es.forEach(e => { e.selected = false; });
            state.ns[n].selected = !isSel;
            state.updateComponentNotifier();
          });
    };
  }


  function multiSelectListener(selection, state) {
    return sel => {
      sel.on('touchstart', function () { d3__default["default"].event.preventDefault(); })
          .on('touchmove', function () { d3__default["default"].event.preventDefault(); })
          .on('click.select', function () {
            d3__default["default"].event.stopPropagation();
            const data = d3__default["default"].select(this).datum();
            const n = data.index;
            state.ns[n].selected = !state.ns[n].selected;
            // Selection should be an induced subgraph of the network
            data.adjacency.forEach(adj => {
              state.es[adj[1]].selected = (
                state.ns[n].selected && state.ns[adj[0]].selected);
            });
            state.updateComponentNotifier();
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


  // TODO: refactor
  // Custom updater for interactive mode
  function updateComponents(selection, state) {
    const nodesToRender = state.nodesToRender();
    const [nodesSelected, nodesNotSelected] = ___default["default"].partition(
      nodesToRender, d => d.selected);
    const numNodes = nodesToRender.length;
    if (state.enableFocusedView) {
      state.focusedView = numNodes < state.focusedViewThreshold;
    }
    if (state.enableOverlookView) {
      state.overlookView = numNodes > state.overlookViewThreshold;
    }
    const edgesToRender = state.overlookView ? [] : state.edgesToRender();
    const [edgesSelected, edgesNotSelected] = ___default["default"].partition(
        edgesToRender, d => d.selected);
    selection.select('.node-layer')
        .call(component.updateNodes, nodesNotSelected, state.focusedView)
      .selectAll('.node .node-symbol')
        .attr('stroke-opacity', 0);
    selection.select('.edge-layer')
        .call(component.updateEdges, edgesNotSelected);
    selection.select('.selected-nodes')
        .call(component.updateNodes, nodesSelected, state.focusedView)
      .selectAll('.node .node-symbol')
        .attr('stroke', 'red')
        .attr('stroke-width', 10)
        .attr('stroke-opacity', 0.5);
    selection.select('.selected-edges')
        .call(component.updateEdges, edgesSelected);
    selection.call(component.updateAttrs, state);
  }


  function setInteraction(selection, state) {
    // Object selection layer
    const selectedObj = selection.select('.field')
      .append('g').classed('selected-obj', true);
    selectedObj.append('g').classed('selected-edges', true);
    selectedObj.append('g').classed('selected-nodes', true);

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
        .on('touchstart', function () { d3__default["default"].event.preventDefault(); })
        .on('touchmove', function () { d3__default["default"].event.preventDefault(); })
        .on('click', function () {
          if (event.shiftKey) d3__default["default"].event.preventDefault();
          state.ns.forEach(e => { e.selected = false; });
          state.es.forEach(e => { e.selected = false; });
          state.updateComponentNotifier();
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
    state.dragListener = dragListener(selection, state);
    state.selectListener = selectListener(selection, state);

    // Update interaction events
    state.updateInteractionNotifier = () => {
      selection.call(state.zoomListener);
      selection.selectAll('.node')
          .call(state.selectListener);
      selection.selectAll('.node-layer .node')
          .call(state.dragListener);
      selection.selectAll('.selected-obj')
          .call(multiDragListener(selection, state));
      selection.call(resume, state.transform);
    };

    // Update components
    state.updateComponentNotifier = () => {
      state.updateLegendNotifier();
      const coords = state.ns.map(e => ({x: e.x, y: e.y}));
      state.setAllCoords(coords);
      selection.call(updateComponents, state);  // Custom updater
      state.updateInteractionNotifier();  // Apply drag events to each nodes
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
        .force('link', d3__default["default"].forceLink().id(d => d.index).distance(60).strength(1))
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
        .force('link', d3__default["default"].forceLink().id(d => d.index).distance(60).strength(2))
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
        .force('link', d3__default["default"].forceLink().id(d => d.index).distance(60).strength(2))
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
      .on('start', () => {
        if (!d3__default["default"].event.active) state.relaxNotifier();
      })
      .on('drag', d => {
        d.fx = d3__default["default"].event.x;
        d.fy = d3__default["default"].event.y;
      })
      .on('end', d => {
        if (!d3__default["default"].event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
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
          state.forceType, state.fieldWidth, state.fieldHeight);
      simulation.nodes(state.ns)
        .force('link').links(state.currentEdges());
      simulation
        .on('tick', () => {
          const coords = state.ns.map(e => ({x: e.x, y: e.y}));
          state.setAllCoords(coords);
          selection.selectAll(".node")
            .call(component.updateNodeCoords);
          selection.selectAll(".link")
            .call(component.updateEdgeCoords);
          state.tickCallback(simulation);
        })
        .on('end', () => {
          state.updateComponentNotifier();
          state.tickCallback(simulation);
        });
      if (state.forceActive) {
        state.coords ? state.relaxNotifier() : state.restartNotifier();
      } else {
        state.stickNotifier();
      }

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
    };
  }


  var force = {
    forceType, forceSimulation, activate
  };

  function mainControlBox(selection, state) {
    // Zoom
    selection.append('div')
        .classed('mb-3', true)
      .append('div')
        .classed('fit', true)
        .call(button.buttonBox, 'Fit to screen', 'primary');
    // View modes
    const viewModes = selection.append('div')
        .classed('mb-3', true);
      viewModes.append('div')
        .classed('focused', true)
        .classed('mb-1', true)
        .call(box.checkBox, 'Enable focused view');
      viewModes.append('div')
        .classed('overlook', true)
        .classed('mb-1', true)
        .call(box.checkBox, 'Enable overlook view');

    // Legend
    const legendOptions = [
      {key: 'top-left', name: 'Top-left'},
      {key: 'top-right', name: 'Top-right'},
      {key: 'bottom-left', name: 'Bottom-left'},
      {key: 'bottom-right', name: 'Bottom-right'},
    ];
    selection.append('div')
        .classed('legend', true)
        .classed('mb-3', true)
        .call(lbox.selectBox, 'Legend')
        .call(lbox.updateSelectBoxOptions, legendOptions)
        .on('change', function () {
          state.legendOrient = box.formValue(d3__default["default"].select(this));
          state.updateLegendNotifier();
        });

    // Network threshold
    const thldGroup = selection.append('div')
        .classed('thld-group', true)
        .classed('mb-3', true);
    thldGroup.append('div')
        .classed('field', true)
        .classed('mb-1', true)
        .call(lbox.selectBox, 'Connection');
    thldGroup.append('div')
        .classed('thld', true)
        .classed('mb-1', true)
        .call(box.numberBox, 'Threshold')
        .call(box.updateNumberRange, state.minConnThld, 1, 0.01)
        .call(badge$1.updateInvalidMessage,
              `Please provide a valid range (${state.minConnThld}-1.00)`)
      .select('.form-control')
        .attr('required', 'required');
    thldGroup.append('div')
        .classed('logd', true)
        .classed('mb-1', true)
        .call(box.readonlyBox, 'logD');
    // Force layout
    const forceBox = selection.append('div')
        .classed('form-group', true)
        .classed('form-row', true);
    forceBox.append('div')
        .classed('col-12', true)
      .append('div')
        .classed('forcetype', true)
        .classed('mb-1', true)
        .call(lbox.selectBox, 'Force')
        .call(lbox.updateSelectBoxOptions, force.forceType)
        .on('change', function () {
          const value = box.formValue(d3__default["default"].select(this));
          state.forceType = value;
          state.setForceNotifier();
        });
    forceBox.append('div')
        .classed('col-6', true)
      .append('span')
        .classed('col-form-label', true)
        .classed('col-form-label-sm', true)
        .classed('mb-1', true)
        .text('Temperature');
    forceBox.append('div')
        .classed('col-12', true)
      .append('div')
        .classed('temperature', true)
        .classed('progress', true)
      .append('div')
        .classed('progress-bar', true)
        .classed('w-30', true)
        .attr('id', 'temperature')
        .attr('role', 'progressbar')
        .attr('aria-valuemin', 0)
        .attr('aria-valuemax', 100);
    forceBox.append('div')
        .classed('col-12', true)
      .append('div')
        .classed('stick', true)
        .classed('mb-1', true)
        .call(box.checkBox, 'Stick nodes');
    forceBox.append('div')
        .classed('col-12', true)
      .append('div')
        .classed('restart', true)
        .classed('mb-1', true)
        .call(button.buttonBox, 'Activate', 'warning');
  }


  function updateMainControl(selection, state) {
    // Zoom
    selection.select('.fit')
        .on('click', function () { state.fitNotifier(); });
    // Focused view
    selection.select('.focused')
        .call(box.updateCheckBox, state.enableFocusedView)
        .on('change', function () {
          state.enableFocusedView = box.checkBoxValue(d3__default["default"].select(this));
          state.focusedView = box.checkBoxValue(d3__default["default"].select(this));
          state.updateComponentNotifier();
        });
    // Overlook view
    selection.select('.overlook')
        .call(box.updateCheckBox, state.enableOverlookView)
        .on('change', function () {
          state.enableOverlookView = box.checkBoxValue(d3__default["default"].select(this));
          state.overlookView = box.checkBoxValue(d3__default["default"].select(this));
          state.updateComponentNotifier();
        });
    // Network threshold
    const thldGroup = selection.select('.thld-group');
    const thldFields = state.edges.fields
      .filter(e => misc.sortType(e.format) !== 'none')
      .filter(e => !['source', 'target'].includes(e.key));
    thldGroup.select('.field')
        .call(lbox.updateSelectBoxOptions, thldFields)
        .call(box.updateFormValue, state.connThldField);
    thldGroup.select('.thld')
        .call(box.updateFormValue, state.currentConnThld);
    thldGroup.selectAll('.field, .thld')
        .on('change', function () {
          if(!box.formValid(thldGroup.select('.thld'))) return;
          const field = box.formValue(thldGroup.select('.field'));
          const thld = box.formValue(thldGroup.select('.thld'));
          state.connThldField = field;
          state.currentConnThld = thld;
          thldGroup.select('.logd').dispatch('update');
          state.setForceNotifier();
          state.updateComponentNotifier();
        });
    thldGroup.select('.logd')
        .on('update', function () {
          // Calculate edge density
          const field = state.connThldField;
          const thld = state.currentConnThld;
          const numEdges = state.es.filter(e => e[field] >= thld).length;
          const n = state.ns.length;
          const combinations = n * (n - 1) / 2;
          const logD = d3__default["default"].format('.2f')(Math.log10(numEdges / combinations));
          d3__default["default"].select(this).call(box.updateReadonlyValue, logD);
        })
        .dispatch('update');

    // Force layout
    state.tickCallback = (simulation) => {
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
        .on('change', function () {
          const value = box.checkBoxValue(d3__default["default"].select(this));
          state.forceActive = !value;
          selection.select('.temperature')
              .style('background-color', value ? '#a3e4d7' : '#e9ecef')
            .select('.progress-bar')
              .style('width', `0%`)
              .attr('aria-valuenow', 0);
          value ? state.stickNotifier() : state.relaxNotifier();
          state.updateComponentNotifier();
        });
    selection.select('.restart')
        .on('click', function () {
          selection.select('.stick')
              .call(box.updateCheckBox, false)
              .dispatch('change');
          state.restartNotifier();
        });
  }


  function updateNodeColorControl(selection, state) {
    const fieldOptions = state.nodes.fields
      .filter(e => misc.sortType(e.format) !== 'none');
    selection
        .call(cbox.updateColorControl, fieldOptions, state.nodeColor)
        .on('change', function() {
          if (!cbox.colorControlValid(selection)) return;
          state.nodeColor = cbox.colorControlState(selection);
          if (state.nodeColor.scale === 'ordinal') {
            const keys = state.nodes.records().map(e => e[state.nodeColor.field]);
            state.nodeColor.domain = ___default["default"].uniq(keys).sort();
          }
          state.updateNodeAttrNotifier();
        });
  }


  function updateEdgeColorControl(selection, state) {
    const fieldOptions = state.edges.fields
      .filter(e => misc.sortType(e.format) !== 'none')
      .filter(e => !['source', 'target'].includes(e.key));
    selection
        .call(cbox.updateColorControl, fieldOptions, state.edgeColor)
        .on('change', function() {
          if (!cbox.colorControlValid(selection)) return;
          state.edgeColor = cbox.colorControlState(selection);
          if (state.edgeColor.scale === 'ordinal') {
            const keys = state.edges.records().map(e => e[state.edgeColor.field]);
            state.edgeColor.domain = ___default["default"].uniq(keys).sort();
          }
          state.updateEdgeAttrNotifier();
        });

    // TODO: not implemented yet
    selection.select('.legend input').property('disabled', true);
  }


  function updateNodeSizeControl(selection, state) {
    const fieldOptions = state.nodes.fields
      .filter(e => misc.sortType(e.format) !== 'none');
    selection
        .call(cbox.updateSizeControl, fieldOptions, state.nodeSize)
        .on('change', function() {
          if (!cbox.sizeControlValid(selection)) return;
          state.nodeSize = cbox.sizeControlState(selection);
          state.updateNodeAttrNotifier();
        });
  }


  function updateEdgeWidthControl(selection, state) {
    const fieldOptions = state.edges.fields
      .filter(e => misc.sortType(e.format) !== 'none')
      .filter(e => !['source', 'target'].includes(e.key));
    selection
        .call(cbox.updateSizeControl, fieldOptions, state.edgeWidth)
        .on('change', function() {
          if (!cbox.sizeControlValid(selection)) return;
          state.edgeWidth = cbox.sizeControlState(selection);
          state.updateEdgeAttrNotifier();
        });
  }


  function updateNodeLabelControl(selection, state) {
    const fieldOptions = state.nodes.fields
      .filter(e => misc.sortType(e.format) !== 'none');
    selection
        .call(cbox.updateLabelControl, fieldOptions,
              state.nodeLabel, state.nodeLabelColor)
        .on('change', function() {
          if (!cbox.labelControlValid(selection)) return;
          const values = cbox.labelControlState(selection);
          state.nodeLabel = values.label;
          state.nodeLabelColor = values.labelColor;
          if (state.nodeLabelColor.scale === 'ordinal') {
            const keys = state.nodes.records()
              .map(e => e[state.nodeLabelColor.field]);
            state.nodeLabelColor.domain = ___default["default"].uniq(keys).sort();
          }
          state.updateNodeAttrNotifier();
        });
  }


  function updateEdgeLabelControl(selection, state) {
    const fieldOptions = state.edges.fields
      .filter(e => misc.sortType(e.format) !== 'none')
      .filter(e => !['source', 'target'].includes(e.key));
    selection
        .call(cbox.updateLabelControl, fieldOptions,
              state.edgeLabel, state.edgeLabelColor)
        .on('change', function() {
          if (!cbox.labelControlValid(selection)) return;
          const values = cbox.labelControlState(selection);
          state.edgeLabel = values.label;
          state.edgeLabelColor = values.labelColor;
          if (state.edgeLabelColor.scale === 'ordinal') {
            const keys = state.edges.records()
              .map(e => e[state.edgeLabelColor.field]);
            state.edgeLabelColor.domain = ___default["default"].uniq(keys).sort();
          }
          state.updateEdgeAttrNotifier();
        });
  }


  function controlBox(selection, state) {
    // Clean up
    selection.select('nav').remove();
    selection.select('.tab-content').remove();

    selection.call(
      cbox.controlBoxFrame, 'control-frame-nav', 'control-frame-content');
    const tabs = selection.select('.nav-tabs');
    const content = selection.select('.tab-content');

    // Main
    tabs.append('a')
        .classed('active', true)
        .attr('aria-selected', 'true')
        .call(cbox.controlBoxNav, 'control-main', 'Main');
    content.append('div')
        .classed('show', true)
        .classed('active', true)
        .classed('control-main', true)
        .call(cbox.controlBoxItem, 'control-main')
        .call(mainControlBox, state);

    // Color
    tabs.append('a')
        .call(cbox.controlBoxNav, 'control-color', 'Color');
    content.append('div')
        .classed('control-color', true)
        .call(cbox.controlBoxItem, 'control-color')
        .call(cbox.colorControlBox, cscale.colorScales);

    // Size
    tabs.append('a')
        .call(cbox.controlBoxNav, 'control-size', 'Size');
    content.append('div')
        .classed('control-size', true)
        .call(cbox.controlBoxItem, 'control-size')
        .call(cbox.sizeControlBox);

    // Label
    tabs.append('a')
        .call(cbox.controlBoxNav, 'control-label', 'Label');
    content.append('div')
        .classed('control-label', true)
        .call(cbox.controlBoxItem, 'control-label')
        .call(cbox.labelControlBox, cscale.colorScales);

    // Edge color
    tabs.append('a')
        .call(cbox.controlBoxNav, 'control-edgecolor', 'eColor');
    content.append('div')
        .classed('control-edgecolor', true)
        .call(cbox.controlBoxItem, 'control-edgecolor')
        .call(cbox.colorControlBox, cscale.colorScales);

    // Edge width
    tabs.append('a')
        .call(cbox.controlBoxNav, 'control-edgewidth', 'eWidth');
    content.append('div')
        .classed('control-edgewidth', true)
        .call(cbox.controlBoxItem, 'control-edgewidth')
        .call(cbox.sizeControlBox);

    // Edge label
    tabs.append('a')
        .call(cbox.controlBoxNav, 'control-edgelabel', 'eLabel');
    content.append('div')
        .classed('control-edgelabel', true)
        .call(cbox.controlBoxItem, 'control-edgelabel')
        .call(cbox.labelControlBox, cscale.colorScales);

    state.updateControlBoxNotifier = () => {
      selection.call(updateControlBox, state);
    };
  }


  function updateControlBox(selection, state) {
    selection.select('.control-main')
        .call(updateMainControl, state);
    selection.select('.control-color')
        .call(updateNodeColorControl, state);
    selection.select('.control-size')
        .call(updateNodeSizeControl, state);
    selection.select('.control-label')
        .call(updateNodeLabelControl, state);
    selection.select('.control-edgecolor')
        .call(updateEdgeColorControl, state);
    selection.select('.control-edgewidth')
        .call(updateEdgeWidthControl, state);
    selection.select('.control-edgelabel')
        .call(updateEdgeLabelControl, state);
  }


  var control = {
    controlBox, updateControlBox
  };

  function app(view, nodes, edges) {
    const menubar = d3__namespace.select('#menubar')
        .classed('my-1', true);
    menubar.selectAll('div,span,a').remove();  // Clean up
    const dialogs = d3__namespace.select('#dialogs');
    dialogs.selectAll('div').remove();  // Clean up

    const state = new NetworkState(view, nodes, edges);
    // TODO: define field size according to the data size
    state.fieldWidth = 1200;
    state.fieldHeight = 1200;

    // Network view control
    const menu = menubar.append('div')
        .call(button.dropdownMenuButton, 'Menu', 'primary', 'network-white')
        .select('.dropdown-menu');
    menu.append('a').call(renameDialog.menuLink);
    menu.append('a')
        .call(button.dropdownMenuItem, 'Save', 'menu-save')
        .on('click', function () {
          return state.save()
            .then(() => menubar.select('.notify-saved').call(badge$1.notify));
        });

    // Dashboard link
    menubar.append('a')
        .call(button.menuButtonLink, 'Dashboard',
              'outline-secondary', 'status-gray')
        .attr('href', 'dashboard.html')
        .attr('target', '_blank');

    // Status
    menubar.append('span')
        .classed('loading-circle', true)
        .call(badge$1.loadingCircle);
    menubar.append('span')
        .classed('notify-saved', true)
        .call(badge$1.alert)
        .call(badge$1.updateAlert, 'State saved', 'success', 'check-green')
        .style('display', 'none');
    menubar.append('span')
        .classed('name', true);
    menubar.append('span')
        .classed('nodes-count', true)
        .call(badge$1.badge);
    menubar.append('span')
        .classed('edges-count', true)
        .call(badge$1.badge);

    // Dialogs
    dialogs.append('div')
        .classed('renamed', true)
        .call(renameDialog.body);
    // TODO: select snapshot and view

    // Contents
    const frame = d3__namespace.select('#nw-frame')
        .call(transform$1.viewFrame, state);
    frame.select('.view')
        .call(component.networkView, state)
        .call(force.activate, state)
        .call(interaction.setInteraction, state);
    d3__namespace.select('#nw-control')
        .call(control.controlBox, state);

    // Resize window
    window.onresize = () =>
      d3__namespace.select('#nw-frame').call(transform$1.resize, state);

    // Update
    state.updateAllNotifier();
    updateApp(state);
  }


  function updateApp(state) {
    // Title
    d3__namespace.select('title').text(state.name);

    // Status
    d3__namespace.select('#menubar .name').text(state.name);

    const onLoading = d3__namespace.select('#menubar .loading-circle');
    const commaf = d3__namespace.format(',');
    d3__namespace.select('#menubar .nodes-count')
        .call(badge$1.updateBadge, `${commaf(state.nodes.size())} nodes`,
              'light', 'nodes-gray')
      .select('.text')
        .style('color', 'gray');
    d3__namespace.select('#menubar .edges-count')
        .call(badge$1.updateBadge, `${commaf(state.edges.size())} edges`,
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


  function run() {
    const err = client.compatibility();
    if (err) {
      d3__namespace.select('body')
        .style('color', '#ff0000')
        .text(err);
      return;
    }
    // TODO: offline mode flags
    document.location.protocol !== "file:";  // TODO
    //client.registerServiceWorker();
    const instance = client.URLQuery().instance || null;
    const viewID = client.URLQuery().view || null;
    if (instance == null && viewID == null) { return; }
    return idb.getView(instance, viewID)
      .then(view => {
        if (!view) throw('ERROR: invalid URL');
        view.instance = instance;
        return Promise.all([
          idb.getCollection(instance, view.nodes),
          idb.getCollection(instance, view.edges)
        ])
        .then(colls => {
          colls[0].instance = instance;
          colls[1].instance = instance;
          app(view, colls[0], colls[1]);
        });
      })
      .catch(err => {
        console.error(err);
        d3__namespace.select('#nw-frame')
          .style('color', 'red')
          .text(err);
      });
  }


  var app$1 = {
    run
  };

  return app$1;

})(d3, _);
