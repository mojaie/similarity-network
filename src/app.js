
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


function updateApp(state) {
  // Title
  d3.select('title').text(state.name);

  // Status
  d3.select('#menubar .name').text(state.name);

  const onLoading = d3.select('#menubar .loading-circle');
  const commaf = d3.format(',');
  d3.select('#menubar .nodes-count')
      .call(badge.updateBadge, `${commaf(state.nodes.length)} nodes`,
            'light', 'nodes-gray')
    .select('.text')
      .style('color', 'gray');
  d3.select('#menubar .edges-count')
      .call(badge.updateBadge, `${commaf(state.edges.length)} edges`,
            'light', 'edges-gray')
    .select('.text')
      .style('color', 'gray');


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

  const header1 = d3.select('#header1')
      .classed('my-1', true);
  const header2 = d3.select('#header2')
      .classed('my-1', true);
  const dialogs = d3.select('#dialogs');
  // header1.selectAll('div,span,a').remove();  // Clean up
  // header2.selectAll('div,span,a').remove();  // Clean up
  // dialogs.selectAll('div').remove();  // Clean up


  const actionIcon = (sel, icon) => sel.append('img')
      .attr('src', `${button.iconBaseURL}${icon}.svg`)
      .classed('mx-1', true)
      .style('width', '1.25rem')
      .style('height', '1.25rem');
  // Header
  header1.append('span')
      .classed('name', true);
  header1.append('a')
      .call(button.dropdownMenuFile, 'Open new session',
        '.json,.gz', 'menu-import')
      .on('change', function () {
        d3.select('#menubar .loading-circle').style('display', 'inline-block');
        const file = button.dropdownMenuFileValue(d3.select(this));
        return hfile.loadJSON(file)
          .then(idb.importItem)
          .then(updateApp);
      });
  header1.append('a')
      .call(button.dropdownMenuItem, 'Export current session', 'menu-export')
      .on('click', () => {
        const data = JSON.parse(JSON.stringify(record));
        delete data.instance;
        delete data.sessionStarted;
        hfile.downloadJSON(data, data.name);
      });
  header1.append('span')
      .classed('loading-circle', true)
      .call(badge.loadingCircle);

  header2.append('a').call(actionIcon, 'menu-export')
      .on('click', function () {
        return state.saveSnapshot(idb)
          .then(menubar.select('.notify-saved').call(badge.notify));
      });
  header2.append('span')
      .classed('notify-saved', true)
      .call(badge.alert)
      .call(badge.updateAlert, 'State saved', 'success', 'check-green')
      .style('display', 'none');


  // Control statsに置く
  /*
  menubar.append('span')
  .classed('nodes-count', true)
  .call(badge.badge);
  menubar.append('span')
  .classed('edges-count', true)
  .call(badge.badge);
  */

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


  // TODO: export session (json.tar.gz)

  // snapshotはcontrolでpull down選択?にする
  // save snapshotもcontrolに表示
  // 初期は最新のsnapshotを表示

  // Jupyter notebook風に
  // TODO: rename session
  // TODO: rename snapshot

  // TODO: 座標の初期化(0,0付近にランダム配置)

  // Contents
  const frame = d3.select('#frame')
      .call(transform.viewFrame, state);
  frame.select('.view')
      .call(component.networkView, state)
      .call(force.activate, state)
      .call(interaction.setInteraction, state);
  //d3.select('#control')
  //    .call(control.controlBox, state);

  // Resize window
  window.onresize = () =>
    d3.select('#frame').call(transform.resize, state);

  // Update
  state.updateAllNotifier();
  updateApp(state);
}


export default {
  run
};
