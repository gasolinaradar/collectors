'use strict';

/**
 * Validates the REAL normalized station shape produced by each re-exported
 * collector's `fetch()` — i.e. the full HTTP -> retry -> normalize pipeline —
 * by injecting a mock `httpClient` (no network).
 *
 * The promised shape lives in README.md:44-52:
 *
 *   {
 *     source, country, sourceStationId,
 *     name, address, municipality, province, postalCode,
 *     schedule, services,
 *     location: { type: 'Point', coordinates: [lon, lat] },
 *     prices,
 *     lastUpdated,
 *   }
 *
 * Every collector accepts `options.httpClient`. Each raw payload below embeds at
 * least one fuel that must NOT survive into `prices` (missing/blank/non-numeric
 * value) so the "prices gap" behaviour is asserted per collector: MITERD keeps
 * the key with a `null` value, every other collector drops the key entirely.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const {
  miterd,
  dgeg,
  plenergy,
  dgtEv,
  bonarea,
  andorra,
  repsol,
} = require('../src');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const SHAPE_KEYS = [
  'source',
  'country',
  'sourceStationId',
  'name',
  'address',
  'municipality',
  'province',
  'postalCode',
  'schedule',
  'services',
  'location',
  'prices',
  'lastUpdated',
];

const silentLogger = { info() {}, warn() {}, debug() {}, error() {} };

// Minimal axios-like response envelope.
const httpResponse = (data) => ({ status: 200, statusText: 'OK', headers: {}, data });

function assertNormalizedShape(station, { source, country, extraKeys = [] }) {
  // every promised key is present (even when its value is `undefined`)
  for (const key of SHAPE_KEYS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(station, key),
      `expected key "${key}" on the normalized ${source} station`,
    );
  }

  // no keys beyond the contract (a collector may add documented extras)
  const allowed = new Set([...SHAPE_KEYS, ...extraKeys]);
  const unexpected = Object.keys(station).filter((key) => !allowed.has(key));
  assert.deepStrictEqual(unexpected, [], `unexpected keys on ${source} station: ${unexpected}`);

  assert.strictEqual(station.source, source);
  assert.strictEqual(station.country, country);
  assert.ok(
    typeof station.sourceStationId === 'string' && station.sourceStationId.length > 0,
    'sourceStationId must be a non-empty string',
  );

  // location: { type: 'Point', coordinates: [lon, lat] }
  assert.ok(station.location && typeof station.location === 'object');
  assert.strictEqual(station.location.type, 'Point');
  assert.ok(Array.isArray(station.location.coordinates));
  assert.strictEqual(station.location.coordinates.length, 2);
  const [lon, lat] = station.location.coordinates;
  assert.ok(Number.isFinite(lon), 'longitude must be finite');
  assert.ok(Number.isFinite(lat), 'latitude must be finite');

  // prices: object map or undefined
  assert.ok(
    station.prices === undefined ||
      (typeof station.prices === 'object' && station.prices !== null && !Array.isArray(station.prices)),
    'prices must be a plain object or undefined',
  );

  // lastUpdated: a valid Date
  assert.ok(station.lastUpdated instanceof Date, 'lastUpdated must be a Date');
  assert.ok(!Number.isNaN(station.lastUpdated.getTime()), 'lastUpdated must be a valid Date');
}

// ---------------------------------------------------------------------------
// miterd  -> httpClient.get => { data: { ListaEESSPrecio: [...] } }
// ---------------------------------------------------------------------------

test('miterd fetch() returns the normalized shape and keeps blank fuels as null', async () => {
  const rawStation = {
    IDEESS: '12345',
    'Rótulo': 'CEPSA',
    'Dirección': 'CTRA. N-340 KM 5',
    Municipio: 'Almeria',
    Provincia: 'Almeria',
    'C.P.': '04001',
    Horario: 'L-D: 24H',
    Latitud: '36,8340',
    'Longitud (WGS84)': '-2,4637',
    'Precio Gasolina 95 E5': '1,509',
    'Precio Gasoleo A': '1,419',
    // gaps: present in the raw payload, blank value -> normalized to null
    'Precio Gasoleo B': '',
    'Precio Hidrogeno': '',
  };

  const calls = [];
  const httpClient = {
    async get(url) {
      calls.push(url);
      return httpResponse({ ListaEESSPrecio: [rawStation] });
    },
  };

  const collector = miterd.createMiterdCollector({ httpClient, logger: silentLogger });
  const stations = await collector.fetch();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(stations.length, 1);
  const [station] = stations;

  assertNormalizedShape(station, { source: 'miterd', country: 'ES' });
  assert.strictEqual(station.sourceStationId, '12345');
  assert.strictEqual(station.name, 'CEPSA');
  assert.strictEqual(station.address, 'CTRA. N-340 KM 5');
  assert.strictEqual(station.municipality, 'Almeria');
  assert.strictEqual(station.province, 'Almeria');
  assert.strictEqual(station.postalCode, '04001');
  assert.strictEqual(station.schedule, 'L-D: 24H');
  assert.strictEqual(station.services, undefined);
  assert.deepStrictEqual(station.location.coordinates, [-2.4637, 36.834]);

  // prices gap: MITERD keeps blank fuels as an explicit null
  assert.strictEqual(station.prices.gasolina95e5, 1.509);
  assert.strictEqual(station.prices.gasoleoa, 1.419);
  assert.ok('gasoleob' in station.prices);
  assert.strictEqual(station.prices.gasoleob, null);
  assert.strictEqual(station.prices.hidrogeno, null);
});

// ---------------------------------------------------------------------------
// dgeg  -> list { status, resultado: [...] } + detail GetDadosPostoMapa (conc. 4)
// ---------------------------------------------------------------------------

test('dgeg fetch() returns the normalized shape and drops unpriced fuels', async () => {
  const listUrl = 'mock://dgeg/list';
  const detailUrl = 'mock://dgeg/detail';

  const detailsById = {
    1: {
      Id: 1,
      Nome: 'Posto A',
      Latitude: '38,7223',
      Longitude: '-9,1393',
      Morada: { Morada: 'Rua A 1', CodPostal: '1100-001', Localidade: 'Lisboa', Distrito: 'Lisboa' },
      DataAtualizacao: '2026-09-01 08:30',
      Combustiveis: [
        { TipoCombustivel: 'Gasoleo simples', Preco: '1,459' },
        // gap: fuel present in the raw detail, no price -> dropped
        { TipoCombustivel: 'Gasolina 95', Preco: null },
      ],
      Servicos: [{ Descritivo: 'Loja' }],
      MeiosPagamento: [{ Descritivo: 'Multibanco' }],
      HorarioPosto: { DiasUteis: '06:00-23:00', Sabado: '', Domingo: '', Feriado: '' },
    },
    2: {
      Id: 2,
      Nome: 'Posto B',
      Latitude: '41,1496',
      Longitude: '-8,6109',
      Morada: { Morada: 'Rua B 2', CodPostal: '4000-002', Localidade: 'Porto', Distrito: 'Porto' },
      DataAtualizacao: '2026-09-02 09:00',
      Combustiveis: [{ TipoCombustivel: 'Gasolina 95', Preco: '1,659' }],
    },
  };

  const calls = [];
  const httpClient = {
    async get(url) {
      calls.push(url);
      if (url.startsWith(listUrl)) {
        return httpResponse({
          status: true,
          resultado: [
            { Id: 1, Nome: 'Posto A', Combustivel: 'Gasoleo simples', Preco: '1,459' },
            { Id: 2, Nome: 'Posto B', Combustivel: 'Gasolina 95', Preco: '1,659' },
          ],
        });
      }
      if (url.startsWith(detailUrl)) {
        const id = decodeURIComponent(url.match(/[?&]id=([^&]+)/)[1]);
        return httpResponse({ status: true, resultado: detailsById[id] });
      }
      throw new Error(`unexpected dgeg url: ${url}`);
    },
  };

  const collector = dgeg.createDgegCollector({
    httpClient,
    logger: silentLogger,
    listUrl,
    detailUrl,
    detailConcurrency: 4,
  });
  const stations = await collector.fetch();

  // 1 list call + 1 detail call per unique station
  assert.strictEqual(calls.filter((u) => u.startsWith(detailUrl)).length, 2);
  assert.strictEqual(stations.length, 2);

  const station = stations.find((s) => s.sourceStationId === '1');
  assertNormalizedShape(station, { source: 'dgeg', country: 'PT' });
  assert.strictEqual(station.name, 'Posto A');
  assert.strictEqual(station.address, 'Rua A 1, 1100-001');
  assert.strictEqual(station.municipality, 'Lisboa');
  assert.strictEqual(station.province, 'Lisboa');
  assert.strictEqual(station.postalCode, '1100-001');
  assert.strictEqual(station.schedule, 'L-V: 06:00-23:00');
  assert.deepStrictEqual(station.services, ['Loja', 'Multibanco']);
  assert.deepStrictEqual(station.location.coordinates, [-9.1393, 38.7223]);

  // prices gap: DGEG drops the unpriced fuel entirely
  assert.strictEqual(station.prices.gasoleosimples, 1.459);
  assert.ok(!('gasolina95' in station.prices));
});

// ---------------------------------------------------------------------------
// plenergy  -> httpClient.get => raw array; inline prices avoid the urlweb scrape
// ---------------------------------------------------------------------------

test('plenergy fetch() returns the normalized shape from inline prices without scraping', async () => {
  const url = 'mock://plenergy/json';
  const rawStation = {
    id: 42,
    nombreweb: 'PLENERGY Test',
    direccion: 'Av. Prueba 1',
    poblacion: 'Madrid',
    provincia: 'Madrid',
    cpostal: '28002',
    latitud: '40,4000',
    longitud: '-3,7000',
    es24h: '1',
    surtidores: '4',
    lavaderos: '1',
    urlweb: 'https://plenergy.es/estacion/42',
    precioGasolina95: '1,459',
    pvpGasoleoA: '1,399',
    // gap: price field present in the raw JSON, blank value -> dropped
    precioAdBlue: '',
  };

  const calls = [];
  const httpClient = {
    async get(requestedUrl) {
      calls.push(requestedUrl);
      if (requestedUrl === url) {
        return httpResponse([rawStation]);
      }
      throw new Error(`plenergy must not scrape a station page (got ${requestedUrl})`);
    },
  };

  const collector = plenergy.createPlenergyCollector({ httpClient, logger: silentLogger, url });
  const stations = await collector.fetch();

  // the only request is the dataset JSON — the urlweb page is never fetched
  assert.deepStrictEqual(calls, [url]);
  assert.strictEqual(stations.length, 1);
  const [station] = stations;

  assertNormalizedShape(station, { source: 'plenergy', country: 'ES' });
  assert.strictEqual(station.sourceStationId, '42');
  assert.strictEqual(station.name, 'PLENERGY Test');
  assert.strictEqual(station.address, 'Av. Prueba 1');
  assert.strictEqual(station.municipality, 'Madrid');
  assert.strictEqual(station.province, 'Madrid');
  assert.strictEqual(station.postalCode, '28002');
  assert.strictEqual(station.schedule, '24h');
  assert.deepStrictEqual(station.services, ['fuel_pumps', 'car_wash']);
  assert.deepStrictEqual(station.location.coordinates, [-3.7, 40.4]);

  // prices gap: PLENERGY drops the blank price field entirely
  assert.strictEqual(station.prices.gasolina95, 1.459);
  assert.strictEqual(station.prices.gasoleoa, 1.399);
  assert.ok(!('adblue' in station.prices));
});

// ---------------------------------------------------------------------------
// dgt-ev  -> httpClient.get => XML string (fast-xml-parser); prices always undefined
// ---------------------------------------------------------------------------

const DGT_EV_XML = `<?xml version="1.0" encoding="UTF-8"?>
<payload>
  <egi:energyInfrastructureTablePublication>
    <egi:energyInfrastructureTable>
      <egi:energyInfrastructureSite>
        <id>DGT-EV-001</id>
        <name>Electrolinera Test</name>
        <lastUpdated>2026-09-01T10:00:00Z</lastUpdated>
        <locationReference>
          <coordinatesForDisplay>
            <latitude>40.4168</latitude>
            <longitude>-3.7038</longitude>
          </coordinatesForDisplay>
          <_locationReferenceExtension>
            <facilityLocation>
              <address>
                <addressLine><text>Direccion: Calle Falsa 123</text></addressLine>
                <addressLine><text>Municipio: Madrid</text></addressLine>
                <addressLine><text>Provincia: Madrid</text></addressLine>
                <postcode>28001</postcode>
              </address>
            </facilityLocation>
          </_locationReferenceExtension>
        </locationReference>
        <operatingHours><label>24/7</label></operatingHours>
        <supplementalFacility><serviceFacilityType>shop</serviceFacilityType></supplementalFacility>
        <energyInfrastructureStation>
          <refillPoint>
            <connector>
              <connectorType>iec62196T2</connectorType>
              <connectorFormat>socket</connectorFormat>
              <chargingMode>mode3</chargingMode>
              <maxPowerAtSocket>22000</maxPowerAtSocket>
              <voltage>400</voltage>
              <maximumCurrent>32</maximumCurrent>
            </connector>
          </refillPoint>
        </energyInfrastructureStation>
      </egi:energyInfrastructureSite>
    </egi:energyInfrastructureTable>
  </egi:energyInfrastructureTablePublication>
</payload>`;

test('dgt-ev fetch() returns the normalized shape with connectors and no prices', async () => {
  const calls = [];
  const httpClient = {
    async get(url, config) {
      calls.push({ url, config });
      return httpResponse(DGT_EV_XML);
    },
  };

  const collector = dgtEv.createDgtEvCollector({ httpClient, logger: silentLogger, url: 'mock://dgt-ev' });
  const stations = await collector.fetch();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].config.responseType, 'text'); // XML requested as text
  assert.strictEqual(stations.length, 1);
  const [station] = stations;

  // `connectors` is a documented dgt-ev extra on top of the shared contract
  assertNormalizedShape(station, { source: 'dgt-ev', country: 'ES', extraKeys: ['connectors'] });
  assert.strictEqual(station.source, 'dgt-ev');
  assert.strictEqual(station.sourceStationId, 'DGT-EV-001');
  assert.strictEqual(station.name, 'Electrolinera Test');
  assert.strictEqual(station.address, 'Calle Falsa 123');
  assert.strictEqual(station.municipality, 'Madrid');
  assert.strictEqual(station.province, 'Madrid');
  assert.strictEqual(station.postalCode, '28001');
  assert.strictEqual(station.schedule, '24/7');
  assert.deepStrictEqual(station.services, ['ev_charging', 'shop']);
  assert.deepStrictEqual(station.location.coordinates, [-3.7038, 40.4168]);
  assert.deepStrictEqual(station.connectors, [
    { type: 'iec62196T2', format: 'socket', mode: 'mode3', maxPowerKw: 22, voltageV: 400, maxCurrentA: 32 },
  ]);

  // prices gap: dgt-ev never carries fuel prices
  assert.ok('prices' in station);
  assert.strictEqual(station.prices, undefined);
});

// ---------------------------------------------------------------------------
// bonarea  -> httpClient.post list + httpClient.post detail per station
// ---------------------------------------------------------------------------

test('bonarea fetch() returns the normalized shape and drops non-numeric prices', async () => {
  const listUrl = 'mock://bonarea/list';
  const detailUrl = 'mock://bonarea/detail';

  const detail = {
    id: 'BA-1',
    coordenades: { latitude: '41,6000', longitude: '1,1000' },
    address: {
      street: 'Carrer Test',
      number: '10',
      city: 'Guissona',
      province: 'Lleida',
      postalCode: '25210',
      raoSocial: 'BonArea Guissona',
    },
    serveis: ['Botiga', 'Rentat'],
    preus: ['Gasolina 95: 1,459', 'Gasoil: 1,399', 'AdBlue: N/D'],
    horari: 'L-D: 06:00-22:00',
  };

  const calls = [];
  const httpClient = {
    async post(url, body) {
      calls.push(url);
      if (url === listUrl) return httpResponse([{ id: 'BA-1', tipology: 'BENZINERA' }]);
      if (url === detailUrl) return httpResponse(detail);
      throw new Error(`unexpected bonarea url: ${url}`);
    },
  };

  const collector = bonarea.createBonareaCollector({ httpClient, logger: silentLogger, listUrl, detailUrl });
  const stations = await collector.fetch();

  assert.deepStrictEqual(calls, [listUrl, detailUrl]);
  assert.strictEqual(stations.length, 1);
  const [station] = stations;

  assertNormalizedShape(station, { source: 'bonarea', country: 'ES' });
  assert.strictEqual(station.sourceStationId, 'BA-1');
  assert.strictEqual(station.name, 'BonArea Guissona');
  assert.strictEqual(station.address, 'Carrer Test, 10');
  assert.strictEqual(station.municipality, 'Guissona');
  assert.strictEqual(station.province, 'Lleida');
  assert.strictEqual(station.postalCode, '25210');
  assert.strictEqual(station.schedule, 'L-D: 06:00-22:00');
  assert.deepStrictEqual(station.services, ['Botiga', 'Rentat']);
  assert.deepStrictEqual(station.location.coordinates, [1.1, 41.6]);

  // prices gap: BonArea drops the fuel whose price text has no digits
  assert.strictEqual(station.prices.gasolina95, 1.459);
  assert.strictEqual(station.prices.gasoil, 1.399);
  assert.ok(!('adblue' in station.prices));
});

// ---------------------------------------------------------------------------
// andorra  -> httpClient.get(url, { params }) => { features: [{ attributes, centroid }] }
// ---------------------------------------------------------------------------

test('andorra fetch() returns the normalized shape and drops rows without a price', async () => {
  const attrs = {
    idIPE: 'IPE-1',
    NOM: 'Estacio Andorra',
    Parroquia: 'Andorra la Vella',
    Codi_parroquia: 'AD500',
  };
  const centroid = { x: 1.5211, y: 42.5075 };
  const rows = [
    { attributes: { ...attrs, Tipus_carburant: 'Super 95', PREU: 1.489, DataInici: 1725100000000 }, centroid },
    { attributes: { ...attrs, Tipus_carburant: 'Gasoil', PREU: 1.399, DataInici: 1725000000000 }, centroid },
    // gap: fuel row present in the feed, no price -> dropped
    { attributes: { ...attrs, Tipus_carburant: 'Gasoil B', PREU: null, DataInici: 1725000000000 }, centroid },
  ];

  const calls = [];
  const httpClient = {
    async get(url, config) {
      calls.push({ url, config });
      return httpResponse({ features: rows });
    },
  };

  const collector = andorra.createAndorraCollector({ httpClient, logger: silentLogger, url: 'mock://andorra' });
  const stations = await collector.fetch();

  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].config && calls[0].config.params, 'andorra sends ArcGIS query params');
  assert.strictEqual(stations.length, 1);
  const [station] = stations;

  assertNormalizedShape(station, { source: 'andorra', country: 'AD' });
  assert.strictEqual(station.sourceStationId, 'IPE-1');
  assert.strictEqual(station.name, 'Estacio Andorra');
  assert.strictEqual(station.address, undefined);
  assert.strictEqual(station.municipality, 'Andorra la Vella');
  assert.strictEqual(station.province, 'Andorra');
  assert.strictEqual(station.postalCode, 'AD500');
  assert.strictEqual(station.schedule, undefined);
  assert.strictEqual(station.services, undefined);
  assert.deepStrictEqual(station.location.coordinates, [1.5211, 42.5075]);

  // prices gap: Andorra drops the priceless fuel row
  assert.strictEqual(station.prices.super95, 1.489);
  assert.strictEqual(station.prices.gasoil, 1.399);
  assert.ok(!('gasoilb' in station.prices));
});

// ---------------------------------------------------------------------------
// repsol  -> httpClient.post => { data: { eess: { items: [...] } } }
// ---------------------------------------------------------------------------

test('repsol fetch() returns the normalized shape; a priceless product stays a service only', async () => {
  const rawItem = {
    id: 'R-1',
    nombre: 'E.S. Repsol Test',
    direccion: 'Calle Mayor 5',
    localidad: 'Getafe',
    provincia: 'Madrid',
    cp: '28901',
    x: '-3.7038',
    y: '40.4168',
    horario: 'L-D: 24h',
    productos: [
      { producto: 'Gasolina 95', precio: '1,509', fecha: '2026-09-01' },
      { producto: 'Diesel', precio: '1,419', fecha: '2026-09-02' },
      // gap: product present in the raw payload, no price -> absent from prices
      { producto: 'AdBlue', precio: null, fecha: '2026-09-01' },
    ],
  };

  const calls = [];
  const httpClient = {
    async post(url, data) {
      calls.push({ url, data });
      return httpResponse({ eess: { items: [rawItem] } });
    },
  };

  const collector = repsol.createRepsolCollector({ httpClient, logger: silentLogger, searchUrl: 'mock://repsol/search' });
  const stations = await collector.fetch();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].data, null); // repsol POSTs an empty body, params in the URL
  assert.strictEqual(stations.length, 1);
  const [station] = stations;

  assertNormalizedShape(station, { source: 'repsol', country: 'ES' });
  assert.strictEqual(station.sourceStationId, 'R-1');
  assert.strictEqual(station.name, 'E.S. Repsol Test');
  assert.strictEqual(station.address, 'Calle Mayor 5');
  assert.strictEqual(station.municipality, 'Getafe');
  assert.strictEqual(station.province, 'Madrid');
  assert.strictEqual(station.postalCode, '28901');
  assert.strictEqual(station.schedule, 'L-D: 24h');
  assert.deepStrictEqual(station.services, ['Gasolina 95', 'Diesel', 'AdBlue']);
  assert.deepStrictEqual(station.location.coordinates, [-3.7038, 40.4168]);
  assert.strictEqual(station.lastUpdated.getTime(), Date.parse('2026-09-02'));

  // prices gap: the priceless product is exposed as a service but never as a price
  assert.strictEqual(station.prices.gasolina95, 1.509);
  assert.strictEqual(station.prices.diesel, 1.419);
  assert.ok(!('adblue' in station.prices));
  assert.ok(station.services.includes('AdBlue'));
});
