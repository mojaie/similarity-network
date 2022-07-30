
/** @module app */

import * as d3 from 'd3';

import {default as client} from './common/client.js';
import {default as idb} from './common/idb.js';

import {default as badge} from './component/badge.js';
import {default as button} from './component/button.js';
import {default as modal} from './component/modal.js';
import {default as transform} from './component/transform.js';

import {default as renameDialog} from './dialog/rename.js';

import NetworkState from './network/state.js';
import {default as control} from './network/controlBox.js';
import {default as component} from './network/component.js';
import {default as force} from './network/force.js';
import {default as interaction} from './network/interaction.js';


async function app(session) {
  const menubar = d3.select('#menubar')
      .classed('my-1', true);
  menubar.selectAll('div,span,a').remove();  // Clean up
  const dialogs = d3.select('#dialogs');
  dialogs.selectAll('div').remove();  // Clean up

  const state = new NetworkState(await session);
  // TODO: define field size according to the data size
  state.fieldWidth = 1200;
  state.fieldHeight = 1200;

  // Network view control
  const menu = menubar.append('div')
      .call(button.dropdownMenuButton, 'Menu', 'primary', 'network-white')
      .select('.dropdown-menu');
  menu.append('a').call(renameDialog.menuLink);
  menu.append('a')
      .call(button.dropdownMenuItem, 'Save', 'menu-save')
      .on('click', async function () {
        await state.saveSnapshot(idb)
        menubar.select('.notify-saved').call(badge.notify);
      });

  // Dashboard link
  menubar.append('a')
      .call(button.menuButtonLink, 'Dashboard',
            'outline-secondary', 'status-gray')
      .attr('href', 'dashboard.html')
      .attr('target', '_blank');

  // Status
  menubar.append('span')
      .classed('loading-circle', true)
      .call(badge.loadingCircle);
  menubar.append('span')
      .classed('notify-saved', true)
      .call(badge.alert)
      .call(badge.updateAlert, 'State saved', 'success', 'check-green')
      .style('display', 'none');
  menubar.append('span')
      .classed('name', true);
  menubar.append('span')
      .classed('nodes-count', true)
      .call(badge.badge);
  menubar.append('span')
      .classed('edges-count', true)
      .call(badge.badge);

  // Dialogs
  dialogs.append('div')
      .classed('renamed', true)
      .call(renameDialog.body);
  dialogs.append('div')
      .classed('selectd', true)
      .call(selectDialog.body);
  dialogs.append('div')
      .classed('newd', true)
      .call(newDialog.body); // (jsonかjson.tar.gz)
  // TODO: export session (json.tar.gz)

  // snapshotはcontrolでpull down選択?にする
  // save snapshotもcontrolに表示
  // 初期は最新のsnapshotを表示

  // Jupyter notebook風に
  // TODO: rename session
  // TODO: rename snapshot

  // TODO: 座標の初期化(0,0付近にランダム配置)

  // Contents
  const frame = d3.select('#nw-frame')
      .call(transform.viewFrame, state);
  frame.select('.view')
      .call(component.networkView, state)
      .call(force.activate, state)
      .call(interaction.setInteraction, state);
  d3.select('#nw-control')
      .call(control.controlBox, state);

  // Resize window
  window.onresize = () =>
    d3.select('#nw-frame').call(transform.resize, state);

  // Update
  state.updateAllNotifier();
  updateApp(state);
}


function updateApp(state) {
  // Title
  d3.select('title').text(state.name);

  // Status
  d3.select('#menubar .name').text(state.name);

  const onLoading = d3.select('#menubar .loading-circle');
  const commaf = d3.format(',');
  d3.select('#menubar .nodes-count')
      .call(badge.updateBadge, `${commaf(state.nodes.size())} nodes`,
            'light', 'nodes-gray')
    .select('.text')
      .style('color', 'gray');
  d3.select('#menubar .edges-count')
      .call(badge.updateBadge, `${commaf(state.edges.size())} edges`,
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

  // TODO:
  // idb config defaultWorkspaceを取りに行く
  // あれば表示
  const defaultSession = await idb.getConfig("defaultSession")
  if (defaultSession == null) {
    // なければimport dialog
  }
  try {
    const session = idb.getItem(defaultse);
    app(session)
  } catch (err) {
    console.error(err);
    d3.select('#nw-frame')
      .style('color', 'red')
      .text(err);
  }
}


export default {
  run
};
