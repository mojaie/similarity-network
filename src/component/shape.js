
/** @module component/shape */

import {default as misc} from '../common/misc.js';


function monocolorBar(selection, colors, length, tooltip) {
  const group = selection.append('svg')
      .attr('width', length)
      .attr('viewBox', `0 0 ${length} 10`)
      .attr('preserveAspectRatio', 'none')
    .append('g')
      .attr("title", tooltip)
    .append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', length).attr('height', 10)
      .attr('fill', colors[0]);
}

function bicolorBar(selection, colors, length, tooltip) {
  const id = misc.uuidv4().slice(0, 8);  // Aboid inline SVG ID dupulicate
  selection.call(monocolorBar, colors, length, tooltip);
  const grad = selection.select("svg").append('defs')
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

function categoricalBar(selection, colors, length, tooltip) {
  const group = selection.append('svg')
      .attr('width', length)
      .attr('viewBox', `0 0 ${length} 10`)
      .attr('preserveAspectRatio', 'none')
    .append('g')
      .attr("title", tooltip);
  const sw = length / colors.length;
  colors.forEach((e, i) => {
    group.append('rect')
        .attr('x', sw * i).attr('y', 0)
        .attr('width', sw).attr('height', 10)
        .attr('fill', colors[i]);
  });
}

function setSize(selection, width, height) {
  selection.attr('width', width).attr('height', height);
}


function colorBar(range) {
  if (range.length == 1) return monocolorBar;
  if (range.length == 2) return bicolorBar;
  return categoricalBar;
};


export default {
  colorBar, setSize
};
