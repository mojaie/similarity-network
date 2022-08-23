
/** @module network/state */

import TransformState from  '../common/transform.js';


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
    this.nodes.forEach((e, i) => {
      e.__index = i;  // internal id for d3.force
      e.__selected = false;  // for multiple selection
    })

    this.edges = session.edges;
    this.edgeFields = [...this.edges.reduce((a, b) => {
      Object.keys(b).forEach(e => { a.add(e); })
      return a;
    }, new Set())]  // unique keys
    this.edges.forEach((e, i) => {
      // internal id for d3.force
      e.__source = e.source;
      e.__target = e.target;
      e.__index = i;
    })


    // filtered elements
    this.fnodes = [];
    this.fedges = [];
    this.adjacency = [];

    // visible elements
    this.vnodes = [];
    this.vedges = [];

    // States
    this.showNodeImage = false;
    this.showEdge = false;
    this.forceActive = true;

    // Event listeners
    this.zoomListener = null;
    this.dragListener = null;

    // Event notifiers
    this.updateHeaderNotifier = () => {};
    this.updateControlBoxNotifier = () => {};
    this.updateViewNotifier = () => {};
    this.updateComponentNotifier = () => {};
    this.updateNodeAttrNotifier = () => {};
    this.updateEdgeAttrNotifier = () => {};
    this.updateInteractionNotifier = () => {};
    this.fitNotifier = () => {};
    this.setForceNotifier = () => {};
    this.stickNotifier = () => {};
    this.relaxNotifier = () => {};
    this.restartNotifier = () => {};
    this.tickCallback = () => {};
    this.setSnapshotCallback = () => {
      this.updateHeaderNotifier();
      this.updateControlBoxNotifier();
      this.updateFilter();
      this.setForceNotifier();
      this.updateViewNotifier();
    };


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
    this.snapshots = session.snapshots || [];
    this.snapshotIndex = this.snapshots.length - 1;
    this.applySnapshot(this.snapshotIndex);
  }

  setSnapshot(idx) {
    if (idx >= 0) {  // idx = -1 -> no snapshots (default configuration)
      // TODO transform
      this.forceActive = false;
      this.stateChanged = false;
      const snapshot = this.snapshots[idx];
      this.name = snapshot.name;
      this.filters = snapshot.filters;
      this.config = snapshot.config;
      this.appearance = snapshot.appearance;
      this.transform = snapshot.transform;
      snapshot.positions.forEach((e, i) => {
        this.nodes[i].x = e.x;
        this.nodes[i].y = e.y;
      });
    }
    this.setSnapshotCallback();
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
  setFilter() {
    // fnodes and fedges used for force layout
    // called by filter

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
    // this.setFilterCallback();
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

  setVisibility() {
    // vnodes and vedges used for component drawing
    // called by zoom and pan
    this.vnodes = this.fnodes.filter(e => {
      return e.y > this.focusArea.top && e.x > this.focusArea.left
        && e.y < this.focusArea.bottom && e.x < this.focusArea.right;
    });
    const vn = new Set(this.vnodes.map(e => e.__index));
    this.vedges = this.fedges.filter(e => {
      return vn.has(e.__source) || vn.has(e.__target);
    });
    // this.setVisibilityCallback();
  }

}
