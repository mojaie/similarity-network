
/** @module app */

import * as d3 from 'd3';

import {default as hfile} from './common/file.js';
import {default as client} from './common/client.js';
import {default as idb} from './common/idb.js';

import {default as badge} from './component/badge.js';
import {default as lbox} from './component/formListBox.js';
import {default as button} from './component/button.js';
import {default as modal} from './component/modal.js';

import NetworkState from './network/state.js';
import {default as control} from './network/controlBox.js';
import {default as component} from './network/component.js';
import {default as force} from './network/force.js';
import {default as interaction} from './network/interaction.js';



function sessionMenu(selection) {
  selection
      .classed('row', true)
      .classed('mb-1', true)
  // switch
  selection.append('div')
      .classed('switch', true)
      .classed('col-8', true)
      .call(lbox.selectBox, 'Session')
    .select("select")
      .attr('disabled', true);

  const menu = selection.append('div')
      .classed('col-4', true)
  // open new file
  menu.append('span')
      .classed('open', true)
    .append('a')
      .call(button.fileButton, 'New', '.json,.gz', 'menu-import')
      .on('change', async () => {
        // store json data
        const file = button.fileValue(menu);
        const json = await hfile.loadJSON(file);
        json.name = file.name.split(".")[0]; // use file basename as the session name
        json.id = await idb.putSession(json);  // issue session ID
        await idb.putConfig("currentSession", json.id);
        // set view frame size (depends on browser)
        const width = d3.select("#frame").property("offsetWidth");
        const height = d3.select("#frame").property("offsetHeight");
        // establish state
        const newState = new NetworkState(json, width, height);
        setState(newState);
      });
  // export
  menu.append('span')
      .classed('export', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Export', 'menu-export');
  // delete
  menu.append('span')
      .classed('delete', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Delete', 'delete-gray');
  // delete all
  menu.append('span')
      .classed('deleteall', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Delete all', 'delete-gray');
}


async function updateSessionMenu(selection, state) {
  const currentID = await idb.getConfig("currentSession");
  const sessions = await idb.getSessionHeaders();
  // switch
  selection.select('.switch')
      .call(lbox.updateSelectBoxOptions, sessions, d => d.id, d => d.name)
      .call(lbox.updateSelectBoxValue, currentID)
      .on('change', async event => {
        const newID = lbox.selectBoxValue(d3.select(event.currentTarget));
        await idb.putConfig("currentSession", newID);
        const session = await idb.getSession(newID);
        const newState = new NetworkState(session);
        setState(newState);
      })
      .select("select")
        .attr('disabled', state.stateChanged ? true : null);
  // import
  selection.select('.open')
      .classed('d-none', state.stateChanged);
  // export
  selection.select('.export')
      .classed('d-none', state.stateChanged)
      .on('click', async () => {
        const session = await idb.getSession(currentID);
        hfile.downloadJSON(session, session.name);
      });
  // delete session
  selection.select('.delete')
      .classed('d-none', state.stateChanged)
      .on('click', () => {
        const control = new bootstrap.Modal(document.getElementById("deletesessiond"));
        control.toggle();
      });
  // delete all
  selection.select('.deleteall')
      .classed('d-none', state.stateChanged)
      .on('click', () => {
        const control = new bootstrap.Modal(document.getElementById("deletealld"));
        control.toggle();
      });
}



function snapshotMenu(selection) {
  selection
      .classed('row', true)
      .classed('mb-1', true)
  // switch
  selection.append('div')
      .classed('switch', true)
      .classed('col-8', true)
      .call(lbox.selectBox, 'Snapshot')
    .select("select")
      .attr('disabled', true);;

  const menu = selection.append('div')
      .classed('col-4', true)
  // save
  menu.append('span')
      .classed('save', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Save', 'menu-save');
  // discard
  menu.append('span')
      .classed('discard', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Discard', 'delete-gray');
  // rename
  menu.append('span')
      .classed('rename', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Rename', 'menu-edittext');
  // delete
  menu.append('span')
      .classed('delete', true)
      .classed('d-none', true)
      .call(button.menuIcon, 'Delete', 'delete-gray');
  
}


function updateSnapshotMenu(selection, state) {
  // switch
  selection.select('.switch')
      .call(lbox.updateSelectBoxOptions, state.snapshots, (d, i) => i, d => d.name)
      .call(lbox.updateSelectBoxValue, state.snapshotIndex)
      .on('change', event => {
        const i = lbox.selectBoxValueIndex(d3.select(event.currentTarget));
        state.snapshotIndex = i;
        state.applySnapshot(i);
        state.updateHeaderNotifier();
        state.updateViewNotifier();
      })
      .select("select")
        .attr('disabled', state.stateChanged ? true : null);
  // Save snapshot
  selection.select('.save')
      .classed('d-none', !state.stateChanged)
      .on('click', async () => {
        state.stickNotifier();
        const snapshot = state.getSnapshot();
        await idb.appendSnapshot(state.sessionID, snapshot);
        state.stateChanged = false;
        state.snapshots.push(snapshot);
        state.snapshotIndex = state.snapshots.length - 1;
        state.applySnapshot(state.snapshotIndex);
        state.updateHeaderNotifier();
      });
  // discard change
  selection.select('.discard')
      .classed('d-none', !state.stateChanged)
      .on('click', function () {
        const control = new bootstrap.Modal(document.getElementById("discardd"));
        control.toggle();
      });
  // rename
  selection.select('.rename')
      .classed('d-none', state.stateChanged)
      .on('click', function () {
        const control = new bootstrap.Modal(document.getElementById("renamed"));
        control.toggle();
      });
  // delete
  selection.select('.delete')
      .classed('d-none', state.stateChanged)
      .on('click', function () {
        const control = new bootstrap.Modal(document.getElementById("deletesnapshotd"));
        control.toggle();
      });
}


function headerMenu(selection) {
  selection.append("div")
      .attr("id", 'header-session')
      .call(sessionMenu);
  selection.append("div")
      .attr("id", 'header-snapshot')
      .call(snapshotMenu);
}


function updateHeaderMenu(selection, state) {
  selection.select("#header-session")
      .call(updateSessionMenu, state);
  selection.select("#header-snapshot")
      .call(updateSnapshotMenu, state);

  state.updateHeaderNotifier = () => {
    selection.call(updateHeaderMenu, state);
  };
}



async function run() {
  // Check web browser compatibility
  const err = client.compatibility();
  if (err) {
    d3.select('body')
      .style('color', '#ff0000')
      .text(err);
    return;
  }

  // Render contents
  d3.select('#header').call(headerMenu);
  d3.select('#frame')
    .append('svg')
      .attr("id", "view")
      .call(component.viewComponent)
      .call(interaction.interactionComponent);
  d3.select('#control')
      .call(control.controlBox);

  const dialogs = d3.select('#dialogs');
  dialogs.append('div')
      .attr("id", "renamed")
      .call(modal.renameDialog);
  dialogs.append('div')
      .attr("id", "discardd")
      .call(modal.confirmDialog);
  dialogs.append('div')
      .attr("id", "deletesessiond")
      .call(modal.confirmDialog);
  dialogs.append('div')
      .attr("id", "deletesnapshotd")
      .call(modal.confirmDialog);
  dialogs.append('div')
      .attr("id", "deletealld")
      .call(modal.confirmDialog);

  const sessionid = await idb.getConfig("currentSession");
  if (!sessionid) { return; } // start from new session

  // set view frame size (depends on browser)
  const width = d3.select("#frame").property("offsetWidth");
  const height = d3.select("#frame").property("offsetHeight");
  // open session
  const session = await idb.getSession(sessionid);
  const state = new NetworkState(session, width, height);
  setState(state);
}


function setState(state) {
  // Title
  d3.select('title').text(state.sessionName);

  // Update contents
  d3.select('#header')
      .call(updateHeaderMenu, state);
  d3.select("#view")
      .call(component.updateView, state)
      .call(force.setForce, state)
      .call(interaction.setInteraction, state);
  d3.select('#control')
      .call(control.updateControlBox, state);

  // Dialogs
  d3.select('#renamed')
      .call(modal.updateRenameDialog, state.name)
    .select(".submit")
      .on('click', async event => {
        const newName = modal.renameDialogValue(event.currentTarget);
        await idb.renameSnapshot(state.sessionID, state.snapshotIndex, newName);
        state.snapshots[state.snapshotIndex].name = newName;
        state.updateHeaderNotifier();
      });
  d3.select('#discardd')
      .call(modal.updateConfirmDialog,
            'Are you sure you want to discard changes?')
    .select(".ok")
      .on('click', event => {
        state.applySnapshot(state.snapshotIndex);
      });
  d3.select('#deletesessiond')
      .call(modal.updateConfirmDialog,
            'Are you sure you want to delete the session?')
    .select(".ok")
      .on('click', async () => {
        const headers = await idb.getSessionHeaders();
        if (headers.length == 1) {
          await idb.clearAll();  // Clear all
        } else {
          await idb.deleteSession(state.sessionID);
          const deleted = await idb.getSessionHeaders();
          await idb.putConfig("currentSession", deleted.slice(-1)[0].id);
        }
        location.reload();
      });
  d3.select('#deletesnapshotd')
      .call(modal.updateConfirmDialog,
            'Are you sure you want to delete the snapshot?')
    .select(".ok")
      .on('click', async () => {
        await idb.deleteSnapshot(state.sessionID, state.snapshotIndex);
        location.reload();
      });
  d3.select('#deletealld')
      .call(modal.updateConfirmDialog,
            'Are you sure you want to delete all local tables and reset the datastore ?')
    .select(".ok")
      .on('click', async () => {
        await idb.clearAll();
        location.reload();
      });

  // Resize window
  window.onresize = () => {
    const width = d3.select("#frame").property("offsetWidth");
    const height = d3.select("#frame").property("offsetHeight");
    state.setViewBox(width, height);
    state.updateViewNotifier();
  }

  // Update all
  state.updateAllNotifier();
}


export default {
  run
};
