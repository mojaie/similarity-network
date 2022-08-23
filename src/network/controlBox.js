
/** @module network/controlBox */

import d3 from 'd3';

import {default as misc} from '../common/misc.js';
import {default as cscale} from '../common/scale.js';

import {default as badge} from '../component/badge.js';
import {default as box} from '../component/formBox.js';
import {default as lbox} from '../component/formListBox.js';
import {default as button} from '../component/button.js';

import {default as force} from './force.js';



function LayoutControlBox(selection) {
  // Fit
  selection.append('div')
      .classed('mb-0', true)
      .classed('fit', true)
      .call(button.buttonBox, 'Fit to screen', 'outline-primary');
  // Stick
  selection.append('div')
      .classed('mb-3', true)
      .classed('stick', true)
      .call(box.checkBox, 'Stick nodes');

  // Force control
  selection.append('div')
      .classed('forceparam', true)
      .classed('mb-1', true)
      .classed('align-items-center', true)
      .call(lbox.selectBox, 'Force parameter')
      .call(lbox.updateSelectBoxOptions, Object.keys(force.forceParam));
  const forceBox = selection.append('div')
      .classed('mb-3', true)
  forceBox.append('label')
      .classed('form-label', true)
      .classed('mb-0', true)
      .text('Temperature');
  forceBox.append('div')
      .classed('temperature', true)
      .classed('progress', true)
      .classed('mb-2', true)
    .append('div')
      .classed('progress-bar', true)
      .classed('w-30', true)
      .attr('id', 'temperature')
      .attr('role', 'progressbar')
      .attr('aria-valuemin', 0)
      .attr('aria-valuemax', 100);
  const activateButtons = forceBox.append('div')
      .classed('row', true);
  activateButtons.append('div')
      .classed('perturb', true)
      .classed('col-4', true)
      .call(button.buttonBox, 'Perturb', 'outline-success');
  activateButtons.append('div')
      .classed('random', true)
      .classed('col-4', true)
      .call(button.buttonBox, 'Random', 'outline-warning');
}

function updateLayoutControl(selection, state) {
  // Fit
  selection.select('.fit')
      .on('click', function () {
        state.fitNotifier();
      });
  // Force layout
  state.tickCallback = (simulation) => {
    const alpha = simulation.alpha();
    const isStopped = alpha <= simulation.alphaMin();
    const progress = parseInt(isStopped ? 0 : alpha * 100);
    selection.select('.temperature')
      .select('.progress-bar')
        .classed('bg-success', isStopped)
        .classed('bg-warning', !isStopped)
        .style('width', `${progress}%`)
        .attr('aria-valuenow', progress);
  };
  selection.select('.stick')
      .call(box.updateCheckBox, !state.forceActive)
      .on('change', function () {
        const value = box.checkBoxValue(d3.select(this));
        state.forceActive = !value;
        selection.select('.temperature')
            .style('background-color', value ? '#a3e4d7' : '#e9ecef')
          .select('.progress-bar')
            .style('width', `0%`)
            .attr('aria-valuenow', 0);
        value ? state.stickNotifier() : state.relaxNotifier();
        state.updateComponentNotifier();
      });
  selection.select('.forceparam')
      .call(lbox.updateSelectBoxValue, state.config.forceParam)
      .on('change', () => {
        state.config.forceParam = lbox.selectBoxValue(selection);
        state.setForceNotifier();
      });
  selection.select('.perturb')
      .on('click', function () {
        // TODO: disabled by stick
        selection.select('.stick')
            .call(box.updateCheckBox, false)
            .dispatch('change');
        state.restartNotifier();
      });
  // TODO: random

}



/*
- filter
  - add filter: button
  - remove filter: button
  - numeric
    - key: select
    - value: numeric
    - condition: select
  - nominal
    - key: checkboxlist
    - select/deselect all
*/

function FilterControlBox(selection) {
  // New filter
  selection.append('div')
      .classed('mb-3', true)
      .classed('newfilter', true)
      .call(button.buttonBox, '+ New filter', 'outline-primary');
  // filters
  selection.append('div')
      .classed('mb-3', true)
      .classed('filter-container', true);
}

function updateFilterControl(selection, state) {

}



