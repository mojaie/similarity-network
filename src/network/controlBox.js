
/** @module network/controlBox */

import d3 from 'd3';

import {default as misc} from '../common/misc.js';
import scale from '../common/scale.js';

import {default as badge} from '../component/badge.js';
import {default as box} from '../component/formBox.js';
import {default as lbox} from '../component/formListBox.js';
import {default as button} from '../component/button.js';
import modal from '../component/modal.js';

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
        state.fitDispatcher();
      });
  // Force layout
  state.updateForceIndicatorCallback = (simulation) => {
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
      .on('change', event => {
        const value = box.checkBoxValue(d3.select(event.currentTarget));
        state.forceActive = !value;
        selection.select('.temperature')
            .style('background-color', value ? '#a3e4d7' : '#e9ecef')
          .select('.progress-bar')
            .style('width', `0%`)
            .attr('aria-valuenow', 0);
        value ? state.stickDispatcher() : state.relaxDispatcher();
        state.updateVisibility();
      });
  selection.select('.forceparam')
      .call(lbox.updateSelectBoxValue, state.config.forceParam)
      .on('change', event => {
        state.config.forceParam = lbox.selectBoxValue(d3.select(event.currentTarget));
        state.updateFilter();
      });
  selection.select('.perturb')
      .on('click', function () {
        // TODO: disabled by stick
        selection.select('.stick')
            .call(box.updateCheckBox, false)
            .dispatch('change');
        state.restartDispatcher();
      });
  // TODO: random
}




function FilterControlBox(selection) {
  // buttons
  selection.append('div')
      .classed('new', true)
      .call(button.buttonBox, '+ New filter', 'outline-primary')
      .select("button")
      .classed('mb-2', true);
  // filters
  selection.append('div')
      .classed('filter-container', true);
}

function updateFilterControl(selection, state) {
  const filterFields = 
  selection.select('.new')
      .on('click', () => {
        state.filters.push({
          field: `node.${state.numericNodeFields[0]}`,
          operator: ">",
          value: 0,
          groups: []
        });
        state.stateChanged = true;
        state.updateFilter();
      });
  const container = selection.select(".filter-container")
  container.selectAll('.filter').remove();
  if (state.filters.length === 0) { return; }
  container.selectAll('.filter')
    .data(state.filters).enter()
    .append("div")
      .classed("filter", true)
    .each((d, i, nodes) => {
      d3.select(nodes[i])
        .call(filterComponent, d, i, state)
        .on('change', event => {
          state.filters[i] = filterValue(d3.select(event.currentTarget));
          state.stateChanged = true;
          state.updateFilter();
        })
        .on('remove', async event => {
          const ok = await modal.showConfirmDialog(
            'Are you sure you want to delete the filter?');
          if (ok) {
            state.filters.splice(i, 1);
            state.stateChanged = true;
            state.updateFilter();
          }
        });
      });
}


function filterComponent(selection, d, i, state) {
  const numn = state.numericNodeFields.map(e => `node.${e}`);
  const catn = state.categoricalNodeFields.map(e => `node.${e}`);
  const nume = state.numericEdgeFields.map(e => `edge.${e}`);
  const cate = state.categoricalEdgeFields.map(e => `edge.${e}`);
  const fieldOptions = numn.concat(catn, nume, cate);
  const numFields = numn.concat(nume);
  const catFields = catn.concat(cate);
  selection
      .classed("card", true)
      .classed("mb-2", true);
  const header = selection.append("div")
      .classed("card-header", true)
      .classed("d-flex", true)
      .classed("py-1", true)
      .text(d.name || `Filter ${i + 1}`);
  header.append("button")
      .classed("btn-close", true)
      .classed("ms-auto", true)
      .classed("remove", true)
      .attr("type", "button")
      .attr('aria-label', 'Close')
      .on('click', event => {
        selection.dispatch('remove');
      });
  const body = selection.append("div")
      .classed("card-body", true)
      .classed("p-2", true);
  // field
  body.append("div")
      .classed("field", true)
      .classed("mb-1", true)
      .call(lbox.selectBox, "Field")
      .call(lbox.updateSelectBoxOptions, fieldOptions)
      .call(lbox.updateSelectBoxValue, d.field);
  // numeric: condition and value
  body.append("div")
      .classed("operator", true)
      .classed("mb-1", true)
      .classed("d-none", !numFields.includes(d.field))
      .call(lbox.selectBox, "Operator")
      .call(lbox.updateSelectBoxOptions, [">", ">=", "<", "<=", "==", "!="])
      .call(lbox.updateSelectBoxValue, d.operator);
  body.append("div")
      .classed("value", true)
      .classed("mb-1", true)
      .classed("d-none", !numFields.includes(d.field))
      .attr('required', 'required')
      .call(box.numberBox, "Value")
      .call(box.updateNumberRange, null, null, "any")
      .call(badge.updateInvalidMessage, 'Please provide a valid number')
      .call(box.updateFormValue, d.value)
    .select('.form-control')
      .attr('required', 'required');
  // categorical: checklistBox (top 20)
  body.append("div")
      .classed("selected", true)
      .classed("mb-1", true)
      .classed("mx-0", true)
      .classed("d-none", !catFields.includes(d.field))
      .call(lbox.checklistBox, "Groups")
      .call(lbox.updateChecklistItems, misc.rank(state.nodes.map(e => e[d.field])).map(e => e[0]))
      .call(lbox.updateChecklistValues, d.groups);
}


