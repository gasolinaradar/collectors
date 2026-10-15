<div align="center">

# @gasolinaradar/collectors

**One aggregated npm package that re-exports every official @gasolinaradar fuel station collector.**
**Un único paquete npm agregador que re-exporta todos los collectors oficiales de estaciones de servicio de @gasolinaradar.**

<p align="center">
  <a href="https://www.npmjs.com/package/@gasolinaradar/collectors"><img alt="npm version" src="https://img.shields.io/npm/v/%40gasolinaradar%2Fcollectors.svg"></a>
  <a href="https://www.npmjs.com/package/@gasolinaradar/collectors"><img alt="npm license" src="https://img.shields.io/npm/l/%40gasolinaradar%2Fcollectors.svg"></a>
  <a href="https://nodejs.org"><img alt="node 18+" src="https://img.shields.io/badge/node-18%2B-339933"></a>
  <img alt="tests" src="https://img.shields.io/badge/tests-node%20--test-blue">
  <img alt="built with node" src="https://img.shields.io/badge/built%20with-Node.js-339933">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

</div>

---

## Features / Funcionalidades

**EN**

- **Single dependency** — one `npm install` instead of one per collector. Consumers (like the **GasolinaRadar API**) never have to track eight separate packages.
- **Uniform collector contract** — every collector exposes the same `{ name, country, fetch(context) }` interface and returns stations normalized to a single shape.
- **Cross-source matching** — a pure `matching` module that compares stations from different sources with geo proximity plus name/address similarity (0–100 confidence).
- **Field enrichment** — `enrichStations` fills missing fields of a primary source using matched secondary sources, without overwriting existing data.
- **Thin re-export layer** — this package declares the collectors as dependencies and re-exports them; the individual collectors live in their own repositories and are published independently.

**ES**

- **Una sola dependencia** — un solo `npm install` en lugar de uno por collector. Los consumidores (como la **GasolinaRadar API**) no tienen que seguir ocho paquetes por separado.
- **Contrato de collector uniforme** — todos los collectors exponen la misma interfaz `{ name, country, fetch(context) }` y devuelven estaciones normalizadas a una única forma.
- **Cotejo entre fuentes** — un módulo `matching` puro que compara estaciones de distintas fuentes con proximidad geográfica más similitud de nombre/dirección (confianza de 0 a 100).
- **Enriquecido de campos** — `enrichStations` rellena los campos vacíos de una fuente primaria usando las secundarias que hagan match, sin sobrescribir datos existentes.
- **Capa fina de re-exportación** — este paquete declara los collectors como dependencias y los re-exporta; los collectors individuales viven en sus propios repositorios y se publican de forma independiente.

## Installation / Instalación

```bash
npm install @gasolinaradar/collectors
```

Requires Node.js 18 or newer / Requiere Node.js 18 o superior.

## Quick start / Inicio rápido

```js
const { miterd, dgeg, plenergy, dgtEv, bonarea, andorra, repsol, ocm } = require('@gasolinaradar/collectors');

const miterdCollector = miterd.createMiterdCollector({ logger });
const dgegCollector = dgeg.createDgegCollector({ logger });
const plenergyCollector = plenergy.createPlenergyCollector({ logger });
const dgtEvCollector = dgtEv.createDgtEvCollector({ logger });
const bonareaCollector = bonarea.createBonareaCollector({ logger });
const andorraCollector = andorra.createAndorraCollector({ logger });
const repsolCollector = repsol.createRepsolCollector({ logger });
const ocmCollector = ocm.createOcmCollector({ logger });

const esStations = await miterdCollector.fetch({ reportProgress });
const ptStations = await dgegCollector.fetch({ reportProgress });
const plenergyStations = await plenergyCollector.fetch({ reportProgress });
const dgtEvStations = await dgtEvCollector.fetch({ reportProgress });
const bonareaStations = await bonareaCollector.fetch({ reportProgress });
const andorraStations = await andorraCollector.fetch({ reportProgress });
const repsolStations = await repsolCollector.fetch({ reportProgress });
const ocmStations = await ocmCollector.fetch({ reportProgress });
```

## API

Each collector follows the same contract / Cada collector sigue el mismo contrato:

```js
{ name: 'miterd' | 'dgeg' | 'plenergy' | 'dgt-ev' | 'bonarea' | 'andorra' | 'repsol' | 'ocm', country: 'ES' | 'PT' | 'AD', fetch(context) }
```

## Station contract / Contrato de estación

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