function NodeControlBox(selection) {
  // Node color
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Node color");
  // Color field
  selection.append('div')
      .classed('colorfield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // Color range preset
  selection.append('div')
      .classed('colorrange', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.colorScaleBox, 'Range')
      .call(lbox.updateColorScaleItems, Object.keys(cscale.scales.color));
  // Color scale type
  selection.append('div')
      .classed('colorscale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale')
      .call(lbox.updateSelectBoxOptions, Object.keys(cscale.types));

  // Node size
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Node size");
  // Size field
  selection.append('div')
      .classed('sizefield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // Size range preset
  selection.append('div')
      .classed('sizerange', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Range')
      .call(lbox.updateSelectBoxOptions, Object.keys(cscale.scales.nodeSize));
  // Size scale type
  selection.append('div')
      .classed('sizescale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale')
      .call(lbox.updateSelectBoxOptions, Object.keys(cscale.types))

  // Node label
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Node label");
  // Label visibility
  selection.append('div')
      .classed('labelvisible', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.checkBox, 'Show labels');
  // Label field
  selection.append('div')
      .classed('labelfield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // Label font size
  selection.append('div')
      .classed('labelsize', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.numberBox, 'Font size')
      .call(box.updateNumberRange, 0.1, 999, 0.1)
      .call(badge.updateInvalidMessage,
            'Please provide a valid number (0.1-999)')
    .select('.form-control')
      .attr('required', 'required');

  // Other settings
  selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Settings");
  selection.append('div')
      .classed('shownodeimage', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.checkBox, 'Always show node images');
}

function updateNodeControl(selection, state) {
  selection.on('change', () => {
    state.stateChanged = true;
    state.updateNodeAttrNotifier();
  });

  selection.select('.colorfield')
      .call(lbox.updateSelectBoxOptions, state.nodeFields)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeColor.field)
      .on('change', () => {
        state.appearance.nodeColor.field = lbox.selectBoxValue(selection);
      });
  selection.select('.colorrange')
      .call(lbox.updateColorScaleBox, state.appearance.nodeColor.rangePreset)
      .on('change', () => {
        state.appearance.nodeColor.rangePreset = lbox.colorScaleBoxValue(selection);
      });
  selection.select('.colorscale')
      .call(lbox.updateSelectBoxValue, state.appearance.nodeColor.scale)
      .on('change', () => {
        state.appearance.nodeColor.scale = lbox.selectBoxValue(selection);
      });

  selection.select('.sizefield')
      .call(lbox.updateSelectBoxOptions, state.nodeFields)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeSize.field)
      .on('change', () => {
        state.appearance.nodeSize.field = lbox.selectBoxValue(selection);
      });
  selection.select('.sizerange')
      .call(lbox.updateSelectBoxValue, state.appearance.nodeSize.rangePreset)
      .on('change', () => {
        state.appearance.nodeSize.rangePreset = lbox.selectBoxValue(selection);
      });
  selection.select('.sizescale')
      .call(lbox.updateSelectBoxValue, state.appearance.nodeSize.scale)
      .on('change', () => {
        state.appearance.nodeSize.scale = lbox.selectBoxValue(selection);
      });

  selection.select('.labelvisible')
      .call(box.updateCheckBox, state.appearance.nodeLabel.visible)
      .on('change', () => {
        state.appearance.nodeLabel.visible = box.checkBoxValue(selection);
      });
  selection.select('.labelfield')
      .call(lbox.updateSelectBoxOptions, state.nodeFields)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeLabel.field)
      .on('change', () => {
        state.appearance.nodeLabel.field = lbox.selectBoxValue(selection);
      });
  selection.select('.labelsize')
      .call(box.updateFormValue, state.appearance.nodeLabel.size)
      .on('change', () => {
        state.appearance.nodeLabel.size = box.formValue(selection);
      });

  selection.select('.shownodeimage')
      .call(box.updateCheckBox, state.config.alwaysShowNodeImage)
      .on('change', event => {
        state.stateChanged = false;
        state.config.alwaysShowNodeImage = box.checkBoxValue(selection);
        state.updateComponentNotifier();
        event.stopPropagation();
      });
}

function EdgeControlBox(selection) {
  // Edge color
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Edge color");
  // Color field
  selection.append('div')
      .classed('colorfield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // Color range preset
  selection.append('div')
      .classed('colorrange', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.colorScaleBox, 'Range')
      .call(lbox.updateColorScaleItems, Object.keys(cscale.scales.color));
  // Color scale type
  selection.append('div')
      .classed('colorscale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale')
      .call(lbox.updateSelectBoxOptions, Object.keys(cscale.types));

  // Edge width
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Edge width");
  // Width field
  selection.append('div')
      .classed('widthfield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // Width range preset
  selection.append('div')
      .classed('widthrange', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Range')
      .call(lbox.updateSelectBoxOptions, Object.keys(cscale.scales.edgeWidth));
  // Width scale type
  selection.append('div')
      .classed('widthscale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale')
      .call(lbox.updateSelectBoxOptions, Object.keys(cscale.types))

  // Edge label
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Edge label");
  // Label visibility
  selection.append('div')
      .classed('labelvisible', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.checkBox, 'Show labels');
  // Label field
  selection.append('div')
      .classed('labelfield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // Label font size
  selection.append('div')
      .classed('labelsize', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.numberBox, 'Font size')
      .call(box.updateNumberRange, 0.1, 999, 0.1)
      .call(badge.updateInvalidMessage,
            'Please provide a valid number (0.1-999)')
    .select('.form-control')
      .attr('required', 'required');

  // Other settings
  selection.append('div')
      .classed('mb-1', true)
      .classed('small', true)
      .text("Settings");
  selection.append('div')
      .classed('showedge', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.checkBox, 'Always show edges');
}

function updateEdgeControl(selection, state) {
  selection.select('.colorfield')
      .call(lbox.updateSelectBoxOptions, state.edgeFields)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeColor.field)
      .on('change', () => {
        state.stateChanged = true;
        state.appearance.edgeColor.field = lbox.selectBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });
  selection.select('.colorrange')
      .call(lbox.updateColorScaleBox, state.appearance.edgeColor.rangePreset)
      .on('change', () => {
        state.appearance.edgeColor.rangePreset = lbox.colorScaleBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });
  selection.select('.colorscale')
      .call(lbox.updateSelectBoxValue, state.appearance.edgeColor.scale)
      .on('change', () => {
        state.appearance.edgeColor.scale = lbox.selectBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });

  selection.select('.widthfield')
      .call(lbox.updateSelectBoxOptions, state.edgeFields)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeWidth.field)
      .on('change', () => {
        state.appearance.edgeWidth.field = lbox.selectBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });
  selection.select('.widthrange')
      .call(lbox.updateSelectBoxValue, state.appearance.edgeWidth.rangePreset)
      .on('change', () => {
        state.appearance.edgeWidth.rangePreset = lbox.selectBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });
  selection.select('.widthscale')
      .call(lbox.updateSelectBoxValue, state.appearance.edgeWidth.scale)
      .on('change', () => {
        state.appearance.edgeWidth.scale = lbox.selectBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });

  selection.select('.labelvisible')
      .call(box.updateCheckBox, state.appearance.edgeLabel.visible)
      .on('change', () => {
        state.appearance.edgeLabel.visible = box.checkBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });
  selection.select('.labelfield')
      .call(lbox.updateSelectBoxOptions, state.edgeFields)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeLabel.field)
      .on('change', () => {
        state.appearance.edgeLabel.field = lbox.selectBoxValue(selection);
        state.updateEdgeAttrNotifier();
      });
  selection.select('.labelsize')
      .call(box.updateFormValue, state.appearance.edgeLabel.size)
      .on('change', () => {
        state.appearance.edgeLabel.size = box.formValue(selection);
        state.updateEdgeAttrNotifier();
      });

  selection.select('.showedge')
      .call(box.updateCheckBox, state.config.alwaysShowEdge)
      .on('change', event => {
        state.stateChanged = true;
        state.config.alwaysShowEdge = box.checkBoxValue(selection);
        state.updateComponentNotifier();
        event.stopPropagation();
      });
}




/*
- statistics (filter applied)
  - node count
  - edge count
  - logD (edge density)
  - number of connected components
  - number of isolated nodes
  - average path length
  - clustering coefficient
*/


function StatisticsBox(selection) {
  selection
      .classed('small', true);
  // Components
  const nodecount = selection.append('div')
      .classed('row', true);
  nodecount.append('div')
      .classed('col-6', true)
      .text("Node count:");
  nodecount.append('div')
      .classed('col-6', true)
      .classed("nodecount", true);
  const edgecount = selection.append('div')
      .classed('row', true);
  edgecount.append('div')
      .classed('col-6', true)
      .text("Edge count:");
  edgecount.append('div')
      .classed('col-6', true)
      .classed("edgecount", true);

  const logd = selection.append('div')
      .classed('row', true);
  logd.append('div')
      .classed('col-6', true)
      .text("logD:");
  logd.append('div')
      .classed('col-6', true)
      .classed("logd", true);
}


function updateStatistics(selection, state) {
  const ncnt = state.fnodes.length;
  const ecnt = state.fedges.length;
  const maxedges = ncnt * (ncnt - 1) / 2;
  const logd = d3.format('.2f')(Math.log10(ecnt / maxedges));

  selection.select('.nodecount')
      .text(ncnt);
  selection.select('.edgecount')
      .text(ecnt);
  selection.select('.logd')
      .text(logd);
}




function controlBoxNav(selection, id, label, active) {
  selection
      .classed('nav-item', true)
      .attr('role', 'presentation')
    .append("button")
      .classed('nav-link', true)
      .classed('active', active)
      .classed('py-1', true)
      .attr('id', `${id}-tab`)
      .attr('data-bs-toggle', 'tab')
      .attr('data-bs-target', `#${id}`)
      .attr('type', 'button')
      .attr('role', 'tab')
      .attr('aria-controls', id)
      .attr('aria-selected', active ? "true" : "false")
      .text(label);
}


function controlBoxItem(selection, id, active) {
  selection
      .classed('tab-pane', true)
      .classed('fade', true)
      .classed('px-0', true)
      .classed('show', active)
      .classed('active', active)
      .attr('id', id)
      .attr('role', 'tabpanel')
      .attr('aria-labelledby', `${id}-tab`);
}



function controlBox(selection) {
  // Clean up
  selection.select(".nav-tabs").remove();
  selection.select(".tab-content").remove();

  const tabs = selection.append("ul")
      .classed("nav", true)
      .classed("nav-tabs", true)
      .attr("id", "control-tab")
      .attr("role", "tablist");
  const content = selection.append("div")
      .classed("tab-content", true)
      .classed('p-2', true)
      .attr("id", "control-tab-content");

  // Layout
  tabs.append('li')
      .call(controlBoxNav, 'control-layout', 'Layout', true);
  content.append('div')
      .call(controlBoxItem, 'control-layout', true)
      .call(LayoutControlBox);

  // Filter
  tabs.append('li')
      .call(controlBoxNav, 'control-filter', 'Filter', false);
  content.append('div')
      .call(controlBoxItem, 'control-filter', false)
      .call(FilterControlBox);

  // Node
  tabs.append('li')
      .call(controlBoxNav, 'control-node', 'Node', false);
  content.append('div')
      .call(controlBoxItem, 'control-node', false)
      .call(NodeControlBox);

  // Edge
  tabs.append('li')
      .call(controlBoxNav, 'control-edge', 'Edge', false);
  content.append('div')
      .call(controlBoxItem, 'control-edge', false)
      .call(EdgeControlBox);

  // Statistics
  tabs.append('li')
      .call(controlBoxNav, 'control-stat', 'Statistics', false);
  content.append('div')
      .call(controlBoxItem, 'control-stat', false)
      .call(StatisticsBox);
}


function updateControlBox(selection, state) {
  selection.select('#control-layout')
      .call(updateLayoutControl, state);
  selection.select('#control-filter')
      .call(updateFilterControl, state);
  selection.select('#control-node')
      .call(updateNodeControl, state);
  selection.select('#control-edge')
      .call(updateEdgeControl, state);
  selection.select('#control-stat')
      .call(updateStatistics, state);

  state.updateControlBoxNotifier = () => {
    selection.call(updateControlBox, state);
  };
}


export default {
  controlBox, updateControlBox
};
