# @gasolinaradar/collectors

Aggregated **@gasolinaradar** fuel station collector libraries. This package is published to npm and re-exports every individual collector as a dependency, so consumers (like the **GasolinaRadar API**) only need a single dependency instead of one per collector.

Paquete agregador de las librerías **@gasolinaradar** de colectores de estaciones de servicio. Este paquete se publica en npm y re-exporta cada collector individual como dependencia, de modo que los consumidores (como la **GasolinaRadar API**) solo necesitan una dependencia en lugar de una por collector.

```bash
npm install @gasolinaradar/collectors
```

## Usage / Uso

```js
const { miterd, dgeg, plenergy, dgtEv, bonarea, andorra, repsol } = require('@gasolinaradar/collectors');

const miterdCollector = miterd.createMiterdCollector({ logger });
const dgegCollector = dgeg.createDgegCollector({ logger });
const plenergyCollector = plenergy.createPlenergyCollector({ logger });
const dgtEvCollector = dgtEv.createDgtEvCollector({ logger });
const bonareaCollector = bonarea.createBonareaCollector({ logger });
const andorraCollector = andorra.createAndorraCollector({ logger });
const repsolCollector = repsol.createRepsolCollector({ logger });

const esStations = await miterdCollector.fetch({ reportProgress });
const ptStations = await dgegCollector.fetch({ reportProgress });
const plenergyStations = await plenergyCollector.fetch({ reportProgress });
const dgtEvStations = await dgtEvCollector.fetch({ reportProgress });
const bonareaStations = await bonareaCollector.fetch({ reportProgress });
const andorraStations = await andorraCollector.fetch({ reportProgress });
const repsolStations = await repsolCollector.fetch({ reportProgress });
```

Each collector follows the same contract / Cada collector sigue el mismo contrato:

```js
{ name: 'miterd' | 'dgeg' | 'plenergy' | 'dgt-ev' | 'bonarea' | 'andorra' | 'repsol', country: 'ES' | 'PT' | 'AD', fetch(context) }
```

Every station returned by `fetch()` is normalized to the same shape regardless of source, which is what makes cross-source matching possible:

Cada estación devuelta por `fetch()` está normalizada con la misma forma independientemente de la fuente, lo que es lo que hace posible el cotejo entre fuentes:

```js
{
  source, country, sourceStationId,
  name, address, municipality, province, postalCode,
  schedule, services,
  location: { type: 'Point', coordinates: [lon, lat] },
  prices,
  lastUpdated,
}
```

## Matching stations across sources / Cotejar estaciones entre fuentes

The `matching` module compares normalized stations from different collectors (e.g. a MITERD station branded "PLENERGY" against the Plenergy collector's own stations) using geographic proximity plus name/address similarity, and returns a 0–100 confidence score. It never touches the network or a database — it's a pure function over whatever stations you already fetched.

El módulo `matching` compara estaciones normalizadas de distintos collectors (p. ej. una estación de MITERD con rótulo "PLENERGY" frente a las propias estaciones del collector de Plenergy) usando proximidad geográfica más similitud de nombre/dirección, y devuelve una confianza de 0 a 100. No toca la red ni ninguna base de datos: es una función pura sobre las estaciones que ya hayas descargado.

```js
const { miterd, plenergy, matching } = require('@gasolinaradar/collectors');

const miterdStations = await miterd.createMiterdCollector({ logger }).fetch({ reportProgress });
const plenergyStations = await plenergy.createPlenergyCollector({ logger }).fetch({ reportProgress });

const { pairs, groups } = matching.matchStations([...miterdStations, ...plenergyStations]);
// groups: [{ stations: [miterdStation, plenergyStation], confidence: 92 }, ...]
```

If you designate a **primary source** (e.g. `miterd`, the government feed with all stations but only basic data), `enrichStations` fills the primary station's empty fields (`schedule`, `services`, `postalCode`, ...) using the matched secondary stations, without ever overwriting a field the primary already has — the primary source is configurable, so you can repoint it to a different collector later without changing your API code:

Si designas una **fuente primaria** (p. ej. `miterd`, la fuente del gobierno con todas las estaciones pero solo datos básicos), `enrichStations` rellena los campos vacíos de la estación primaria (`schedule`, `services`, `postalCode`, ...) usando las estaciones secundarias que hagan match, sin sobrescribir nunca un campo que la primaria ya tenga — la fuente primaria es configurable, así que puedes cambiarla por otro collector más adelante sin tocar el código de tu API:

```js
const enrichedStations = matching.enrichStations([...miterdStations, ...plenergyStations], {
  primarySource: 'miterd', // swap to another collector's `source` name later if needed
});
// one entry per miterd station, each with `sources` (which collectors contributed)
// and `matchConfidence` (undefined when no match was found)
```

Both `minConfidence` (default 70) and `maxDistanceMeters` (default 500m) are configurable via `options` on every function — see `src/matching.js` for the full set of tunables (`weights`, `fillableFields`).

## Included collectors / Collectors incluidos

| Export | Package | Repo | Country / País |
| ------ | ------- | ---- | -------------- |
| `miterd` | [`@gasolinaradar/miterd-collector`](https://github.com/gasolinaradar/miterd-collector) | `miterd-collector` | ES |
| `dgeg` | [`@gasolinaradar/dgeg-collector`](https://github.com/gasolinaradar/dgeg-collector) | `dgeg-collector` | PT |
| `plenergy` | [`@gasolinaradar/plenergy-collector`](https://github.com/gasolinaradar/plenergy-collector) | `plenergy-collector` | ES |
| `dgtEv` | [`@gasolinaradar/dgt-ev-collector`](https://github.com/gasolinaradar/dgt-ev-collector) | `dgtEv-collector` | ES |
| `bonarea` | [`@gasolinaradar/bonarea-collector`](https://github.com/gasolinaradar/bonarea-collector) | `bonarea-collector` | ES |
| `andorra` | [`@gasolinaradar/andorra-collector`](https://github.com/gasolinaradar/andorra-collector) | `andorra-collector` | AD |
| `repsol` | [`@gasolinaradar/repsol-collector`](https://github.com/gasolinaradar/repsol-collector) | `repsol-collector` | ES |

Each collector lives in **its own repository** and is published independently to npm. This package only declares them as dependencies and re-exports them. Adding a new collector means publishing it and adding it to the `dependencies` of this package (plus re-exporting it from `src/index.js`). Consumers do **not** need to change their dependency list.

Cada collector vive en **su propio repositorio** y se publica de forma independiente en npm. Este paquete solo los declara como dependencias y los re-exporta. Añadir un nuevo collector implica publicarlo y añadirlo a `dependencies` de este paquete (y re-exportarlo desde `src/index.js`). Los consumidores **no** necesitan cambiar su lista de dependencias.

## Publishing / Publicación

Publish the individual collectors first, then this aggregator:

Publica primero los collectors individuales y después este agregador:

```bash
cd ../miterd-collector && npm publish
cd ../dgeg-collector && npm publish
cd ../plenergy-collector && npm publish
cd ../dgtEv-collector && npm publish
cd ../bonarea-collector && npm publish
cd ../andorra-collector && npm publish
cd ../repsol-collector && npm publish
cd ../collectors && npm publish
```

## Tests

```bash
npm test
```

## Legal / Legal

Each collector ships its own legal documents. Data belongs to the respective public administrations and is provided "as is".

Cada collector incluye sus propios documentos legales. Los datos pertenecen a las respectivas administraciones públicas y se proporcionan "tal cual".

## License / Licencia

MIT. See [LICENSE](./LICENSE). Individual collectors have their own `LICENSE`.
