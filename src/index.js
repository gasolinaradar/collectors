const miterd = require('@gasolinaradar/miterd-collector');
const dgeg = require('@gasolinaradar/dgeg-collector');
const plenergy = require('@gasolinaradar/plenergy-collector');
const dgtEv = require('@gasolinaradar/dgt-ev-collector');
const bonarea = require('@gasolinaradar/bonarea-collector');
const matching = require('./matching');

module.exports = {
  miterd,
  dgeg,
  plenergy,
  dgtEv,
  bonarea,
  matching,
};
