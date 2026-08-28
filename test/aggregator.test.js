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

test('aggregator re-exports the bonarea collector', () => {
  assert.equal(typeof aggregator.bonarea.createBonareaCollector, 'function');
  assert.equal(typeof aggregator.bonarea.fetchStations, 'function');
});

test('aggregator re-exports the andorra collector', () => {
  assert.equal(typeof aggregator.andorra.createAndorraCollector, 'function');
  assert.equal(typeof aggregator.andorra.fetchStations, 'function');
});

test('aggregator re-exports the repsol collector', () => {
  assert.equal(typeof aggregator.repsol.createRepsolCollector, 'function');
  assert.equal(typeof aggregator.repsol.fetchStations, 'function');
});

test('repsol collector matches the normalized contract', () => {
  const collector = aggregator.repsol.createRepsolCollector({});
  assert.equal(collector.name, 'repsol');
  assert.equal(collector.country, 'ES');
  assert.equal(typeof collector.fetch, 'function');
});
