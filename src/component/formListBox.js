
/** @module component/formListBox */

import d3 from 'd3';

import {default as cscale} from '../common/scale.js';
import {default as badge} from './badge.js';
import {default as box} from './formBox.js';
import {default as shape} from './shape.js';


/**
 * Render select box components
 * @param {*} selection - selection of box container (div element)
 */
function selectBox(selection, label) {
  selection
      .classed('row', true);
  selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  selection.append('div')
      .classed('col-8', true)
    .append('select')
      .classed('form-select', true)
      .classed('form-select-sm', true);
}

function updateSelectBoxOptions(selection, items) {
  const options = selection.select('select')
    .selectAll('option')
      .data(items);
  options.exit().remove();
  options.enter()
    .append('option')
      .attr('value', d => d)
      .text(d => d);
}

function updateSelectBoxValue(selection, value) {
  selection.select('.form-select').property('value', value);
}

function selectBoxValue(selection) {
  return selection.select('.form-select').property('value');
}

function selectBoxValueIndex(selection) {
  return selection.select('.form-select').property('selectedIndex');
}


/**
 * Render select box components
 * @param {d3.selection} selection - selection of box container (div element)
 */
function checklistBox(selection, label) {
  // TODO: scroll
  selection
      .classed('form-group', true)
      .classed('form-row', true)
      .classed('align-items-center', true);
  const formLabel = selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  formLabel.append('div')
      .call(badge.invalidFeedback);
  selection.append('ul')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .classed('col-8', true);
}

function updateChecklistItems(selection, items) {
  const listitems = selection.select('ul')
    .selectAll('li')
      .data(items, d => d.key);
  listitems.exit().remove();
  const form = listitems.enter()
    .append('li')
      .attr('class', 'form-check')
    .append('label')
      .attr('class', 'form-check-label');
  form.append('input')
      .attr('type', 'checkbox')
      .attr('class', 'form-check-input')
      .property('value', d => d.key);
  form.append('span')
      .text(d => d.name);
}

function checkRequired(selection) {
  selection.selectAll('input')
      .on('change', function () {
        const valid = anyChecked(selection);
        selection.call(setChecklistValidity, valid);
      });
}

function updateChecklistValues(selection, values) {
  selection.selectAll('input')
    .each(function (d) {
      d3.select(this).property('checked', values.includes(d.key));
    });
  selection.call(setChecklistValidity, true);  // Clear validity state
}

function checklistValues(selection) {
  return selection.selectAll('input:checked').data().map(d => d.key);
}

function anyChecked(selection) {
  return checklistValues(selection).length > 0;
}

function setChecklistValidity(selection, valid) {
  selection.select('.invalid-feedback')
      .style('display', valid ? 'none': 'inherit');
  selection.select('.form-control')
      .style('background-color', valid ? null : 'LightPink');
}


function colorScaleBox(selection, label) {
  selection
      .classed('row', true);
  selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  const form = selection.append('div')
      .classed('col-8', true)
    .append('div')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .classed('p-0', true);
  const dropdown = form.append('div')
      .classed('btn-group', true)
      .classed('me-1', true);
  dropdown.append('button')
      .classed('btn', true)
      .classed(`btn-light`, true)
      .classed('btn-sm', true)
      .classed('dropdown-toggle', true)
      .attr('data-bs-toggle', 'dropdown')
      .attr('aria-expanded', 'false');
  dropdown.append('ul')
      .classed('dropdown-menu', true)
      .classed('py-0', true);
  form.append('span')
      .classed('selected', true);
}

function updateColorScaleItems(selection, items) {
  const listitems = selection.select('.dropdown-menu')
    .selectAll('li')
      .data(items);
  listitems.exit().remove();
  listitems.enter()
    .append('li')
    .append('a')
      .classed('dropdown-item', true)
      .classed('py-0', true)
      .attr('href', '#')
      .attr('title', d => d)
      .on('click', (event, d) => {
        selection.call(setSelectedColorScale, d);
        selection.dispatch('change', {bubbles: true});
      })
      .each((d, i, nodes) => {
        const s = cscale.scales.color[d];
        d3.select(nodes[i])
            .call(shape.colorBar(s.range), s.range, 80, d);
      });
}

function setSelectedColorScale(selection, item) {
  const selected = selection.select('.selected');
  const s = cscale.scales.color[item];
  selected.selectAll('svg').remove();
  selected.datum(item);  // Bind selected item record
  selected
      .call(shape.colorBar(s.range), s.range, 80, item);
}

function updateColorScaleBox(selection, item) {
  //const data = selection.select('.dropdown-menu')
  //  .selectAll('li').data();
  selection.call(setSelectedColorScale, item);
}

function colorScaleBoxValue(selection) {
  return selection.select('.selected').datum();
}

function colorScaleBoxItem(selection) {
  return cscale.scales.color[selection.select('.selected').datum()];
}


export default {
  selectBox, updateSelectBoxOptions, updateSelectBoxValue, selectBoxValue,
  checklistBox, updateChecklistItems, checkRequired, updateChecklistValues,
  checklistValues, anyChecked, setChecklistValidity,
  colorScaleBox, updateColorScaleItems, updateColorScaleBox,
  colorScaleBoxValue, colorScaleBoxItem
};
