
/** @module component/modal */

import d3 from 'd3';

import {default as badge} from './badge.js';
import {default as box} from './formBox.js';


function dialogBase(selection) {
  selection
      .classed('modal', true)
      .attr('tabindex', -1)
      .attr('aria-hidden', true);
  selection.append('div')
      .classed('modal-dialog', true)
    .append('div')
      .classed('modal-content', true);
}


function confirmDialog(selection) {
  const base = selection.call(dialogBase)
      .select('.modal-content');
  // body
  base.append('div')
      .classed('modal-body', true)
    .append('div')
      .classed('message', true);
  // footer
  const footer = base.append('div')
      .classed('modal-footer', true);
  footer.append('button')
      .classed('btn', true)
      .classed('btn-outline-secondary', true)
      .classed('cancel', true)
      .attr('type', 'button')
      .attr('data-bs-dismiss', 'modal')
      .text('Cancel')
      .on('click', event => {
        selection.dispatch('cancel');
      });
  footer.append('button')
      .classed('btn', true)
      .classed('btn-primary', true)
      .classed('ok', true)
      .attr('type', 'button')
      .attr('data-bs-dismiss', 'modal')
      .text('OK')
      .on('click', event => {
        selection.dispatch('submit');
      });
  // custom backdrop
  selection
      .on('click', event => {
        // do not trigger when the child elements are clicked
        if (event.currentTarget !== event.target) { return; }
        selection.dispatch('cancel');
      });
}


async function showConfirmDialog(message, selector="confirmd") {
  const selection = d3.select(`#${selector}`);
  selection.select('.message').text(message);
  const control = new bootstrap.Modal(document.getElementById(selector));
  control.toggle();
  return new Promise(resolve => {
    selection
        .on('submit', () => resolve(true))
        .on("cancel", () => resolve(false));
  });
}


function submitDialog(selection, title) {
  const base = selection.call(dialogBase)
      .select('.modal-content');
  // header
  const header = base.append('div')
      .classed('modal-header', true);
  header.append('h5')
      .classed('modal-title', true)
      .text(title);
  header.append('button')
      .classed('btn-close', true)
      .attr('type', 'button')
      .attr('data-bs-dismiss', 'modal')
      .attr('aria-label', 'Close');
  // body
  base.append('div')
      .classed('modal-body', true);
  // footer
  const footer = base.append('div')
      .classed('modal-footer', true);
  footer.append('button')
      .classed('btn', true)
      .classed('btn-secondary', true)
      .attr('type', 'button')
      .attr('data-bs-dismiss', "modal")
      .text('Cancel')
      .on('click', event => {
        selection.dispatch('cancel');
      });
  footer.append('button')
      .classed('btn', true)
      .classed('btn-primary', true)
      .attr('type', 'button')
      .attr('data-bs-dismiss', 'modal')
      .text('Save changes')
      .on('click', event => {
        selection.dispatch('submit');
      });
  // custom backdrop
  selection
      .on('click', event => {
        // do not trigger when the child elements are clicked
        if (event.currentTarget !== event.target) { return; }
        selection.dispatch('cancel');
      });
}


function renameDialog(selection) {
  const renameBox = selection.call(submitDialog, "Rename snapshot")
    .select('.modal-body').append('div')
      .classed('name', true)
      .call(box.textBox, 'New name');
  renameBox.select('.form-control')
      .attr('required', 'required');
  renameBox.select('.invalid-feedback')
      .call(badge.updateInvalidMessage, 'Please provide a valid name');
}


async function showRenameDialog(name, selector="renamed") {
  const selection = d3.select(`#${selector}`);
  selection.select('.name')
      .call(box.updateFormValue, name);
  const control = new bootstrap.Modal(document.getElementById(selector));
  control.toggle();
  return new Promise(resolve => {
    selection
        .on('submit', event => {
          const value = box.formValue(selection.select('.name'));
          resolve(value);
        })
        .on("cancel", event => {
          resolve(false);
        });
        
  });
}


export default {
  confirmDialog, showConfirmDialog, renameDialog, showRenameDialog
};