The `matching` module compares normalized stations from different collectors (e.g. a MITERD station branded "PLENERGY" against the Plenergy collector's own stations) using **geographic proximity plus name/address similarity**, and returns a **0–100 confidence score**. It never touches the network or a database — it's a **pure function** over whatever stations you already fetched.

El módulo `matching` compara estaciones normalizadas de distintos collectors (p. ej. una estación de MITERD con rótulo "PLENERGY" frente a las propias estaciones del collector de Plenergy) usando **proximidad geográfica más similitud de nombre/dirección**, y devuelve una **confianza de 0 a 100**. No toca la red ni ninguna base de datos: es una **función pura** sobre las estaciones que ya hayas descargado.

```js
const { miterd, plenergy, matching } = require('@gasolinaradar/collectors');

const miterdStations = await miterd.createMiterdCollector({ logger }).fetch({ reportProgress });
const plenergyStations = await plenergy.createPlenergyCollector({ logger }).fetch({ reportProgress });

const { pairs, groups } = matching.matchStations([...miterdStations, ...plenergyStations]);
// groups: [{ stations: [miterdStation, plenergyStation], confidence: 92 }, ...]
```

If you designate a **primary source** (e.g. `miterd`, the government feed with all stations but only basic data), `enrichStations` fills the primary station's empty fields (`schedule`, `services`, `postalCode`, ...) using the matched secondary stations, **without ever overwriting a field the primary already has** — the primary source is configurable, so you can repoint it to a different collector later without changing your API code:

Si designas una **fuente primaria** (p. ej. `miterd`, la fuente del gobierno con todas las estaciones pero solo datos básicos), `enrichStations` rellena los campos vacíos de la estación primaria (`schedule`, `services`, `postalCode`, ...) usando las estaciones secundarias que hagan match, **sin sobrescribir nunca un campo que la primaria ya tenga** — la fuente primaria es configurable, así que puedes cambiarla por otro collector más adelante sin tocar el código de tu API:

```js
const enrichedStations = matching.enrichStations([...miterdStations, ...plenergyStations], {
  primarySource: 'miterd', // swap to another collector's `source` name later if needed
});
// one entry per miterd station, each with `sources` (which collectors contributed)
// and `matchConfidence` (undefined when no match was found)
```

Both **`minConfidence` (default 70)** and **`maxDistanceMeters` (default 500m)** are configurable via `options` on every function — see `src/matching.js` for the full set of tunables (**`weights`**, **`fillableFields`**).

Tanto **`minConfidence` (por defecto 70)** como **`maxDistanceMeters` (por defecto 500m)** son configurables vía `options` en todas las funciones — consulta `src/matching.js` para el conjunto completo de parámetros ajustables (**`weights`**, **`fillableFields`**).

## Testing / Tests

```bash
npm test
```

Runs the full suite with the built-in Node.js test runner (`node --test`).

Ejecuta la suite completa con el runner de tests integrado de Node.js (`node --test`).

## Ecosystem / Ecosistema

Each collector lives in **its own repository** and is published **independently to npm**. This package only declares them as dependencies and re-exports them. Adding a new collector means publishing it and adding it to the `dependencies` of this package (plus re-exporting it from `src/index.js`). Consumers do **not** need to change their dependency list.

Cada collector vive en **su propio repositorio** y se publica de forma **independiente en npm**. Este paquete solo los declara como dependencias y los re-exporta. Añadir un nuevo collector implica publicarlo y añadirlo a `dependencies` de este paquete (y re-exportarlo desde `src/index.js`). Los consumidores **no** necesitan cambiar su lista de dependencias.

### Included collectors / Collectors incluidos

| Export | Package | npm | Repo | Country / País |
| ------ | ------- | --- | ---- | -------------- |
| `miterd` | `@gasolinaradar/miterd-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/miterd-collector) | [repo](https://github.com/gasolinaradar/miterd-collector) | ES |
| `dgeg` | `@gasolinaradar/dgeg-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/dgeg-collector) | [repo](https://github.com/gasolinaradar/dgeg-collector) | PT |
| `plenergy` | `@gasolinaradar/plenergy-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/plenergy-collector) | [repo](https://github.com/gasolinaradar/plenergy-collector) | ES |
| `dgtEv` | `@gasolinaradar/dgt-ev-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/dgt-ev-collector) | [repo](https://github.com/gasolinaradar/dgt-ev-collector) | ES |
| `bonarea` | `@gasolinaradar/bonarea-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/bonarea-collector) | [repo](https://github.com/gasolinaradar/bonarea-collector) | ES |
| `andorra` | `@gasolinaradar/andorra-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/andorra-collector) | [repo](https://github.com/gasolinaradar/andorra-collector) | AD |
| `repsol` | `@gasolinaradar/repsol-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/repsol-collector) | [repo](https://github.com/gasolinaradar/repsol-collector) | ES |
| `ocm` | `@gasolinaradar/ocm-collector` | [npm](https://www.npmjs.com/package/@gasolinaradar/ocm-collector) | [repo](https://github.com/gasolinaradar/ocm-collector) | ES |

## Publishing / Publicación

Publish the individual collectors first, then this aggregator:

Publica primero los collectors individuales y después este agregador:

```bash
cd ../miterd-collector && npm publish
cd ../dgeg-collector && npm publish
cd ../plenergy-collector && npm publish
cd ../dgt-ev-collector && npm publish
cd ../bonarea-collector && npm publish
cd ../andorra-collector && npm publish
cd ../repsol-collector && npm publish
cd ../ocm-collector && npm publish
cd ../collectors && npm publish
```

## Legal / Legal

Each collector ships its own legal documents. Data belongs to the respective public administrations and is provided "as is".

Cada collector incluye sus propios documentos legales. Los datos pertenecen a las respectivas administraciones públicas y se proporcionan "tal cual".

## License / Licencia

MIT. See [LICENSE](./LICENSE). Individual collectors have their own `LICENSE`.

MIT. Consulta [LICENSE](./LICENSE). Cada collector individual tiene su propio `LICENSE`.