function filterValue(selection) {
  return {
    field: lbox.selectBoxValue(selection.select(".field")),
    operator: lbox.selectBoxValue(selection.select(".operator")),
    value: box.formValue(selection.select(".value")),
    groups: lbox.checklistValues(selection.select(".groups"))
  }
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
      .call(lbox.colorScaleBox, 'Range');
  // Color scale type
  selection.append('div')
      .classed('colorscale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale');

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
      .call(lbox.selectBox, 'Range');
  // Size scale type
  selection.append('div')
      .classed('sizescale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale');

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
  // Node image
  selection.append('div')
    .classed('mb-1', true)
    .classed('small', true)
    .text("Node image");
  // image field
  selection.append('div')
      .classed('imagefield', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Field');
  // always show image
  selection.append('div')
      .classed('shownodeimage', true)
      .classed('mb-1', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.checkBox, 'Always show images');
}

function updateNodeControl(selection, state) {
  const nfields = state.numericNodeFields;
  const qfields = nfields.concat(state.categoricalNodeFields);

  // undef -> set default
  const cnull = !state.appearance.nodeColor.hasOwnProperty("field");
  const snull = !state.appearance.nodeSize.hasOwnProperty("field");
  const lnull = !state.appearance.nodeLabel.hasOwnProperty("field");
  const inull = !state.appearance.nodeImage.hasOwnProperty("field");
  const isNumColor = state.numericNodeFields.includes(state.appearance.nodeColor.field) || cnull;
  const colorRange = scale.colorScales.filter(e => e.type === (isNumColor ? "continuous" : "discrete"));
  const colorScale = isNumColor ? ["constant", "linear", "log"] : ["constant", "categorical"];
  selection
      .on('change', () => {
        state.stateChanged = true;
        selection.call(updateNodeControl, state);
        state.updateNodeAttrCallback();
      });
  selection.select('.colorfield')
      .call(lbox.updateSelectBoxOptions, qfields, undefined, undefined, cnull)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeColor.field)
      .on('change', event => {
        state.appearance.nodeColor.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.colorrange')
      .call(lbox.updateColorScaleItems, colorRange)
      .call(lbox.updateColorScaleBox, state.appearance.nodeColor.rangePreset)
      .on('change', event => {
        state.appearance.nodeColor.rangePreset = lbox.colorScaleBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.colorscale')
      .call(lbox.updateSelectBoxOptions, colorScale)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeColor.scale)
      .on('change', event => {
        state.appearance.nodeColor.scale = lbox.selectBoxValue(d3.select(event.currentTarget));
      });

  selection.select('.sizefield')
      .call(lbox.updateSelectBoxOptions, nfields, undefined, undefined, snull)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeSize.field)
      .on('change', event => {
        state.appearance.nodeSize.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.sizerange')
      .call(lbox.updateSelectBoxOptions, scale.nodeSizeScales.map(e => e.name))
      .call(lbox.updateSelectBoxValue, state.appearance.nodeSize.rangePreset)
      .on('change', event => {
        state.appearance.nodeSize.rangePreset = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.sizescale')
      .call(lbox.updateSelectBoxOptions, ["constant", "linear", "log"])
      .call(lbox.updateSelectBoxValue, state.appearance.nodeSize.scale)
      .on('change', event => {
        state.appearance.nodeSize.scale = lbox.selectBoxValue(d3.select(event.currentTarget));
      });

  const labelFields = state.nodeFields.filter(e => !state.imageNodeFields.includes(e));
  selection.select('.labelvisible')
      .call(box.updateCheckBox, state.appearance.nodeLabel.visible)
      .on('change', event => {
        state.appearance.nodeLabel.visible = box.checkBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.labelfield')
      .call(lbox.updateSelectBoxOptions, labelFields, undefined, undefined, lnull)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeLabel.field)
      .on('change', event => {
        state.appearance.nodeLabel.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.labelsize')
      .call(box.updateFormValue, state.appearance.nodeLabel.size)
      .on('change', event => {
        state.appearance.nodeLabel.size = box.formValue(d3.select(event.currentTarget));
      });

  const imageFields = state.nodeFields.filter(e => state.imageNodeFields.includes(e));
  selection.select('.imagefield')
      .call(lbox.updateSelectBoxOptions, imageFields, undefined, undefined, inull)
      .call(lbox.updateSelectBoxValue, state.appearance.nodeImage.field)
      .on('change', event => {
        state.appearance.nodeImage.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.shownodeimage')
      .call(box.updateCheckBox, state.config.alwaysShowNodeImage)
      .on('change', event => {
        state.stateChanged = true;
        state.config.alwaysShowNodeImage = box.checkBoxValue(d3.select(event.currentTarget));
        state.updateVisibility();
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
      .call(lbox.colorScaleBox, 'Range');
  // Color scale type
  selection.append('div')
      .classed('colorscale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale');

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
      .call(lbox.selectBox, 'Range');
  // Width scale type
  selection.append('div')
      .classed('widthscale', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(lbox.selectBox, 'Scale');

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
  const nfields = state.numericEdgeFields;
  const qfields = nfields.concat(state.categoricalEdgeFields);

  // undef -> set default
  const cnull = !state.appearance.edgeColor.hasOwnProperty("field");
  const wnull = !state.appearance.edgeWidth.hasOwnProperty("field");
  const lnull = !state.appearance.edgeLabel.hasOwnProperty("field");

  const isNumColor = state.numericEdgeFields.includes(state.appearance.edgeColor.field) || cnull;
  const colorRange = scale.colorScales.filter(e => e.type === (isNumColor ? "continuous" : "discrete"));
  const colorScale = isNumColor ? ["constant", "linear", "log"] : ["constant", "categorical"];
  selection
      .on('change', () => {
        state.stateChanged = true;
        state.updateEdgeAttrCallback();
      });
  selection.select('.colorfield')
      .call(lbox.updateSelectBoxOptions, qfields, undefined, undefined, cnull)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeColor.field)
      .on('change', event => {
        state.appearance.edgeColor.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.colorrange')
      .call(lbox.updateColorScaleItems, colorRange)
      .call(lbox.updateColorScaleBox, state.appearance.edgeColor.rangePreset)
      .on('change', event => {
        state.appearance.edgeColor.rangePreset = lbox.colorScaleBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.colorscale')
      .call(lbox.updateSelectBoxOptions, colorScale)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeColor.scale)
      .on('change', event => {
        state.appearance.edgeColor.scale = lbox.selectBoxValue(d3.select(event.currentTarget));
      });

  selection.select('.widthfield')
      .call(lbox.updateSelectBoxOptions, nfields, undefined, undefined, wnull)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeWidth.field)
      .on('change', event => {
        state.appearance.edgeWidth.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.widthrange')
      .call(lbox.updateSelectBoxOptions, scale.edgeWidthScales.map(e => e.name))
      .call(lbox.updateSelectBoxValue, state.appearance.edgeWidth.rangePreset)
      .on('change', event => {
        state.appearance.edgeWidth.rangePreset = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.widthscale')
      .call(lbox.updateSelectBoxOptions, ["constant", "linear", "log"])
      .call(lbox.updateSelectBoxValue, state.appearance.edgeWidth.scale)
      .on('change', event => {
        state.appearance.edgeWidth.scale = lbox.selectBoxValue(d3.select(event.currentTarget));
      });

  const labelFields = state.edgeFields.filter(e => !["source", "target"].includes(e));
  selection.select('.labelvisible')
      .call(box.updateCheckBox, state.appearance.edgeLabel.visible)
      .on('change', event => {
        state.appearance.edgeLabel.visible = box.checkBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.labelfield')
      .call(lbox.updateSelectBoxOptions, labelFields, undefined, undefined, lnull)
      .call(lbox.updateSelectBoxValue, state.appearance.edgeLabel.field)
      .on('change', event => {
        state.appearance.edgeLabel.field = lbox.selectBoxValue(d3.select(event.currentTarget));
      });
  selection.select('.labelsize')
      .call(box.updateFormValue, state.appearance.edgeLabel.size)
      .on('change', event => {
        state.appearance.edgeLabel.size = box.formValue(d3.select(event.currentTarget));
      });

  selection.select('.showedge')
      .call(box.updateCheckBox, state.config.alwaysShowEdge)
      .on('change', event => {
        state.stateChanged = true;
        state.config.alwaysShowEdge = box.checkBoxValue(d3.select(event.currentTarget));
        state.updateVisibility();
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

  state.updateControlBoxCallback = () => {
    selection.call(updateControlBox, state);
  };
}


export default {
  controlBox, updateControlBox
};
