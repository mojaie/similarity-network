
/** @module network/force */

import d3 from 'd3';

import {default as interaction} from './interaction.js';


const forceParam = {
  dense: {
    name: 'Dense',
    force: d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.__index).distance(60).strength(1))
      .force('charge',
        d3.forceManyBody().strength(-600).distanceMin(15).distanceMax(720))
      .force('collide', d3.forceCollide().radius(90))
      .force('x', d3.forceX().strength(0.002))
      .force('y', d3.forceY().strength(0.002))
  },
  moderate: {
    name: 'Moderate',
    force: d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.__index).distance(60).strength(1.3))
      .force('charge',
        d3.forceManyBody().strength(-2000).distanceMin(15).distanceMax(1200))
      .force('collide', d3.forceCollide().radius(90))
      .force('x', d3.forceX().strength(0.005))
      .force('y', d3.forceY().strength(0.005))
  },
  sparse: {
    name: 'Sparse',
    force: d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.__index).distance(60).strength(2))
      .force('charge',
        d3.forceManyBody().strength(-6000).distanceMin(15).distanceMax(3600))
      .force('collide', d3.forceCollide().radius(90))
      .force('x', d3.forceX().strength(0.01))
      .force('y', d3.forceY().strength(0.01))
  }
};


function forceSimulation(type, width, height) {
  return forceParam[type].force
    .force('center', d3.forceCenter(width / 2, height / 2))
    .stop();
}


function forceDragListener(selection, simulation, state) {
  return d3.drag()
    .on('start', event => {
      state.stateChanged = true;
      if (!event.active) state.relaxDispatcher();
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
}


function unstick(selection, simulation, state) {
  selection.selectAll('.node')
    .each(d => {
      d.fx = null;
      d.fy = null;
    });
  state.dragListener = forceDragListener(selection, simulation, state);
  state.stateChanged = true;
  state.forceActive = true;
}


function setForce(selection, state) {
  state.setForceDispatcher = () => {
    const simulation = forceSimulation(
        state.config.forceParam, state.fieldWidth, state.fieldHeight);
    simulation.nodes(state.fnodes)
      .force('link').links(state.fedges);
    simulation
      .on('tick', () => {
        state.tickCallback(simulation);
      })
      .on('end', () => {
        state.tickCallback(simulation);
        state.updateVisibility();
      });

    state.stickDispatcher = () => {
      selection.call(stick, simulation, state);
    };
    state.relaxDispatcher = () => {
      selection.call(unstick, simulation, state);
      simulation.alpha(0.1).restart();
    };
    state.restartDispatcher = () => {
      selection.call(unstick, simulation, state);
      simulation.alpha(1).restart();
    };
    state.resetCoordsDispatcher = () => {
      selection.selectAll('.node')
        .each(d => {
          delete d.x;
          delete d.y;
          delete d.vx;
          delete d.vy;
          delete d.fx;
          delete d.fy;
        });
      simulation.nodes(state.fnodes).alpha(1).restart();
    };
  };
}


export default {
  forceParam, forceSimulation, setForce
};
