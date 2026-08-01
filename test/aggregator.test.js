const { test } = require('node:test');
const assert = require('node:assert');
const aggregator = require('../src');

test('aggregator re-exports the miterd collector', () => {
  assert.equal(typeof aggregator.miterd.createMiterdCollector, 'function');
  assert.equal(typeof aggregator.miterd.fetchStations, 'function');
});

test('aggregator re-exports the dgeg collector', () => {
  assert.equal(typeof aggregator.dgeg.createDgegCollector, 'function');
  assert.equal(typeof aggregator.dgeg.fetchStations, 'function');
});

test('aggregator re-exports the plenergy collector', () => {
  assert.equal(typeof aggregator.plenergy.createPlenergyCollector, 'function');
  assert.equal(typeof aggregator.plenergy.fetchStations, 'function');
});

test('aggregator re-exports the dgt-ev collector', () => {
  assert.equal(typeof aggregator.dgtEv.createDgtEvCollector, 'function');
  assert.equal(typeof aggregator.dgtEv.fetchStations, 'function');
});
