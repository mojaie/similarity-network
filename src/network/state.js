
/** @module network/state */

import TransformState from  '../common/transform.js';

import misc from '../common/misc.js';
import scale from '../common/scale.js';


export default class NetworkState extends TransformState {
  constructor(session, width, height) {
    super(width, height, null);
    // Session properties
    this.sessionName = session.name;
    this.sessionID = session.id;

    this.nodes = session.nodes;
    this.edges = session.edges;

    // Fields
    this.nodeFields = [...this.nodes.reduce((a, b) => {
      Object.keys(b).forEach(e => { a.add(e); })
      return a;
    }, new Set())]  // unique keys
    this.edgeFields = [...this.edges.reduce((a, b) => {
      Object.keys(b).forEach(e => { a.add(e); })
      return a;
    }, new Set())]  // unique keys
    this.fields = [];
    this.nodeFields.forEach(e => { this.fields.push(`node.${e}`) })
    this.edgeFields.forEach(e => { this.fields.push(`edge.${e}`) })


    // set internal attrs for d3.force
    this.nodes.forEach((e, i) => {
      e.__index = i;  // internal id for d3.force
      e.__selected = false;  // for multiple selection
    })
    this.edges.forEach((e, i) => {
      // original edges and edge indices used for filtering by graph topology.
      e.__source = e.source;
      e.__target = e.target;
      e.__index = i;
    })

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
      Object.assign(this.config, session.config)
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
      Object.assign(this.appearance, session.appearance)
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
