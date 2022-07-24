
/** @module common/collection */

import _ from 'lodash';

import {default as mapper} from './mapper.js';


export default class Collection {
  /**
   * Create Collection from a flashflood response datatable
   * If data is not specified, put datatables later by this.append(data)
   * @param {object} coll - Collection or response object
   */
  constructor(coll) {
    // Settings
    this.autoIndex = 'index';  // enumerate records

    this.collectionID = coll.collectionID || null;
    this.instance = coll.instance || null;
    this.name = coll.name || null;
    if (coll.records) {
      this.contents = [coll];
      this.fields = [];
    } else {
      this.contents = coll.contents;
      this.fields = coll.fields || [];
    }
    this.contents.forEach(content => {
      content.fields.forEach(e => this.addField(e));
    });
  }

  /**
   * Add fields
   * @param {array} fs - list of fields
   */
  addField(field) {
    if (this.fields.find(e => e.key === field.key)) return;
    if (!field.hasOwnProperty('name')) field.name = field.key;
    if (!field.hasOwnProperty('visible')) field.visible = true;
    if (field.hasOwnProperty('d3_format')) field.format = 'd3_format';
    if (!field.hasOwnProperty('format')) field.format = 'raw';
    this.fields.push(field);
  }

  /**
   * Update fields properties
   * @param {array} fs - list of fields
   */
  updateFields(fs) {
    this.fields = [];
    fs.forEach(e => this.addField(e));
  }

  /**
   * Join fields
   * @param {object} mapping - column mapper object
   */
  joinFields(mapping) {
    this.contents.forEach(c => {
      mapper.apply(c, mapping);
    });
    if (mapping.hasOwnProperty('fields')) {
      mapping.fields.forEach(e => this.addField(e));
    } else {
      this.addField(mapping.field);
    }
  }

  /**
   * Apply function to the original data records
   * new fields should be manually added by Collection.addField
   * @param {function} func - function to be applied
   */
  apply(func) {
    this.contents.forEach(content => {
      content.records.forEach(rcd => {
        func(rcd);
      });
    });
  }

  /**
   * Return all records of the collection
   * @return {array} records
   */
  records() {
    return _.flatten(this.contents.map(e => e.records));
  }


  /**
   * Return total number of records
   * @return {float} total number of records
   */
  size() {
    return _.sum(this.contents.map(e => e.records.length));
  }


  /**
   * Export collection object as JSON
   * @return {object} collection JSON
   */
  // TODO: new method that exports only visible fields
  export() {
    return {
      $schema: "https://mojaie.github.io/kiwiii/specs/collection_v1.0.json",
      collectionID: this.collectionID,
      name: this.name,
      fields: this.fields,
      contents: this.contents
    };
  }
}
