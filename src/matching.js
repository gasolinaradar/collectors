const EARTH_RADIUS_METERS = 6371000;

const DEFAULT_MAX_DISTANCE_METERS = 500;
const DEFAULT_MIN_CONFIDENCE = 70;
const DEFAULT_WEIGHTS = { distance: 0.6, name: 0.25, address: 0.15 };

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function haversineDistanceMeters(coordA, coordB) {
  const [lonA, latA] = coordA;
  const [lonB, latB] = coordB;

  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const radLatA = toRadians(latA);
  const radLatB = toRadians(latB);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const a = sinDLat * sinDLat + Math.cos(radLatA) * Math.cos(radLatB) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function normalizeTextForComparison(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text) {
  const normalized = normalizeTextForComparison(text);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function tokenSetSimilarity(textA, textB) {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionSize += 1;
    }
  }

  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function scoreStationPair(stationA, stationB, options = {}) {
  const maxDistanceMeters = options.maxDistanceMeters ?? DEFAULT_MAX_DISTANCE_METERS;
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };

  const distanceMeters = haversineDistanceMeters(
    stationA.location.coordinates,
    stationB.location.coordinates,
  );

  if (distanceMeters > maxDistanceMeters) {
    return { confidence: 0, distanceMeters, nameSimilarity: 0, addressSimilarity: 0 };
  }

  const distanceScore = clamp01(1 - distanceMeters / maxDistanceMeters);
  const nameSimilarity = tokenSetSimilarity(stationA.name, stationB.name);
  const addressSimilarity = tokenSetSimilarity(stationA.address, stationB.address);

  const weightSum = weights.distance + weights.name + weights.address;
  const rawScore =
    (weights.distance * distanceScore +
      weights.name * nameSimilarity +
      weights.address * addressSimilarity) /
    weightSum;

  return {
    confidence: Math.round(clamp01(rawScore) * 100),
    distanceMeters,
    nameSimilarity,
    addressSimilarity,
  };
}

function findRoot(parents, node) {
  let root = node;
  while (parents.get(root) !== root) {
    root = parents.get(root);
  }

  let current = node;
  while (parents.get(current) !== root) {
    const next = parents.get(current);
    parents.set(current, root);
    current = next;
  }

  return root;
}

function union(parents, nodeA, nodeB) {
  const rootA = findRoot(parents, nodeA);
  const rootB = findRoot(parents, nodeB);
  if (rootA !== rootB) {
    parents.set(rootA, rootB);
  }
}

function stationKey(station, index) {
  return `${station.source}:${station.sourceStationId || index}`;
}

function matchStations(stations, options = {}) {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const keyByStation = new Map();
  stations.forEach((station, index) => {
    keyByStation.set(station, stationKey(station, index));
  });

  const pairs = [];
  for (let i = 0; i < stations.length; i += 1) {
    for (let j = i + 1; j < stations.length; j += 1) {
      const a = stations[i];
      const b = stations[j];
      if (a.source === b.source) {
        continue;
      }

      const score = scoreStationPair(a, b, options);
      if (score.confidence >= minConfidence) {
        pairs.push({ a, b, ...score });
      }
    }
  }

  pairs.sort((pairA, pairB) => pairB.confidence - pairA.confidence);

  const parents = new Map();
  keyByStation.forEach((key) => parents.set(key, key));
  pairs.forEach(({ a, b }) => union(parents, keyByStation.get(a), keyByStation.get(b)));

  const groupsByRoot = new Map();
  keyByStation.forEach((key, station) => {
    const root = findRoot(parents, key);
    if (!groupsByRoot.has(root)) {
      groupsByRoot.set(root, []);
    }
    groupsByRoot.get(root).push(station);
  });

  const groups = Array.from(groupsByRoot.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const groupKeys = new Set(group.map((station) => keyByStation.get(station)));
      const groupPairs = pairs.filter(
        (pair) =>
          groupKeys.has(keyByStation.get(pair.a)) && groupKeys.has(keyByStation.get(pair.b)),
      );
      const confidence = Math.min(...groupPairs.map((pair) => pair.confidence));
      return { stations: group, confidence };
    });

  return { pairs, groups };
}

const DEFAULT_FILLABLE_FIELDS = [
  'address',
  'municipality',
  'province',
  'postalCode',
  'schedule',
  'services',
  'prices',
];

function isEmptyValue(value) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

function toSourceRef(station) {
  return { source: station.source, sourceStationId: station.sourceStationId };
}

function enrichPrimaryStation(primaryStation, matchedStations, options = {}) {
  const fillableFields = options.fillableFields ?? DEFAULT_FILLABLE_FIELDS;

  const enriched = matchedStations.reduce((filled, secondaryStation) => {
    const next = { ...filled };
    fillableFields.forEach((field) => {
      if (isEmptyValue(next[field]) && !isEmptyValue(secondaryStation[field])) {
        next[field] = secondaryStation[field];
      }
    });
    return next;
  }, primaryStation);

  return {
    ...enriched,
    sources: [primaryStation, ...matchedStations].map(toSourceRef),
  };
}

function enrichStations(stations, options = {}) {
  const primarySource = options.primarySource;
  if (!primarySource) {
    throw new Error('enrichStations requires options.primarySource');
  }

  const { groups } = matchStations(stations, options);

  const enrichedByPrimary = new Map();
  groups.forEach((group) => {
    const primaryStation = group.stations.find((station) => station.source === primarySource);
    if (!primaryStation || enrichedByPrimary.has(primaryStation)) {
      return;
    }

    const matchedStations = group.stations.filter((station) => station !== primaryStation);
    const enriched = enrichPrimaryStation(primaryStation, matchedStations, options);
    enrichedByPrimary.set(primaryStation, { ...enriched, matchConfidence: group.confidence });
  });

  return stations
    .filter((station) => station.source === primarySource)
    .map(
      (station) =>
        enrichedByPrimary.get(station) ?? {
          ...station,
          sources: [toSourceRef(station)],
          matchConfidence: undefined,
        },
    );
}

module.exports = {
  haversineDistanceMeters,
  normalizeTextForComparison,
  tokenSetSimilarity,
  scoreStationPair,
  matchStations,
  enrichPrimaryStation,
  enrichStations,
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_WEIGHTS,
  DEFAULT_FILLABLE_FIELDS,
};
