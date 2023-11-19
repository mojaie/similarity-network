
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
      .classed('mb-3', true);
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
      .classed('reset', true)
      .classed('col-8', true)
      .call(button.buttonBox, 'Reset coords', 'outline-warning');
}

function updateLayoutControl(selection, state) {
  // Fit
  selection.select('.fit')
      .on('click', function () {
        state.fitTransform();
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
        selection.select('.temperature')
            .style('background-color', value ? '#a3e4d7' : '#e9ecef')
          .select('.progress-bar')
            .style('width', `0%`)
            .attr('aria-valuenow', 0);
        value ? state.dispatch("stick") : state.dispatch("relax");
      });
  selection.select('.forceparam')
      .call(lbox.updateSelectBoxValue, state.config.forceParam)
      .on('change', event => {
        state.config.forceParam = lbox.selectBoxValue(d3.select(event.currentTarget));
        state.updateFilter();
      });
  selection.select('.perturb')
      .on('click', function () {
        selection.select('.stick')
            .call(box.updateCheckBox, false)
            .dispatch('change');
        state.dispatch("restart");
      });
  selection.select('.reset')
      .on('click', function () {
        selection.select('.stick')
            .call(box.updateCheckBox, false)
            .dispatch('change');
        state.dispatch("resetCoords");
      });
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
          field: state.numericFields[0],
          operator: ">",
          value: 0,
          groups: []
        });
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
          state.updateFilter();
        })
        .on('remove', async event => {
          const ok = await modal.showConfirmDialog(
            'Are you sure you want to delete the filter?');
          if (ok) {
            state.filters.splice(i, 1);
            state.updateFilter();
          }
        });
      });
}


