
/** @module component/formBox */

import d3 from 'd3';

import {default as badge} from './badge.js';


function updateFormValue(selection, value) {
  selection.select('.form-control').property('value', value);
  selection.call(setValidity, true);  // Clear validity state
}


function formValue(selection) {
  return selection.select('.form-control').property('value');
}


function formValid(selection) {
  return selection.select('.form-control').node().checkValidity();
}


function setValidity(selection, valid) {
  selection.select('.invalid-feedback')
      .style('display', valid ? 'none': 'inherit');
  selection.select('.form-control')
      .style('background-color', valid ? null : '#ffcccc');
}


function textBox(selection, label) {
  selection
      .classed('form-group', true)
      .classed('form-row', true);
  selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  selection.append('input')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .classed('col-8', true)
      .attr('type', 'text')
      .on('input', function () {
        const valid = formValid(selection);
        selection.call(setValidity, valid);
      });
  selection.append('div')
      .classed('col-4', true);
  selection.append('div')
      .call(badge.invalidFeedback)
      .classed('col-8', true);
}


function readonlyBox(selection, label) {
  selection
      .classed('form-group', true)
      .classed('form-row', true);
  selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  selection.append('input')
      .classed('form-control-plaintext', true)
      .classed('form-control-sm', true)
      .classed('col-8', true)
      .attr('type', 'text')
      .attr('readonly', 'readonly');
}

function updateReadonlyValue(selection, value) {
  selection.select('.form-control-plaintext').property('value', value);
}

function readonlyValue(selection) {
  return selection.select('.form-control-plaintext').property('value');
}



function checkBox(selection, label) {
  const box = selection
      .classed('form-check', true)
  box.append('input')
      .classed('form-check-input', true)
      .attr('type', 'checkbox');
  box.append('label')
      .classed('form-check-label', true)
      .classed('small', true)
      .text(label);
}

function updateCheckBox(selection, checked) {
  selection.select('input').property('checked', checked);
}

function checkBoxValue(selection) {
  return selection.select('input').property('checked');
}


function numberBox(selection, label) {
  selection
      .classed('row', true);
  selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  selection.append('div')
      .classed('col-8', true)
    .append('input')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .attr('type', 'number')
      .attr('required', 'required')
      .on('input', function () {
        const valid = formValid(selection);
        selection.call(setValidity, valid);
      });
  selection.append('div')
      .classed('col-4', true);
  selection.append('div')
      .call(badge.invalidFeedback)
      .classed('col-8', true);
}

function updateNumberRange(selection, min, max, step) {
  selection.select('.form-control')
      .attr('min', min)
      .attr('max', max)
      .attr('step', step)
      .dispatch('input', {bubbles: true});
}


function domainBox(selection, label) {
  selection
      .classed('row', true)
      .classed('align-items-center', true)
    .append('div')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .text(label);

  const minBox = selection.append('div');
  minBox.append('label').text('min');
  minBox.append('input').classed('min', true);

  const maxBox = selection.append('div');
  maxBox.append('label').text('max');
  maxBox.append('input').classed('max', true);

  selection.selectAll('div')
      .classed('form-group', true)
      .classed('col-4', true)
      .classed('px-1', true)
      .classed('mb-0', true);

  selection.selectAll('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('py-0', true);

  selection.selectAll('input')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .attr('type', 'number')
      .attr('step', 0.01)  // IQRAsymFence digits
      .on('input', function () {
        const minvalid = selection.select('.min').node().checkValidity();
        const maxvalid = selection.select('.max').node().checkValidity();
        selection.call(setDomainValidity, minvalid, maxvalid);
      });;

  selection.append('div')
      .classed('col-4', true);
  selection.append('div')
      .call(badge.invalidFeedback)
      .classed('col-8', true);
}

function updateDomainValues(selection, range) {
  if (range === null) { return; }
  selection.select('.min').property('value', range[0]);
  selection.select('.max').property('value', range[1]);
}

function domainValues(selection) {
  return [
    selection.select('.min').property('value'),
    selection.select('.max').property('value')
  ];
}

function setDomainValidity(selection, minvalid, maxvalid) {
  selection.select('.invalid-feedback')
      .style('display', minvalid & maxvalid ? 'none': 'inherit');
  selection.select('.min')
      .style('background-color', minvalid ? null : '#ffcccc');
  selection.select('.max')
      .style('background-color', maxvalid ? null : '#ffcccc');
}

/**
 * Render color scale box components
 * @param {d3.selection} selection - selection of box container (div element)
 */
function colorBox(selection, label) {
  selection
      .classed('form-row', true)
      .classed('align-items-center', true)
      .on('change', () => {
        // avoid update by mousemove on the colorpicker
        d3.event.stopPropagation();
      });
  selection.append('div')
      .classed('form-group', true)
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .classed('mb-1', true)
      .text(label);
  selection.append('div')
      .classed('form-group', true)
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .classed('mb-1', true)
    .append('input')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .attr('type', 'color');
}


function fileInputBox(selection, label, accept) {
  selection
      .classed('form-group', true)
      .classed('form-row', true);
  selection.append('label')
      .classed('col-form-label', true)
      .classed('col-form-label-sm', true)
      .classed('col-4', true)
      .text(label);
  selection.append('input')
      .classed('form-control', true)
      .classed('form-control-sm', true)
      .classed('form-control-file', true)
      .classed('col-8', true)
      .attr('type', 'file')
      .attr('accept', accept)
      .on('change', function () {
        const valid = fileInputValid(selection);
        selection.call(setValidity, valid);
      });
  selection.append('div')
      .classed('col-4', true);
  selection.append('div')
      .call(badge.invalidFeedback)
      .classed('col-8', true);
}

function clearFileInput(selection) {
  // TODO: FileList object (input.files) may be a readonly property
  const label = selection.select('label').text();
  const accept = selection.select('input').attr('accept');
  selection.selectAll('*').remove();
  selection.call(fileInputBox, label, accept);
}

function fileInputValue(selection) {
  return selection.select('input').property('files')[0];
}

function fileInputValid(selection) {
  // TODO: attribute 'require' does not work with input type=file
  return selection.select('input').property('files').length > 0;
}


export default {
  updateFormValue, formValue, formValid, setValidity,
  textBox, readonlyBox, updateReadonlyValue, readonlyValue,
  numberBox, updateNumberRange,
  domainBox, updateDomainValues, domainValues, setDomainValidity, 
  checkBox, updateCheckBox, checkBoxValue,
  colorBox,
  fileInputBox, clearFileInput, fileInputValue, fileInputValid
};
