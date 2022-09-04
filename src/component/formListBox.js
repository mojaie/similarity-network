
/** @module component/formListBox */

import d3 from 'd3';

import {default as badge} from './badge.js';
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

function updateSelectBoxOptions(selection, items, keyfunc=d => d, namefunc=d => d, init=false) {
  const options = selection.select('select')
    .selectAll('option')
      .data(items, keyfunc);
  options.exit().remove();
  options.enter()
    .append('option')
      .attr('value', keyfunc)
    .merge(options)
      .text(namefunc);
  if (init) {
    selection.select('select')
      .append("option")
        .property("disabled", true)
        .property("selected", true)
        .property("value", true)
        .text("--- select ---");
  }
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
 * @param {＊} selection - selection of box container (div element)
 */
function checklistBox(selection, label) {
  // TODO: scroll
  const formLabel = selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .text(label);
  formLabel.append('div')
      .call(badge.invalidFeedback);
  selection.append('ul')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .classed('mb-0', true)
      .classed('col-8', true);
}

function updateChecklistItems(selection, items, keyfunc = d => d, namefunc = d => d) {
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
      .property('value', keyfunc);
  form.append('span')
      .text(namefunc);
}

function checkRequired(selection) {
  selection.selectAll('input')
      .on('change', function () {
        const valid = anyChecked(selection);
        selection.call(setChecklistValidity, valid);
      });
}

function updateChecklistValues(selection, values, keyfunc = d => d) {
  selection.selectAll('input')
    .each(function (d) {
      d3.select(this).property('checked', values.includes(keyfunc(d)));
    });
  selection.call(setChecklistValidity, true);  // Clear validity state
}

function checklistValues(selection, keyfunc = d => d) {
  return selection.selectAll('input:checked').data().map(keyfunc);
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
      .data(items, d => d);
  listitems.exit().remove();
  listitems.enter()
    .append('li')
    .append('a')
      .classed('dropdown-item', true)
      .classed('py-0', true)
      .attr('href', '#')
      .attr('title', d => d.name)
      .on('click', (event, d) => {
        selection.call(setSelectedColorScale, d);
        selection.dispatch('change', {bubbles: true});
      })
      .each((d, i, nodes) => {
        d3.select(nodes[i])
            .call(shape.colorBar(d.range), d.range, 80, d);
      });
}

function setSelectedColorScale(selection, item) {
  const selected = selection.select('.selected');
  selected.selectAll('svg').remove();
  selected.datum(item);  // Bind selected item record
  selected
      .call(shape.colorBar(item.range), item.range, 80, item.name);
}

function updateColorScaleBox(selection, key) {
  const data = selection.select('.dropdown-menu')
    .selectAll('li').data();
  const item = data.find(e => e.name === key);
  selection.call(setSelectedColorScale, item);
}

function colorScaleBoxItem(selection) {
  return selection.select('.selected').datum();
}

function colorScaleBoxValue(selection) {
  return colorScaleBoxItem(selection).name;
}


export default {
  selectBox, updateSelectBoxOptions, updateSelectBoxValue, selectBoxValue, selectBoxValueIndex,
  checklistBox, updateChecklistItems, checkRequired, updateChecklistValues,
  checklistValues, anyChecked, setChecklistValidity,
  colorScaleBox, updateColorScaleItems, updateColorScaleBox,
  colorScaleBoxValue, colorScaleBoxItem
};
