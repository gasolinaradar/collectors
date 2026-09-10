const miterd = require('@gasolinaradar/miterd-collector');
const dgeg = require('@gasolinaradar/dgeg-collector');
const plenergy = require('@gasolinaradar/plenergy-collector');
const dgtEv = require('@gasolinaradar/dgt-ev-collector');
const bonarea = require('@gasolinaradar/bonarea-collector');
const andorra = require('@gasolinaradar/andorra-collector');
const repsol = require('@gasolinaradar/repsol-collector');
const ocm = require('@gasolinaradar/ocm-collector');
const miteco = require('@gasolinaradar/miteco-collector');
const matching = require('./matching');

module.exports = {
  miterd,
  dgeg,
  plenergy,
  dgtEv,
  bonarea,
  andorra,
  repsol,
  ocm,
  miteco,
  matching,
};
