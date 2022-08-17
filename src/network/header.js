
/** @module network/header */

import _ from 'lodash';
import d3 from 'd3';

import {default as misc} from '../common/misc.js';
import {default as cscale} from '../common/scale.js';

import {default as badge} from '../component/badge.js';
import {default as box} from '../component/formBox.js';
import {default as cbox} from '../component/controlBox.js';
import {default as lbox} from '../component/formListBox.js';
import {default as button} from '../component/button.js';

import {default as force} from './force.js';


/*
header1
- switch session: dropdown -> dialog confirm (if unsaved snapshot)
- open new session: button-> open file(.json)
- rename session: button -> dialog rename
- export session: button -> download
- delete session: button -> dialog confirm
- reset workspace -> dialog confirm
header2
- switch snapshot: dropdown -> dialog confirm (if unsaved snapshot)
- save: button
- rename: button -> dialog rename
- resume: button -> dialog confirm
- delete: button -> dialog confirm

*/

function actionIcon(selection, icon) {
  selection.append('img')
    .attr('src', `${button.iconBaseURL}${icon}.svg`)
    .classed('mx-1', true)
    .style('width', '1.25rem')
    .style('height', '1.25rem');
}

function sessionMenu(selection) {
  selection
      .classed('row', true)
      .classed('mb-1', true)
  // switch
  selection.append('div')
      .classed('switch', true)
      .classed('col-8', true)
      .call(lbox.selectBox, 'Session');

  const menu = selection.append('div')
      .classed('col-4', true)
  // open
  menu.append('span')
      .classed('open', true)
    .append('a')
      .call(button.dropdownMenuFile, 'Open new session', '.json,.gz', 'menu-import');
  
  // export
  menu.append('span')
      .classed('export', true)
    .append('a')
      .call(button.dropdownMenuItem, '', 'menu-export');
  
  // loading circle
  menu.append('span')
      .classed('loading-circle', true)
      .call(badge.loadingCircle);
}

function updateSessionMenu(selection) {
  // TODO: idb
  const sessionIDs = []
  const currentSessionID = null
  // switch
  selection.select('.switch')
      .call(lbox.updateSelectBoxOptions, sessionIDs)
      .call(lbox.updateSelectBoxValue, currentSessionID)
      .on('change', () => {
        
      });
  // open
  selection.select('.open')
      .on('change', async () => {
        d3.select('.loading-circle').style('display', 'inline-block');
        const file = button.dropdownMenuFileValue(menu);
        const json = await hfile.loadJSON(file);
        await idb.importItem(json);
        await updateApp();
      })
  // export
  selection.select('.export')
      .on('click', () => {
        const data = JSON.parse(JSON.stringify(record));
        delete data.instance;
        delete data.sessionStarted;
        hfile.downloadJSON(data, data.name);
      });
}



function snapshotMenu(selection, state) {
  selection
      .classed('row', true)
      .classed('mb-1', true)
  // switch
  selection.append('div')
      .classed('switch', true)
      .classed('col-8', true)
      .call(lbox.selectBox, 'Snapshot');

  const menu = selection.append('div')
      .classed('col-4', true)
  // open
  menu.append('span')
      .classed('export', true)
    .append('a')
      .call(actionIcon, 'menu-export')
      .call(button.dropdownMenuFile, 'Open new session', '.json,.gz', 'menu-import');

  // notify saved
  menu.append('span')
      .classed('notify-saved', true)
      .call(badge.alert)
      .call(badge.updateAlert, 'State saved', 'success', 'check-green')
      .style('display', 'none');
}


function updateSnapshotMenu(selection, state) {
  // export
  selection.select('.export')
      .call(actionIcon, 'menu-export')
      .on('click', function () {
        return state.saveSnapshot(idb)
          .then(menubar.select('.notify-saved').call(badge.notify));
      });
}


export default {
  sessionMenu, updateSessionMenu, snapshotMenu, updateSnapshotMenu
};
