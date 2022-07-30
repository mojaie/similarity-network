
/** @module dialog/workspace */

import d3 from 'd3';

import {default as button} from '../component/button.js';
import {default as dropdown} from '../component/dropdown.js';
import {default as box} from '../component/formBox.js';
import {default as lbox} from '../component/formListBox.js';
import {default as modal} from '../component/modal.js';


const id = 'fieldinput-dialog';
const title = 'Add custom field';


function menuLink(selection) {
  selection.call(button.dropdownMenuModal, title, id, 'menu-addcheckbox');
}


function body(selection) {
  const mbody = selection.call(modal.submitDialog, id, title)
      .select('.modal-body');

  // Custom field name
  mbody.append('div')
      .classed('key', true)
      .call(box.textBox, 'Field key')
    .select('.form-control')
      .attr('required', 'required');

  // Field type
  const options = [
    {key: 'checkbox', name: 'Checkbox', format: 'checkbox'},
    {key: 'text_field', name: 'Text field', format: 'text_field'},
    {key: 'template', name: 'Template', format: 'html'}
  ];
  mbody.append('div')
      .classed('type', true)
      .call(lbox.selectBox, 'Type')
      .call(lbox.updateSelectBoxOptions, options)
      .on('change',  function () {
        const type = box.formValue(d3.select(this));
        const custom = type === 'template';
        selection.selectAll('.tmpbuild .form-control')
            .property('disabled', !custom);
      });

  // Template builder
  const collapse = mbody.append('div')
      .call(dropdown.dropdownFormGroup, 'Template builder')
    .select('.card-body');

  // Template field
  collapse.append('div')
      .classed('tmpfield', true)
      .classed('mb-1', true)
      .call(lbox.selectBox, 'Field')
      .on('change', function () {
        const rcd = lbox.selectedRecord(d3.select(this));
        const notation = rcd.d3_format ? `:${rcd.d3_format}` : '';
        selection.select('.notation')
            .call(box.updateReadonlyValue, `{${rcd.key}${notation}}`);
      });

  // Notation
  collapse.append('div')
      .classed('notation', true)
      .call(box.readonlyBox, 'Notation');

  // Template input
  collapse.append('div')
      .classed('contents', true)
      .call(box.textareaBox, 'Contents', 5);
}


function updateBody(selection, name) {
  return idb.getAllItems().then(items => {
    const treeNodes = [{id: 'root'}];
    const ogs = [];
    items.forEach(pkg => {
      pkg.parent = 'root';
      pkg.ongoing = specs.isRunning(pkg);
      ogs.push(pkg.ongoing);
      treeNodes.push(pkg);
      pkg.views.forEach(view => {
        view.parent = pkg.id;
        view.ongoing = pkg.ongoing;
        view.alone = pkg.views.length <= 1;
        view.parentName = pkg.name;
        view.stats = ['nodes', 'edges', 'rows', 'items']
          .filter(e => view.hasOwnProperty(e))
          .map(e => [e,
            d3.format(".3~s")(
              pkg.dataset.find(d => d.collectionID === view[e])
                .contents.reduce((a, b) => a + b.records.length, 0))]);
        const coll = new Collection(pkg.dataset
          .find(d => d.collectionID === view[
            ['edges', 'rows', 'items'].filter(e => view.hasOwnProperty(e))[0]
          ]));
        const statusText = coll.status() === 'done' ? '' : coll.status();
        const progText = coll.ongoing() ? `${coll.progress()}%` : '';
        view.stats.push([coll.status(), `${statusText}${progText}`]);
        treeNodes.push(view);
      });
    });
    d3.select('.reset')
        .classed('disabled', ogs.some(e => e));
    d3.select('.stored')
        .call(tree.tree()
          .bodyHeight(300)
          .nodeEnterFactory(viewNode)
          .nodeMergeFactory(updateViewNode), treeNodes
        );
    onLoading.style('display', 'none');
  });
}








export default {
  menuLink, body, updateBody
};
