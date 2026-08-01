# @gasolinaradar/collectors

Aggregated **@gasolinaradar** fuel station collector libraries. This package is published to npm and re-exports every individual collector as a dependency, so consumers (like the **GasolinaRadar API**) only need a single dependency instead of one per collector.

Paquete agregador de las librerías **@gasolinaradar** de colectores de estaciones de servicio. Este paquete se publica en npm y re-exporta cada collector individual como dependencia, de modo que los consumidores (como la **GasolinaRadar API**) solo necesitan una dependencia en lugar de una por collector.

```bash
npm install @gasolinaradar/collectors
```

## Usage / Uso

```js
const { miterd, dgeg, plenergy, dgtEv } = require('@gasolinaradar/collectors');

const miterdCollector = miterd.createMiterdCollector({ logger });
const dgegCollector = dgeg.createDgegCollector({ logger });
const plenergyCollector = plenergy.createPlenergyCollector({ logger });
const dgtEvCollector = dgtEv.createDgtEvCollector({ logger });

const esStations = await miterdCollector.fetch({ reportProgress });
const ptStations = await dgegCollector.fetch({ reportProgress });
const plenergyStations = await plenergyCollector.fetch({ reportProgress });
const dgtEvStations = await dgtEvCollector.fetch({ reportProgress });
```

Each collector follows the same contract / Cada collector sigue el mismo contrato:

```js
{ name: 'miterd' | 'dgeg' | 'plenergy' | 'dgt-ev', country: 'ES' | 'PT', fetch(context) }
```

## Included collectors / Collectors incluidos

| Export | Package | Repo | Country / País |
| ------ | ------- | ---- | -------------- |
| `miterd` | [`@gasolinaradar/miterd-collector`](https://github.com/gasolinaradar/miterd-collector) | `miterd-collector` | ES |
| `dgeg` | [`@gasolinaradar/dgeg-collector`](https://github.com/gasolinaradar/dgeg-collector) | `dgeg-collector` | PT |
| `plenergy` | [`@gasolinaradar/plenergy-collector`](https://github.com/gasolinaradar/plenergy-collector) | `plenergy-collector` | ES |
| `dgtEv` | [`@gasolinaradar/dgt-ev-collector`](https://github.com/gasolinaradar/dgt-ev-collector) | `dgtEv-collector` | ES |

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
