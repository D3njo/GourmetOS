#!/usr/bin/env node
/**
 * Measure parsing and display tests.
 * Run: node scripts/test-measures.js
 */

const path = require('path');
const { pathToFileURL } = require('url');

async function loadEsm(relPath) {
  const full = path.join(__dirname, '..', relPath);
  return import(pathToFileURL(full).href);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { parseMeasure, parseNumericAmount, isNumericAmount } = await loadEsm('js/measure-parse.js');
  const { scaleAmount, formatAmount } = await loadEsm('js/portions.js');
  const { setUnitSystem } = await loadEsm('js/units.js');

  setUnitSystem('metric');

  assert(parseNumericAmount('1/2') === 0.5, '1/2 fraction');
  assert(parseNumericAmount('1 1/2') === 1.5, 'mixed fraction');

  const pinch = parseMeasure('Pinch');
  assert(pinch.amount === 1 && pinch.unit === 'pinch' && pinch.scaleable === false, 'pinch');

  const halfTsp = parseMeasure('1/2 tsp');
  assert(halfTsp.amount === 0.5 && halfTsp.unit === 'tsp', '1/2 tsp');

  const scaled = scaleAmount(pinch.amount, 2, 4, false);
  assert(scaled === 1, 'qualitative not scaled');

  const scaledNum = scaleAmount(200, 2, 4);
  assert(scaledNum === 400, 'numeric scale');

  const fmtPinch = formatAmount(1, 'pinch');
  assert(!fmtPinch.includes('NaN'), `pinch format: ${fmtPinch}`);
  assert(fmtPinch.toLowerCase().includes('pinch') || fmtPinch.toLowerCase().includes('prise'), fmtPinch);

  const fmtHalf = formatAmount(0.5, 'tsp');
  assert(!fmtHalf.includes('NaN'), `half tsp: ${fmtHalf}`);

  const bunch = parseMeasure('Bunch');
  const fmtBunch = formatAmount(bunch.amount, bunch.unit);
  assert(!fmtBunch.includes('NaN'), `bunch: ${fmtBunch}`);

  assert(!isNumericAmount('Pinch'), 'string not numeric');

  console.log('test-measures: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
