
/** @module network/state */

import TransformState from  '../common/transform.js';


export default class NetworkState extends TransformState {
  constructor(session) {
    super(1200, 1200, null);
    // Session properties
    this.sessionName = session.name;

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
    this.applySnapshot(snapshot)
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
