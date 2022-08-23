
/** @module network/interaction */

import d3 from 'd3';

import {default as component} from './component.js';


function dragListener(selection, state) {
  return d3.drag()
    .on('drag', event => {
      if (event.subject.__selected) {
        // multi selected node
        selection.selectAll(".node")
          .filter(d => d.__selected)
          .each(d => {
            d.x += event.dx;
            d.y += event.dy;
          });
        selection.selectAll(".node")
          .filter(d => d.__selected)
          .call(component.updateNodeCoords);
        selection.selectAll(".link")
          .filter(d => d.source.__selected || d.target.__selected)
          .call(component.updateEdgeCoords);
      } else {
        // single node
        event.subject.x = event.x;
        event.subject.y = event.y;
        const n = event.subject.__index;
        d3.selectAll(".node")
          .filter(d => d.__index == n)
          .call(component.updateNodeCoords);
        selection.selectAll(".link")
          .filter(d => d.source.__index == n || d.target.__index == n)
          .call(component.updateEdgeCoords);
      }
    });
}


function zoomListener(selection, state) {
  const p = {x: 0, y: 0, k: 1};  // previous transform
  selection
    .on("dblclick.zoom", null)  // disable double-click zoom
    .on('.drag', null);  // disable rectSelect
  return d3.zoom()
    .on('zoom', event => {
      const t = event.transform;
      selection.select('.field')
          .attr('transform', `translate(${t.x}, ${t.y}) scale(${t.k})`)
      // Smooth transition (continuously update components on zoom out)
      // only work for showNodeImage=false due to performance reason
      if (!state.showNodeImage) {
        const xMoved = t.x > p.x + 20 || t.x < p.x - 20;
        const yMoved = t.y > p.y + 20 || t.y < p.y - 20;
        const zoomIn = t.k > p.k;
        if (xMoved || yMoved && !zoomIn) {
          state.setTransform(t.x, t.y, t.k);
          p.x = t.x;
          p.y = t.y;
          p.k = t.k;
          state.updateComponentNotifier();
        }
      }
    })
    .on('end', event => {
      const t = event.transform;
      state.setTransform(t.x, t.y, t.k);
      p.x = t.x;
      p.y = t.y;
      p.k = t.k;
      state.updateComponentNotifier();
    });
}


function rectSelectListener(selection, state) {
  selection.on('.zoom', null);  // disable zoom
  const rect = selection.select('.interactions .rect-select');
  const origin = {x: 0, y: 0};
  const p = new Set();  // previous selection
  selection.selectAll('.node')
    .each(d => {
      if (d.__selected) { p.add(d.__index); }
    });
  return d3.drag()
    .on('start', event => {
      origin.x = event.x;
      origin.y = event.y;
      rect.attr('visibility', 'visible')
          .attr('x', origin.x).attr('y', origin.y);
    })
    .on('drag', event => {
      const left = Math.min(origin.x, event.x);
      const width = Math.abs(origin.x - event.x);
      const top = Math.min(origin.y, event.y);
      const height = Math.abs(origin.y - event.y);
      rect.attr('x', left).attr('y', top)
        .attr('width', width).attr('height', height);
      const tf = state.transform;
      const xConv = x => (x - tf.x) / tf.k;
      const yConv = y => (y - tf.y) / tf.k;
      const l = xConv(left);
      const t = yConv(top);
      const r = xConv(left + width);
      const b = yConv(top + height);
      selection.selectAll('.node')
        .each(function(d) {
          const inside = d.x > l && d.y > t && d.x < r && d.y < b;
          state.nodes[d.__index].__selected = p.has(d.__index) !== inside;
        });
      selection.selectAll(".node")
        .call(component.updateNodeSelection);
    })
    .on('end', function () {
      p.clear();
      selection.selectAll('.node')
        .each(d => {
          if (d.__selected) { p.add(d.__index); }
        });
      rect.attr('visibility', 'hidden')
          .attr('width', 0).attr('height', 0);
    });
}


function selectListener(selection, state) {
  return node => {
    node.on('touchstart', event => { event.preventDefault(); })
        .on('touchmove', event => { event.preventDefault(); })
        .on('click.select', event => {
          event.stopPropagation();
          state.nodes.forEach((e, i) => {
            state.nodes[i].__selected = false;
          });
          const n = d3.select(event.currentTarget).datum().__index;
          state.nodes[n].__selected = true
          selection.selectAll(".node")
            .call(component.updateNodeSelection);
        });
  };
}


function multiSelectListener(selection, state) {
  return node => {
    node.on('touchstart', event => { event.preventDefault(); })
        .on('touchmove', event => { event.preventDefault(); })
        .on('click.select', event => {
          event.stopPropagation();
          const n = d3.select(event.currentTarget).datum().__index;
          state.nodes[n].__selected = state.nodes[n].__selected ? false : true;
          selection.selectAll(".node")
            .call(component.updateNodeSelection);
        });
  };
}


function resume(selection, tf) {
  selection
      .call(
        d3.zoom().transform,
        d3.zoomIdentity.translate(tf.x, tf.y).scale(tf.k)
      )
    .select('.field')
      .attr('transform', `translate(${tf.x}, ${tf.y}) scale(${tf.k})`);
}


function interactionComponent(selection) {
  // Rectangle selection layer
  selection.append('g')
      .classed('interactions', true)
    .append('rect')
      .classed('rect-select', true)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5')
      .attr('visibility', 'hidden');
}


function setInteraction(selection, state) {
  // Background click to clear selection
  selection
      .on('touchstart', event => { event.preventDefault(); })
      .on('touchmove', event => { event.preventDefault(); })
      .on('click', event => {
        state.nodes.forEach((e, i) => {
          state.nodes[i].__selected = false;
        });
        selection.selectAll(".node")
          .call(component.updateNodeSelection);
      });

  // Enter multiple select mode
  document.addEventListener('keydown', event => {
    if (event.key !== 'Shift') return;
    selection.style("cursor", "crosshair");
    state.zoomListener = rectSelectListener(selection, state);
    state.selectListener = multiSelectListener(selection, state);
    state.updateInteractionNotifier();
  });

  // Exit multiple select mode
  document.addEventListener('keyup', event => {
    if (event.key !== 'Shift') return;
    selection.style("cursor", "auto");
    state.zoomListener = zoomListener(selection, state);
    state.selectListener = selectListener(selection, state);
    state.updateInteractionNotifier();
  });

  // Event listeners
  state.zoomListener = zoomListener(selection, state);
  state.selectListener = selectListener(selection, state);
  state.dragListener = dragListener(selection, state);

  // Update interaction events
  state.updateInteractionNotifier = () => {
    selection.call(state.zoomListener);
    selection.selectAll('.node').call(state.selectListener);
    selection.selectAll('.node').call(state.dragListener);
    selection.call(resume, state.transform);
  };

  // Fit to the viewBox
  state.fitNotifier = () => {
    state.fitTransform();
    state.updateComponentNotifier();
    selection.call(resume, state.transform);
  };
}


export default {
  dragListener, zoomListener, interactionComponent, setInteraction
};