function filterComponent(selection, d, i, state) {
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
      .call(lbox.updateSelectBoxOptions, state.numericFields.concat(state.categoricalFields))
      .call(lbox.updateSelectBoxValue, d.field);
  // numeric: condition and value
  body.append("div")
      .classed("operator", true)
      .classed("mb-1", true)
      .classed("d-none", !state.numericFields.includes(d.field))
      .call(lbox.selectBox, "Operator")
      .call(lbox.updateSelectBoxOptions, [">", ">=", "<", "<=", "==", "!="])
      .call(lbox.updateSelectBoxValue, d.operator);
  body.append("div")
      .classed("value", true)
      .classed("mb-1", true)
      .classed("d-none", !state.numericFields.includes(d.field))
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
      .classed("d-none", !state.categoricalFields.includes(d.field))
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
  // Color domain
  selection.append('div')
      .classed('colordomain', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.domainBox, 'Domain')
      .call(badge.updateInvalidMessage, 'Please provide valid numbers');

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
  // Size domain
  selection.append('div')
      .classed('sizedomain', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.domainBox, 'Domain')
      .call(badge.updateInvalidMessage, 'Please provide valid numbers');

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
            'Please provide a valid number (0.1-999)');
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
  const nfields = state.numericFields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
  const cfields = state.categoricalFields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
  const qfields = nfields.concat(cfields);
  const ifields = state.imageFields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
  const fields = state.fields.filter(e => e.startsWith("node.")).map(e => e.substring(5));
  const lfields = fields.filter(e => !ifields.includes(e));

  const color = state.appearance.nodeColor;
  const hasColorField = color.field !== null;
  const hasColorDomain = hasColorField && color.domain !== null;
  const colorRange = color.range === null ? scale.colorScales.find(e => e.name == color.rangePreset)
    : {name: "default", range: color.range};
  selection.select('.colorfield')
      .call(lbox.updateSelectBoxOptions, qfields, undefined, undefined, !hasColorField)
      .call(lbox.updateSelectBoxValue, color.field)
      .on('change', event => {
        const v = lbox.selectBoxValue(d3.select(event.currentTarget))
        if (color.domain === null) {  // set infered domain
          state.appearance.nodeColor.domain = state.defaultDomain[`node.${v}`];
        }
        state.setAppearance("nodeColor", "field", v);
      });
  selection.select('.colorrange')
      .call(lbox.updateColorScaleItems,
        scale.colorScales.filter(e => e.type == (hasColorDomain ? "continuous" : "discrete")))
      .call(lbox.updateColorScaleBox, colorRange)
      .on('change', event => {
        state.appearance.nodeColor.range = null;  // remove default range
        state.setAppearance(
          "nodeColor", "rangePreset", lbox.colorScaleBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.colorrange button')
      .property("disabled", !hasColorField)
  selection.select('.colordomain')
      .call(box.updateDomainValues, color.domain)
      .on('change', event => {
        state.setAppearance(
          "nodeColor", "domain", box.domainValues(d3.select(event.currentTarget)));
      });
  selection.select('.colordomain').selectAll('.min,.max')
      .attr('required', hasColorDomain ? 'required' : null)
      .property("disabled", !hasColorDomain);

  const size = state.appearance.nodeSize;
  const hasSizeField = size.field !== null;
  const hasSizeDomain = hasSizeField && size.domain !== null;
  const sizeRange = size.range === null ? size.rangePreset : "";
  selection.select('.sizefield')
      .call(lbox.updateSelectBoxOptions, nfields, undefined, undefined, !hasSizeField)
      .call(lbox.updateSelectBoxValue, size.field)
      .on('change', event => {
        const v = lbox.selectBoxValue(d3.select(event.currentTarget))
        if (size.domain === null) {  // set infered domain
          state.appearance.nodeSize.domain = state.defaultDomain[`node.${v}`];
        }
        state.setAppearance("nodeSize", "field", v);
      });
  selection.select('.sizerange')
      .call(lbox.updateSelectBoxOptions, scale.nodeSizeScales, d => d.name, d => d.name)
      .call(lbox.updateSelectBoxValue, sizeRange)
      .on('change', event => {
        state.appearance.nodeSize.range = null;  // remove default range
        state.setAppearance(
          "nodeSize", "rangePreset", lbox.selectBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.sizerange select')
      .attr("disabled", hasSizeDomain ? null : "disabled");
  selection.select('.sizedomain')
      .call(box.updateDomainValues, size.domain)
      .on('change', event => {
        state.setAppearance(
          "nodeSize", "domain", box.domainValues(d3.select(event.currentTarget)));
      });
  selection.select('.sizedomain').selectAll('.min,.max')
      .attr('required', hasSizeDomain ? 'required' : null)
      .property("disabled", !hasSizeDomain);

  const label = state.appearance.nodeLabel;
  selection.select('.labelvisible')
      .call(box.updateCheckBox, label.visible)
      .on('change', event => {
        state.setAppearance(
          "nodeLabel", "visible", box.checkBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.labelfield')
      .call(lbox.updateSelectBoxOptions, lfields, undefined, undefined, !label.hasOwnProperty("field"))
      .call(lbox.updateSelectBoxValue, label.field)
      .on('change', event => {
        state.setAppearance(
          "nodeLabel", "field", lbox.selectBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.labelsize')
      .call(box.updateFormValue, label.size)
      .on('change', event => {
        state.setAppearance(
          "nodeLabel", "size", box.formValue(d3.select(event.currentTarget)));
      });

  const image = state.appearance.nodeImage;
  selection.select('.imagefield')
      .call(lbox.updateSelectBoxOptions, ifields, undefined, undefined, !image.hasOwnProperty("field"))
      .call(lbox.updateSelectBoxValue, image.field)
      .on('change', event => {
        state.setAppearance(
          "nodeImage", "field", lbox.selectBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.shownodeimage')
      .call(box.updateCheckBox, state.config.alwaysShowNodeImage)
      .on('change', event => {
        state.config.alwaysShowNodeImage = box.checkBoxValue(d3.select(event.currentTarget));
        state.updateVisibility();
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
      .classed('colordomain', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.domainBox, 'Domain');

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
      .classed('widthdomain', true)
      .classed('mb-3', true)
      .classed('ms-3', true)
      .classed('gx-0', true)
      .call(box.domainBox, 'Domain');

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
            'Please provide a valid number (0.1-999)');

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
  const nfields = state.numericFields.filter(e => e.startsWith("edge.")).map(e => e.substring(5));
  const cfields = state.categoricalFields.filter(e => e.startsWith("edge.")).map(e => e.substring(5));
  const qfields = nfields.concat(cfields);
  const fields = state.fields.filter(e => e.startsWith("edge.")).map(e => e.substring(5));
  const lfields = fields.filter(e => !["source", "target"].includes(e));

  const color = state.appearance.edgeColor;
  const hasColorField = color.field !== null;
  const hasColorDomain = hasColorField && color.domain !== null;
  const colorRange = color.range === null ? scale.colorScales.find(e => e.name == color.rangePreset)
    : {name: "default", range: color.range};
  selection.select('.colorfield')
      .call(lbox.updateSelectBoxOptions, qfields, undefined, undefined, !hasColorField)
      .call(lbox.updateSelectBoxValue, color.field)
      .on('change', event => {
        const v = lbox.selectBoxValue(d3.select(event.currentTarget))
        if (color.domain === null) {  // set infered domain
          state.appearance.edgeColor.domain = state.defaultDomain[`edge.${v}`];
        }
        state.setAppearance("edgeColor", "field", v);
      });
  selection.select('.colorrange')
      .call(lbox.updateColorScaleItems,
        scale.colorScales.filter(e => e.type === (hasColorDomain ? "continuous" : "discrete")))
      .call(lbox.updateColorScaleBox, colorRange)
      .on('change', event => {
        state.appearance.edgeColor.range = null;  // remove default range
        state.setAppearance(
          "edgeColor", "rangePreset", lbox.colorScaleBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.colorrange button')
      .property("disabled", !hasColorField);
  selection.select('.colordomain')
      .call(box.updateDomainValues, color.domain)
      .on('change', event => {
        state.setAppearance(
          "edgeColor", "domain", box.domainValues(d3.select(event.currentTarget)));
      });
  selection.select('.colordomain').selectAll('.min,.max')
      .attr('required', hasColorDomain ? 'required' : null)
      .property("disabled", !hasColorDomain);

  const width = state.appearance.edgeWidth;
  const hasWidthField = width.field !== null;
  const hasWidthDomain = hasWidthField && width.domain !== null;
  const widthRange = width.range === null ? width.rangePreset : "";
  selection.select('.widthfield')
      .call(lbox.updateSelectBoxOptions, nfields, undefined, undefined, !hasWidthField)
      .call(lbox.updateSelectBoxValue, width.field)
      .on('change', event => {
        const v = lbox.selectBoxValue(d3.select(event.currentTarget))
        if (width.domain === null) {  // set infered domain
          state.appearance.edgeWidth.domain = state.defaultDomain[`edge.${v}`];
        }
        state.setAppearance("edgeWidth", "field", v);
      });
  selection.select('.widthrange')
      .call(lbox.updateSelectBoxOptions, scale.edgeWidthScales, d => d.name, d => d.name)
      .call(lbox.updateSelectBoxValue, widthRange)
      .on('change', event => {
        state.appearance.edgeWidth.range = null;  // remove default range
        state.setAppearance(
          "edgeWidth", "rangePreset", lbox.selectBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.widthrange select')
      .attr("disabled", hasWidthDomain ? null : "disabled");
  selection.select('.widthdomain')
      .call(box.updateDomainValues, width.domain)
      .on('change', event => {
        state.setAppearance(
          "edgeWidth", "domain", box.domainValues(d3.select(event.currentTarget)));
      });
  selection.select('.widthdomain').selectAll('.min,.max')
      .attr('required', hasWidthDomain ? 'required' : null)
      .property("disabled", !hasWidthDomain);

  const label = state.appearance.edgeLabel;
  selection.select('.labelvisible')
      .call(box.updateCheckBox, label.visible)
      .on('change', event => {
        state.setAppearance(
          "edgeLabel", "visible", box.checkBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.labelfield')
      .call(lbox.updateSelectBoxOptions, lfields, undefined, undefined, !label.hasOwnProperty("field"))
      .call(lbox.updateSelectBoxValue, label.field)
      .on('change', event => {
        state.setAppearance(
          "edgeLabel", "field", lbox.selectBoxValue(d3.select(event.currentTarget)));
      });
  selection.select('.labelsize')
      .call(box.updateFormValue, label.size)
      .on('change', event => {
        state.setAppearance(
          "edgeLabel", "size", box.formValue(d3.select(event.currentTarget)));
      });

  selection.select('.showedge')
      .call(box.updateCheckBox, state.config.alwaysShowEdge)
      .on('change', event => {
        state.config.alwaysShowEdge = box.checkBoxValue(d3.select(event.currentTarget));
        state.updateVisibility();
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
  - node/edge numeric fields min, mean, median, max, IQR...
*/


function StatisticsBox(selection) {
  selection
      .classed('small', true);
  // Components
  const nodecount = selection.append('div')
      .classed('row', true);
  nodecount.append('div')
      .classed('col-8', true)
      .text("Nodes(shown/total): ");
  nodecount.append('div')
      .classed('col-4', true)
      .classed("nodecount", true);
  const edgecount = selection.append('div')
      .classed('row', true);
  edgecount.append('div')
      .classed('col-8', true)
      .text("Edges(shown/total): ");
  edgecount.append('div')
      .classed('col-4', true)
      .classed("edgecount", true);
  const logd = selection.append('div')
      .classed('row', true);
  logd.append('div')
      .classed('col-8', true)
      .text("logD(shown/total): ");
  logd.append('div')
      .classed('col-4', true)
      .classed("logd", true);

  const qtitle = selection.append('div')
      .classed('row', true)
      .classed('mt-3', true)
  qtitle.append('div')
      .classed('col-12', true)
      .text("Data quantiles: ");
  const quantiles = selection.append('div')
      .classed('row', true);
  quantiles.append('div')
      .classed('col-12', true)
      .classed("quantiles", true);
}


function updateStatistics(selection, state) {
  // topology
  const ncnt = state.nodes.length;
  const ecnt = state.edges.length;
  const maxedges = ncnt * (ncnt - 1) / 2;
  const fncnt = state.fnodes.length;
  const fecnt = state.fedges.length;
  const fmaxedges = fncnt * (fncnt - 1) / 2;
  const logd = d3.format('.2f')(Math.log10(ecnt / maxedges));
  const flogd = d3.format('.2f')(Math.log10(fecnt / fmaxedges));
  selection.select('.nodecount')
      .text(`${fncnt}/${ncnt}`);
  selection.select('.edgecount')
      .text(`${fecnt}/${ecnt}`);
  selection.select('.logd')
      .text(`${flogd}/${logd}`);

  // field statistics
  const qs = state.numericFields.map(e => {
    return `${e}: ${JSON.stringify(scale.quantiles(
      e.startsWith("node.") ? state.nodes.map(n => n[e.substring(5)]) : state.edges.map(n => n[e.substring(5)])))}`;
  });
  
  const stats = selection.select('.quantiles')
      .selectAll('div')
      .data(qs, d => d);
  stats.exit().remove();
  stats.enter()
      .append('div')
      .merge(stats)
        .text(d => d);
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
  const tabs = selection.append("ul")
      .classed("nav", true)
      .classed("nav-tabs", true)
      .attr("id", "control-tab")
      .attr("role", "tablist");
  const content = selection.append("div")
      .classed("tab-content", true)
      .classed('p-2', true)
      .attr("id", "control-tab-content")
      .style("overflow-y", "scroll");

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

  state.register("updateControlBox", () => {
    selection.call(updateControlBox, state);
  });
}


export default {
  controlBox, updateControlBox
};
