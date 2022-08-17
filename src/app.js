
/** @module app */

import * as d3 from 'd3';

import {default as client} from './common/client.js';
import {default as idb} from './common/idb.js';
import {default as hfile} from './common/file.js';

import {default as badge} from './component/badge.js';
import {default as button} from './component/button.js';
import {default as transform} from './component/transform.js';

import {default as renameDialog} from './dialog/rename.js';

import NetworkState from './network/state.js';
import {default as control} from './network/controlBox.js';
import {default as component} from './network/component.js';
import {default as force} from './network/force.js';
import {default as interaction} from './network/interaction.js';

import {default as header} from './network/header.js';


function updateApp(state) {
  // Title
  d3.select('title').text(state.name);

  // Status
  d3.select('#menubar .name').text(state.name);

  const onLoading = d3.select('#menubar .loading-circle');

  // Dialogs
  const dialogs = d3.select('#dialogs');

  // Rename dialog
  dialogs.select('.renamed')
      .call(renameDialog.updateBody, state.name)
      .on('submit', function () {
        onLoading.style('display', 'inline-block');
        state.name = renameDialog.value(d3.select(this));
        updateApp(state);
      });

  onLoading.style('display', 'none');
}


async function run() {
  const err = client.compatibility();
  if (err) {
    d3.select('body')
      .style('color', '#ff0000')
      .text(err);
    return;
  }

  const sessionMenu = d3.select('#header-session')
      .call(header.sessionMenu);
  const snapshotMenu = d3.select('#header-snapshot')
      .call(header.snapshotMenu);
  const dialogs = d3.select('#dialogs');


  // TODO:
  // idb config defaultWorkspaceを取りに行く
  // あれば表示

  // stub
  const stub = {
    name: "test",
    nodes: [
      {name: "hoge"}, {name: "fuga"}, {name: "piyo"},
    ],
    edges: [
      {source: 0, target: 1}, {source: 1, target: 2}, {source: 2, target: 0}
    ],
    snapshots: []
  };
  //const sid = await idb.putSession(stub);
  //await idb.putConfig("currentSession", sid);

  const sessionid = await idb.getConfig("currentSession");
  if (!sessionid) { return; }
  const session = await idb.getSession(sessionid);
  const state = new NetworkState(session);
  // TODO: define field size according to the data size
  state.fieldWidth = 1200;
  state.fieldHeight = 1200;

  // Contents
  const frame = d3.select('#frame')
      .call(transform.viewFrame, state);
  frame.select('.view')
      .call(component.networkView, state)
      .call(force.activate, state)
      .call(interaction.setInteraction, state);
  d3.select('#control')
      .call(control.controlBox, state);

  // Resize window
  window.onresize = () =>
    d3.select('#frame').call(transform.resize, state);

  // Update
  //state.updateAllNotifier();
  //updateApp(state);
}


export default {
  run
};
