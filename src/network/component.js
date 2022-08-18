
/** @module network/component */

import d3 from 'd3';

import {default as scale} from '../common/scale.js';
import {default as misc} from '../common/misc.js';

import {default as legend} from '../component/legend.js';
import {default as transform} from '../component/transform.js';


const svgWidth = 180;  //TODO
const svgHeight = 180;  //TODO


function updateNodes(selection, records, showStruct) {
  const nodes = selection.selectAll('.node')
    .data(records, d => d.__index);
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
    .data(records, d => d.__index);
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
  const colorScaleFunc = scale.scaleFunction(state.appearance.nodeColor, "color");
  const sizeScaleFunc = scale.scaleFunction(state.appearance.nodeSize, "nodeSize");
  const labelField = state.appearance.nodeLabel.field;
  const textFormatFunc = value => {
    return value
    // return labelField.format === 'd3_format'
    //  ? misc.formatNum(value, labelField.d3_format) : value;
  };
  selection.selectAll('.node').select('.node-symbol')
      .attr('r', d => sizeScaleFunc(d[state.appearance.nodeSize.field]))
      .style('fill', d => colorScaleFunc(d[state.appearance.nodeColor.field]));
  // TODO: tidy up (like rowFactory?)
  const htwidth = 200;
  const fo = selection.selectAll('.node').select('.node-html');
  fo.attr('x', -htwidth / 2)
    .attr('y', d => state.showNodeImage ? svgWidth / 2 - 10
      : parseFloat(sizeScaleFunc(d[state.appearance.nodeSize.field])))
    .attr('width', htwidth)
    .attr('height', 1)
    .attr('overflow', 'visible');
  fo.select('div')
    .style('font-size', `${state.appearance.nodeLabel.size}px`)
    .style('color', d => d.labelColor || "#cccccc")
    .style('text-align', 'center')
    .style('display', state.appearance.nodeLabel.visible ? 'block' : 'none')
    .html(d => textFormatFunc(d[state.appearance.nodeLabel.field]));
}


function updateEdgeAttrs(selection, state) {
  const colorScaleFunc = scale.scaleFunction(state.appearance.edgeColor, "color");
  const widthScaleFunc = scale.scaleFunction(state.appearance.edgeWidth, "edgeWidth");
  const labelField = state.appearance.edgeLabel.field;
  const textFormatFunc = value => {
    return value
    //return labelField.format === 'd3_format'
    //  ? misc.formatNum(value, labelField.d3_format) : value;
  };
  selection.selectAll('.link').select('.edge-line')
    .style('stroke', d => colorScaleFunc(d[state.appearance.edgeColor.field]))
    .style('stroke-width', d => widthScaleFunc(d[state.appearance.edgeWidth.field]));
  selection.selectAll('.link').select('.edge-label')
    .attr('font-size', state.appearance.edgeLabel.size)
    .attr('visibility', state.appearance.edgeLabel.visible ? 'inherit' : 'hidden')
    .style('fill', d => d.labelColor || "#cccccc")
    .text(d => textFormatFunc(d[state.appearance.edgeLabel.field]));
}


function updateNodeCoords(selection) {
  selection.attr('transform', d => `translate(${d.x}, ${d.y})`);
}


function updateEdgeCoords(selection) {
  selection.attr('transform', d => `translate(${d.source.x}, ${d.source.y})`);
  selection.select('.edge-line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', d => d.target.x - d.source.x)
    .attr('y2', d => d.target.y - d.source.y);
  selection.select('.edge-label')
    .attr('x', d => (d.target.x - d.source.x) / 2)
    .attr('y', d => (d.target.y - d.source.y) / 2);
}

function updateNodeSelection(selection) {
  selection.select('.node-symbol')
    .attr('stroke', d => d.__selected ? 'red' : null)
    .attr('stroke-width', d => d.__selected ? 10 : null)
    .attr('stroke-opacity', d => d.__selected ? 0.5 : 0);
}

function updateAttrs(selection, state) {
  selection.call(updateNodeAttrs, state);
  selection.call(updateEdgeAttrs, state);
}


function updateComponents(selection, state) {
  selection.select('.node-layer')
    .call(updateNodes, state.vnodes, false);
  selection.select('.edge-layer')
    .call(updateEdges, state.vedges);
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


function move(selection, node, state, x, y) {
  const n = d3.select(node).call(moveNode, x, y).datum();
  selection.select('.edge-layer')
    .selectAll(".link")
    .filter(d => state.adjacency.map(e => e[1].__index).includes(d.__index))
    .each(function (d) {
      if (n.__index === d.source.index) {
        d3.select(this).call(moveEdge, x, y, d.target.x, d.target.y);
      } else if (n.__index === d.target.index) {
        d3.select(this).call(moveEdge, d.source.x, d.source.y, x, y);
      }
    });
}


function viewComponent(selection) {
  selection
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('pointer-events', 'all')
      .attr('viewBox', "0 0 0 0");

  // Boundary
  selection.append('rect')
      .classed('boundary', true)
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .attr('height', 0)
      .attr('fill', '#ffffff')
      .attr('stroke-width', 1)
      .attr('stroke', '#cccccc');

  // Field
  const field = selection.append('g')
      .classed('field', true)
      .style('opacity', 1e-6)
  field.transition()
      .duration(1000)
      .style('opacity', 1);
  field.append('g').classed('edge-layer', true);
  field.append('g').classed('node-layer', true);

  selection.append('g')
      .classed('legends', true)
    .append('g')
      .classed('nodecolor', true)
      .call(legend.colorBarLegend);
}


function updateView(selection, state) {
  selection
      .attr('viewBox', `0 0 ${state.viewBox.right} ${state.viewBox.bottom}`);
  selection.select(".boundary")
      .attr('width', state.viewBox.right)
      .attr('height', state.viewBox.bottom)

  // Apply changes in datasets
  state.updateAllNotifier = () => {
    state.updateFilter();
    state.updateVisibility();
    state.updateControlBoxNotifier();  // Update selectBox options
    state.setForceNotifier();
    state.updateComponentNotifier();
  };
  // Apply changes in nodes and edges displayed
  state.updateComponentNotifier = () => {
    // state.updateLegendNotifier();
    selection.call(updateComponents, state);
    state.updateInteractionNotifier();  // Apply drag events to each nodes
  };
  state.updateNodeNotifier = () => {
    selection.select(".node-layer").call(updateNodes, state.vnodes);
    // state.updateLegendNotifier();
  };
  state.updateEdgeNotifier = () => {
    selection.select(".edge-layer").call(updateEdges, state.vedges);
  };
  state.updateNodeAttrNotifier = () => {
    selection.select(".node-layer").call(updateNodeAttrs, state);
    // state.updateLegendNotifier();
  };
  state.updateEdgeAttrNotifier = () => {
    selection.select(".edge-layer").call(updateEdgeAttrs, state);
  };
  /*
  state.updateLegendNotifier = () => {
    legendGroup.call(legend.updateLegendGroup,
                     state.viewBox, state.legendOrient);
    legendGroup.select('.nodecolor')
        .attr('visibility', state.nodeColor.legend ? 'inherit' : 'hidden')
        .call(legend.updateColorBarLegend, state.nodeColor);
  };
  */
}


export default {
  updateNodes, updateEdges, updateNodeCoords, updateEdgeCoords,
  updateNodeAttrs, updateEdgeAttrs, updateNodeSelection,
  updateAttrs, updateComponents,
  move, moveEdge, viewComponent, updateView
};
