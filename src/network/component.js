
/** @module network/component */

import d3 from 'd3';

import {default as scale} from '../common/scale.js';


function updateNodes(selection, records) {
  const nodes = selection.selectAll('.node')
    .data(records, d => d.__index);
  nodes.exit().remove();
  const entered = nodes.enter()
    .append('g')
      .attr('class', 'node');
  entered.append('circle')
      .attr('class', 'node-symbol');
  entered.append('foreignObject')
      .attr('class', 'node-image');
  entered.append('foreignObject')
      .attr('class', 'node-html')
    .append('xhtml:div');
  const merged = entered.merge(nodes)
      .call(updateNodeCoords);
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
  entered.merge(edges)
      .call(updateEdgeCoords);
}


function updateNodeAttrs(selection, state) {
  const colorField = state.appearance.nodeColor.field;
  const sizeField = state.appearance.nodeSize.field;
  const labelField = state.appearance.nodeLabel.field;
  const labelSize = state.appearance.nodeLabel.size;
  const labelVisible = state.appearance.nodeLabel.visible;
  const svgWidth = state.appearance.nodeImage.size;
  const svgHeight = state.appearance.nodeImage.size;
  const colorScaleFunc = scale.scaleFunction(
    state.appearance.nodeColor, state.nodeIQR[colorField], "color");
  const sizeScaleFunc = scale.scaleFunction(
    state.appearance.nodeSize, state.nodeIQR[sizeField], "size");
  selection.selectAll('.node').select('.node-symbol')
      .attr('r', d => sizeScaleFunc(d[sizeField]))
      .style('fill', d => colorScaleFunc(d[colorField]));
  const htwidth = 200;

  const fo = selection.selectAll('.node').select('.node-html');
  fo.attr('x', -htwidth / 2)
      .attr('y', d => state.showNodeImage ? svgWidth / 2 - 10 : sizeScaleFunc(d[sizeField]))
      .attr('width', htwidth)
      .attr('height', 1)
      .attr('overflow', 'visible');
  fo.select('div')
      .style('font-size', `${labelSize}px`)
      .style('color', d => d.labelColor || "#666666")
      .style('text-align', 'center')
      .style('display', labelVisible ? 'block' : 'none')
      .html(d => d[labelField]);

  const image = selection.selectAll('.node').select('.node-image')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('x', -svgWidth / 2)
      .attr('y', -svgHeight / 2)
    if (state.showNodeImage) {
      image.html(d => d[state.appearance.nodeImage.field]);
    } else {
      image.select('svg').remove();
    }
}


function updateEdgeAttrs(selection, state) {
  const colorField = state.appearance.edgeColor.field;
  const widthField = state.appearance.edgeWidth.field;
  const labelField = state.appearance.edgeLabel.field;
  const labelSize = state.appearance.edgeLabel.size;
  const labelVisible = state.appearance.edgeLabel.visible;
  const colorScaleFunc = scale.scaleFunction(
    state.appearance.edgeColor, state.edgeIQR[colorField], "color");
  const widthScaleFunc = scale.scaleFunction(
    state.appearance.edgeWidth, state.edgeIQR[widthField], "width");
  selection.selectAll('.link').select('.edge-line')
    .style('stroke', d => colorScaleFunc(d[colorField]))
    .style('stroke-width', d => widthScaleFunc(d[widthField]));
  selection.selectAll('.link').select('.edge-label')
    .attr('font-size', labelSize)
    .attr('visibility', labelVisible ? 'inherit' : 'hidden')
    .style('fill', d => d.labelColor || "#666666")
    .text(d => d[labelField]);
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


function updateComponents(selection, state) {
  selection.select('.node-layer')
    .call(updateNodes, state.vnodes)
    .call(updateNodeAttrs, state);
  selection.select('.edge-layer')
    .call(updateEdges, state.vedges)
    .call(updateEdgeAttrs, state);
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
}


function updateViewBox(selection, state) {
  selection
      .attr('viewBox', `0 0 ${state.viewBox.right} ${state.viewBox.bottom}`)
      .attr('width', `${state.viewBox.right}px`)
      .attr('height', `${state.viewBox.bottom}px`);
  selection.select(".boundary")
      .attr('width', state.viewBox.right)
      .attr('height', state.viewBox.bottom);
}


function updateField(selection, state) {
  const tf = state.transform;
  selection.select('.field')
      .attr('transform', `translate(${tf.x}, ${tf.y}) scale(${tf.k})`);
}


function setViewCallbacks(selection, state) {
  state.register("updateViewBox", () => {
    selection.call(updateViewBox, state);
  });
  state.register("updateField", () => {
    selection.call(updateField, state);
  });
  state.register("updateVisibility", () => {
    selection.call(updateComponents, state);
  });
  state.register("updateNodeAttr", () => {
    selection.select(".node-layer").call(updateNodeAttrs, state);
  });
  state.register("updateEdgeAttr", () => {
    selection.select(".edge-layer").call(updateEdgeAttrs, state);
  });
  state.register("updateCoords", () => {
    selection.selectAll(".node").call(updateNodeCoords);
    selection.selectAll(".link").call(updateEdgeCoords);
  });
}


export default {
  updateNodes, updateEdges, updateNodeCoords, updateEdgeCoords,
  updateNodeAttrs, updateEdgeAttrs, updateNodeSelection,
  updateComponents, viewComponent, updateViewBox, updateField, setViewCallbacks
};
