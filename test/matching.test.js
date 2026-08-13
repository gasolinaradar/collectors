const { test } = require('node:test');
const assert = require('node:assert');
const {
  haversineDistanceMeters,
  tokenSetSimilarity,
  scoreStationPair,
  matchStations,
  enrichStations,
  DEFAULT_MIN_CONFIDENCE,
} = require('../src/matching');

function makeStation(source, sourceStationId, name, address, coordinates) {
  return {
    source,
    country: 'ES',
    sourceStationId,
    name,
    address,
    municipality: 'Madrid',
    province: 'Madrid',
    location: { type: 'Point', coordinates },
    prices: {},
    lastUpdated: new Date(),
  };
}

test('haversineDistanceMeters returns 0 for identical points', () => {
  assert.equal(haversineDistanceMeters([-3.7038, 40.4168], [-3.7038, 40.4168]), 0);
});

test('haversineDistanceMeters matches the known distance for 1 degree at the equator', () => {
  const distance = haversineDistanceMeters([0, 0], [1, 0]);
  assert.ok(Math.abs(distance - 111194.93) < 1, `expected ~111194.93m, got ${distance}`);
});

test('haversineDistanceMeters is symmetric', () => {
  const a = [-3.7038, 40.4168];
  const b = [2.1734, 41.3851];
  assert.equal(haversineDistanceMeters(a, b), haversineDistanceMeters(b, a));
});

test('tokenSetSimilarity ignores accents, case and punctuation', () => {
  assert.equal(tokenSetSimilarity('Gasolinera Plenergy', 'gasolinera, plenergy!'), 1);
});

test('tokenSetSimilarity returns 0 when either text has no tokens', () => {
  assert.equal(tokenSetSimilarity('', 'Plenergy'), 0);
  assert.equal(tokenSetSimilarity('Plenergy', ''), 0);
});

test('scoreStationPair gives high confidence for the same location and name', () => {
  const a = makeStation('miterd', '1', 'PLENERGY', 'Calle Mayor 1', [-3.7038, 40.4168]);
  const b = makeStation('plenergy', 'p1', 'Plenergy', 'Calle Mayor 1', [-3.7038, 40.4168]);

  const score = scoreStationPair(a, b);
  assert.equal(score.distanceMeters, 0);
  assert.ok(score.confidence >= 90, `expected confidence >= 90, got ${score.confidence}`);
});

test('scoreStationPair returns 0 confidence beyond maxDistanceMeters', () => {
  const a = makeStation('miterd', '1', 'PLENERGY', 'Calle Mayor 1', [-3.7038, 40.4168]);
  const b = makeStation('plenergy', 'p1', 'PLENERGY', 'Calle Mayor 1', [-3.7038, 41.5]);

  const score = scoreStationPair(a, b);
  assert.equal(score.confidence, 0);
});

test('scoreStationPair ranks a matching name/address above a mismatching one at the same distance', () => {
  const a = makeStation('miterd', '1', 'PLENERGY', 'Calle Mayor 1', [-3.7038, 40.4168]);
  const bMatching = makeStation(
    'plenergy',
    'p1',
    'Plenergy',
    'Calle Mayor 1',
    [-3.7048, 40.4168],
  );
  const bMismatching = makeStation(
    'plenergy',
    'p2',
    'Repsol',
    'Avenida Sur 9',
    [-3.7048, 40.4168],
  );

  const matchingScore = scoreStationPair(a, bMatching);
  const mismatchingScore = scoreStationPair(a, bMismatching);

  assert.ok(matchingScore.confidence > mismatchingScore.confidence);
});

test('matchStations links matching cross-source stations, never pairs same-source stations, and ignores unrelated ones', () => {
  const miterdPlenergy = makeStation(
    'miterd',
    'IDEESS-1',
    'PLENERGY',
    'Calle Mayor 1',
    [-3.7038, 40.4168],
  );
  const miterdPlenergyOtherPump = makeStation(
    'miterd',
    'IDEESS-1-bis',
    'PLENERGY',
    'Calle Mayor 1',
    [-3.7038, 40.4168],
  );
  const miterdUnrelated = makeStation(
    'miterd',
    'IDEESS-2',
    'REPSOL',
    'Avenida Norte 3',
    [-3.7, 41.5],
  );
  const plenergyStation = makeStation(
    'plenergy',
    'plenergy-1',
    'Plenergy',
    'C/ Mayor, 1',
    [-3.7038, 40.4168],
  );

  const stations = [miterdPlenergy, miterdPlenergyOtherPump, miterdUnrelated, plenergyStation];

  const { pairs, groups } = matchStations(stations);

  // both miterd records at the same location legitimately match the single plenergy record
  assert.equal(pairs.length, 2);
  assert.ok(
    pairs.every((pair) => pair.a.source !== pair.b.source),
    'no pair should link stations from the same source',
  );
  assert.ok(
    pairs.every((pair) => pair.a !== miterdUnrelated && pair.b !== miterdUnrelated),
    'the unrelated station should never be paired',
  );

  // transitively joined through the shared plenergy station into a single group
  assert.equal(groups.length, 1);
  assert.equal(groups[0].stations.length, 3);
  assert.ok(groups[0].stations.includes(miterdPlenergy));
  assert.ok(groups[0].stations.includes(miterdPlenergyOtherPump));
  assert.ok(groups[0].stations.includes(plenergyStation));
});

test('enrichStations fills empty primary fields from a matched secondary source without overwriting existing ones', () => {
  const miterdStation = {
    ...makeStation('miterd', 'IDEESS-1', 'PLENERGY', 'Calle Mayor 1', [-3.7038, 40.4168]),
    schedule: undefined,
    services: undefined,
    prices: { gasoleoa: 1.5 },
  };
  const plenergyStation = {
    ...makeStation('plenergy', 'plenergy-1', 'Plenergy', 'C/ Mayor, 1', [-3.7038, 40.4168]),
    schedule: '24h',
    services: ['car_wash', 'ev_chargers'],
    prices: { gasoleoa: 1.499, gasolina95: 1.6 },
  };

  const [enriched] = enrichStations([miterdStation, plenergyStation], {
    primarySource: 'miterd',
  });

  assert.equal(enriched.source, 'miterd');
  assert.equal(enriched.schedule, '24h');
  assert.deepEqual(enriched.services, ['car_wash', 'ev_chargers']);
  // the primary already had prices, so it must win over the secondary's
  assert.deepEqual(enriched.prices, { gasoleoa: 1.5 });
  assert.equal(enriched.matchConfidence >= DEFAULT_MIN_CONFIDENCE, true);
  assert.deepEqual(enriched.sources, [
    { source: 'miterd', sourceStationId: 'IDEESS-1' },
    { source: 'plenergy', sourceStationId: 'plenergy-1' },
  ]);
});

test('enrichStations passes through unmatched primary stations untouched', () => {
  const miterdStation = makeStation(
    'miterd',
    'IDEESS-2',
    'REPSOL',
    'Avenida Norte 3',
    [-3.7, 41.5],
  );

  const [passthrough] = enrichStations([miterdStation], { primarySource: 'miterd' });

  assert.equal(passthrough.matchConfidence, undefined);
  assert.deepEqual(passthrough.sources, [{ source: 'miterd', sourceStationId: 'IDEESS-2' }]);
});
