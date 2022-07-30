
/** @module network/state */

import TransformState from  '../common/transform.js';


export default class NetworkState extends TransformState {
  constructor(session) {
    this.session = session;

    // load snapshot
    if (!session.hasOwnProperty('snapshot')) {
      this.session.snapshot = [{
        fieldTransform: {x: 0, y: 0, k: 1},
        config: {
          showNodeImageThreshold: 100,
          alwaysShowNodeImage: false,
          showEdgeThreshold: 500,
          alwaysShowEdge: false,
          legendOrientation: 'top-left'
        },
        appearance: {
          nodecolor: {
            field: null, rangePreset: 'green',
            scale: 'linear', domain: [0, 1]
          },
          nodeSize: {
            field: null, range: 'medium',
            scale: 'linear', domain: [1, 1]
          },
          nodeLabel: {
            field: null, size: 20, visible: false
          },
          edgeColor: {
            field: null, rengePreset: 'gray',
            scale: 'linear', domain: [0, 1]
          },
          edgeWidth: {
            field: null, scale: 'linear', domain: [0.5, 1],
            range: [10, 10], unknown: 1
          },
          edgeLabel: {
            field: null, size: 12, visible: false
          }
        }
      }]
    }

    super(1200, 1200, session.snapshot.slice(-1)[0].fieldTransform);

    /* Settings */

    this.currentSnapshot = session.snapshot.length - 1
    this.showNodeImage = false;
    this.showEdge = false;

    // Filter
    this.filter = session.filter || [];

    // Force
    this.coords = session.snapshot.coords;
    this.forceActive = !this.coords;
    this.forceParam = session.config.forceParam || 'aggregate';

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

  saveSnapshot(idb) {
    this.coords = this.ns.map(n => ({x: n.x, y: n.y}));
    return idb.updateItem(this.instance, item => {
      item.snapshot[this.currentSnapshot] = this.session.snapshot
    });
  }

  export() {
    return this.session
  }
}
