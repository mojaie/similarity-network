
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
    this.nodeFields = [...this.nodes.reduce((a, b) => {
      Object.keys(b).forEach(e => { a.add(e); })
      return a;
    }, new Set())]  // unique keys
    this.nodeDomains = this.nodeFields.map(e => {
      return scale.autoDomain(this.nodes.map(n => n[e]));
    });
    this.nodeTypes = this.nodeDomains.map(e => {
      return e === null ? "categorical" : "numeric";
    });
    this.nodes.forEach((e, i) => {
      e.__index = i;  // internal id for d3.force
      e.__selected = false;  // for multiple selection
    })

    this.edges = session.edges;
    this.edgeFields = [...this.edges.reduce((a, b) => {
      Object.keys(b).forEach(e => { a.add(e); })
      return a;
    }, new Set())]  // unique keys
    this.edgeDomains = this.edgeFields.map(e => {
      return scale.autoDomain(this.edges.map(n => n[e]));
    });
    this.edgeTypes = this.edgeDomains.map(e => {
      return e === null ? "categorical" : "numeric";
    });
    this.edges.forEach((e, i) => {
      // internal id for d3.force
      e.__source = e.source;
      e.__target = e.target;
      e.__index = i;
    })

    // For filter fields
    this.fieldTypeMap = {}
    this.nodeFields.forEach((e, i) => {
      this.fieldTypeMap[`node.${e}`] = this.nodeTypes[i];
    })
    this.edgeFields.forEach((e, i) => {
      this.fieldTypeMap[`edge.${e}`] = this.edgeTypes[i];
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

    // boundary: components area, depends on max/min coords of components.
    // fit: operation to find transform where focusArea = boundary
    this.boundary = {
      top: 0,
      right: this.fieldWidth,
      bottom: this.fieldHeight,
      left: 0
    }

    // Client event listeners
    this.zoomListener = null;
    this.dragListener = null;
    // update viewBox component when browser resize event is dispatched and setViewBox is called
    this.resizeCallback = () => {};
    // dispatched when fit is called
    this.fitDispatcher = () => {};

    this.updateHeaderCallback = () => {};
    this.updateMenuButtonCallback = () => {};
    this.updateControlBoxCallback = () => {};

    // update component attributes when controlBox form values changed
    this.updateNodeAttrCallback = () => {};
    this.updateEdgeAttrCallback = () => {};
    this.updateCoordsCallback = () => {};

    // update component visibility and events when vnodes/vedges changed
    this.updateVisibilityCallback = () => {};
    // update component filters and forces when fnodes/fedges changed
    this.updateFilterCallback = () => {
      this.setForceDispatcher();
      this.updateControlBoxCallback();
    };
    // update all when snapshot changed
    this.updateSnapshotCallback = () => {};

    // update coords and force indicators in each ticks
    this.updateForceIndicatorCallback = () => {};
    this.tickCallback = sim => {
      this.updateCoordsCallback();
      this.updateForceIndicatorCallback(sim);
    };
    // dispatched when force operations are called
    this.stickDispatcher = () => {};
    this.relaxDispatcher = () => {};
    this.restartDispatcher = () => {};

    // Initialize snapshot
    this.name = "default";
    this.filters = [];
    this.config = {
      showNodeImageThreshold: 100,
      alwaysShowNodeImage: false,
      showEdgeThreshold: 500,
      alwaysShowEdge: false,
      legendOrient: 'none',
      showEdgeLegend: 'none',
      forceParam: 'dense'
    };
    this.appearance = {
      nodeColor: {
        field: this.nodeFields[0], rangePreset: 'default',
        scale: 'log', domain: [1e-6, 1e-9]
      },
      nodeSize: {
        field: this.nodeFields[0], rangePreset: 'medium',
        scale: 'linear', domain: [1, 1]
      },
      nodeLabel: {
        field: this.nodeFields[0], size: 20, visible: false
      },
      edgeColor: {
        field: this.edgeFields[0], rangePreset: 'monogray',
        scale: 'linear', domain: [0, 1]
      },
      edgeWidth: {
        field: this.edgeFields[0], rangePreset: 'medium',
        scale: 'linear', domain: [0.5, 1]
      },
      edgeLabel: {
        field: this.edgeFields[0], size: 12, visible: false
      }
    };
    this.snapshots = session.snapshots || [];
    this.snapshotIndex = this.snapshots.length - 1;
  }

  updateSnapshot(idx) {
    if (idx >= 0) {  // idx = -1 -> no snapshots (default configuration)
      this.stateChanged = false;
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
    this.updateSnapshotCallback();
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
    // fnodes and fedges used for force layout
    // called by filter
    this.fnodes = this.nodes;
    this.fedges = this.edges;
    this.filters.forEach(cond => {
      const isNode = cond.field.startsWith("node.");
      const field = cond.field.substring(5);
      const type = this.fieldTypeMap[cond.field];
      if (isNode) {
        if (type === "numeric") {
          this.fnodes = this.fnodes.filter(
            e => misc.operatorFunction(cond.operator)(e[field], cond.value));
        } else if (type === "categorical") {
          this.fnodes = this.fnodes.filter(e => cond.groups.includes(e[field]));
        }
        // node-induced subgraph edges
        const fn = new Set(this.fnodes.map(e => e.__index));
        this.fedges = this.fedges.filter(e => {
          return fn.has(e.__source) && fn.has(e.__target);
        });
      } else { // edge
        if (type === "numeric") {
          this.fedges = this.fedges.filter(
            e => misc.operatorFunction(cond.operator)(e[field], cond.value));
        } else if (type === "categorical") {
          this.fedges = this.fedges.filter(e => cond.groups.includes(e[field]));
        }
      }
    });
    this.updateFilterCallback();
    this.zoomCallback();
    this.updateVisibility();
  }

  setViewBox(width, height) {  // dispatcher: resize browser
    super.setViewBox(width, height);
    this.resizeCallback();  // component.updateView()
  }

  setTransform(tx, ty, tk) {
    super.setTransform(tx, ty, tk);
    this.updateVisibility();
  }

  setBoundary() {
    // TODO: only used for fit operation
    // called by node coords operations (force, drug, ...)
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

  fitTransform() {  // dispatcher: fit button
    this.setBoundary();
    this.stateChanged = true;
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
    this.zoomCallback();
    this.updateVisibility();
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
    //console.log(JSON.parse(JSON.stringify(this.vnodes)))
    this.updateVisibilityCallback();
    this.updateMenuButtonCallback();
  }

}
