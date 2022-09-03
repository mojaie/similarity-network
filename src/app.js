
/** @module app */

import d3 from 'd3';

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
      .classed('mb-1', true);
  // switch
  const selectbox = selection.append('div')
      .classed('switch', true)
      .classed('col-6', true)
      .call(lbox.selectBox, 'Session');
  selectbox.select("select")
      .attr('disabled', true);
  selectbox.select("label")
      .classed('col-4', false)
      .classed('col-3', true)
      .classed('text-end', true);
  selectbox.select("div")
      .classed('col-8', false)
      .classed('col-9', true);
  

  const menu = selection.append('div')
      .classed('col-6', true);
  // open new file
  menu.append('span')
      .classed('open', true)
    .append('a')
      .call(button.fileButton, 'New', '.json,.gz', 'menu-import')
      .on('change', async () => {
        // store json data
        // TODO: allow duplicate ID?
        const file = button.fileValue(menu);
        const json = await hfile.loadJSON(file);
        json.name = file.name.split(".")[0]; // use file basename as the session name
        json.id = await idb.putSession(json);  // issue session ID
        await idb.putConfig("currentSession", json.id);
        // establish state
        setState(json);
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
        // establish state
        setState(session);
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
      .on('click', async () => {
        const ok = await modal.showConfirmDialog(
          'Are you sure you want to delete the session?');
        if (ok) {
          const headers = await idb.getSessionHeaders();
          if (headers.length == 1) {
            await idb.clearAll();  // Clear all
          } else {
            await idb.deleteSession(state.sessionID);
            const deleted = await idb.getSessionHeaders();
            await idb.putConfig("currentSession", deleted.slice(-1)[0].id);
          }
          location.reload();
        }
      });
  // delete all
  selection.select('.deleteall')
      .classed('d-none', state.stateChanged)
      .on('click', async () => {
        const ok = await modal.showConfirmDialog(
          'Are you sure you want to delete all local tables and reset the datastore?');
        if (ok) {
          await idb.clearAll();
          location.reload();
        }
      });
}



function snapshotMenu(selection) {
  selection
      .classed('row', true)
      .classed('mb-1', true)
  // switch
  const selectbox = selection.append('div')
      .classed('switch', true)
      .classed('col-6', true)
      .call(lbox.selectBox, 'Snapshot');
  selectbox.select("select")
      .attr('disabled', true);
  selectbox.select("label")
      .classed('col-4', false)
      .classed('col-3', true)
      .classed('text-end', true);
  selectbox.select("div")
      .classed('col-8', false)
      .classed('col-9', true);

  const menu = selection.append('div')
      .classed('col-6', true);
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
        state.updateSnapshot(i);
      })
    .select("select")
      .attr('disabled', state.stateChanged ? true : null);
  // Save snapshot
  selection.select('.save')
      .classed('d-none', !state.stateChanged)
      .on('click', async () => {
        state.stickDispatcher();
        const snapshot = state.getSnapshot();
        await idb.appendSnapshot(state.sessionID, snapshot);
        state.snapshots.push(snapshot);
        state.snapshotIndex = state.snapshots.length - 1;
        state.updateSnapshot(state.snapshotIndex);
      });
  // discard change
  selection.select('.discard')
      .classed('d-none', !state.stateChanged || state.snapshots.length == 0)
      .on('click', async () => {
        const ok = await modal.showConfirmDialog(
          'Are you sure you want to discard changes?');
        if (ok) {
          state.updateSnapshot(state.snapshotIndex);
        }
      });
  // rename
  selection.select('.rename')
      .classed('d-none', state.stateChanged)
      .on('click', async () => {
        const newName = await modal.showRenameDialog(state.name);
        if (newName) {
          await idb.renameSnapshot(state.sessionID, state.snapshotIndex, newName);
          state.snapshots[state.snapshotIndex].name = newName;
          state.name = newName;
          state.updateHeaderCallback();
        }
      });
  // delete
  selection.select('.delete')
      .classed('d-none', state.stateChanged)
      .on('click', async () => {
        const ok = await modal.showConfirmDialog(
          'Are you sure you want to delete the snapshot?');
        if (ok) {
          await idb.deleteSnapshot(state.sessionID, state.snapshotIndex);
          location.reload();
        }
      });
}


function headerMenu(selection) {
  selection
      .classed("my-1", true);
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

  state.updateHeaderCallback = () => {
    selection.call(updateHeaderMenu, state);
  };
  state.updateMenuButtonCallback = () => {
    selection.call(updateHeaderMenu, state);
  };
}


function setState(data) {
  // set view frame size (depends on browser)
  function setFrameSize() {
    const width = d3.select(".container-fluid").property("offsetWidth");
    const height = d3.select(".container-fluid").property("offsetHeight");
    const headerH = d3.select("#header").property("offsetHeight");
    const tabH = d3.select("#control-tab").property("offsetHeight");
    const controlW = d3.select("#control").property("offsetWidth");
    d3.select("#workspace").style("height", `${height - headerH - 15}px`);
    d3.select(".tab-content").style("max-height", `${height - headerH - tabH - 25}px`);
    return [width - controlW - 15, height - headerH - 15]
  }

  const fsize = setFrameSize();
  const state = new NetworkState(data, fsize[0], fsize[1]);

  // Title
  d3.select('title').text(state.sessionName);

  // Update contents
  d3.select('#header')
      .call(updateHeaderMenu, state);
  d3.select("#view")
      .call(component.setViewCallbacks, state)
      .call(force.setForce, state)
      .call(interaction.setInteraction, state);
  d3.select('#control')
      .call(control.updateControlBox, state);

  // Resize window
  window.onresize = () => {
    const fsize = setFrameSize();
    state.setViewBox(fsize[0], fsize[1]);
  }

  // Update all
  state.updateSnapshotCallback = () => {
    state.setFocusArea();
    state.resizeCallback();
    state.updateHeaderCallback();
    state.updateFilter();
    state.updateControlBoxCallback();
    if (state.snapshots.length === 0) {
      state.restartDispatcher();
    }
  }
  // dispatch
  state.updateSnapshot(state.snapshotIndex);
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
      .attr("id", "confirmd")
      .call(modal.confirmDialog);

  const sessionid = await idb.getConfig("currentSession");
  if (!sessionid) { return; } // start from new session

  // open session
  const session = await idb.getSession(sessionid);
  setState(session);
}


export default {
  run
};
