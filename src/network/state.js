
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

    // Event listeners
    this.zoomListener = null;
    this.dragListener = null;

    // Event notifiers
    this.updateHeaderNotifier = () => {};
    this.updateComponentNotifier = () => {};
    this.updateViewNotifier = () => {};
    this.updateNodeAttrNotifier = () => {};
    this.updateEdgeAttrNotifier = () => {};
    this.updateLegendNotifier = () => {};
    this.updateControlBoxNotifier = () => {};
    this.updateInteractionNotifier = () => {};
    this.fitNotifier = () => {};
    this.setForceNotifier = () => {};
    this.stickNotifier = () => {};
    this.relaxNotifier = () => {};
    this.restartNotifier = () => {};
    this.tickCallback = () => {};
    this.updateAllNotifier = () => {
      this.updateHeaderNotifier();
      this.updateControlBoxNotifier();
      this.updateFilter();
      this.setForceNotifier();
      this.updateComponentNotifier();
    };

    // Initialize snapshot
    this.stateChanged = true;  // if true, there are unsaved changes
    this.snapshots = session.snapshots || [];
    if (this.snapshots.length == 0) { this.snapshots.push({}); }
    this.snapshotIndex = this.snapshots.length - 1;
    this.applySnapshot(this.snapshots[this.snapshotIndex]);
  }

  applySnapshot(snapshot) {
    this.name = snapshot.hasOwnProperty("name") ? snapshot.name : "default";
    this.filters = snapshot.hasOwnProperty("filters") ? snapshot.filters : [];
    this.positions = snapshot.hasOwnProperty("positions") ? snapshot.positions : [];
    this.forceActive = !snapshot.hasOwnProperty("positions");
    this.config = snapshot.hasOwnProperty("config") ? snapshot.config : {
      showNodeImageThreshold: 100,
      alwaysShowNodeImage: false,
      showEdgeThreshold: 500,
      alwaysShowEdge: false,
      legendOrient: 'none',
      showEdgeLegend: 'none',
      forceParam: 'dense'
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
    this.updateAllNotifier();
  }

  saveSnapshot() {
    const today = new Date();
    const positions = this.nodes.forEach(e => {
      return {x: e.x || 0.0, y: e.y || 0.0}
    });
    return {
      name: `snapshot - ${today.toLocaleString('jp')}`,
      filters: this.filters,
      positions: positions,
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

  updateVisibility() {
    this.vnodes = this.fnodes.filter(e => {
      return e.y > this.focusArea.top && e.x > this.focusArea.left
        && e.y < this.focusArea.bottom && e.x < this.focusArea.right;
    });
    const vn = this.vnodes.map(e => e.__index);
    this.vedges = this.fedges.filter(e => {
      return vn.includes(e.__source) || vn.includes(e.__target);
    });
  }

}
