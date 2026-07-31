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
