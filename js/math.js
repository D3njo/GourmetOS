/** Shared numeric helpers */

export function cleanFloat(value) {
  if (Number.isInteger(value) || value >= 100) {
    return Math.round(value);
  }
  if (value >= 10) {
    return Math.round(value * 10) / 10;
  }
  if (value >= 1) {
    return Math.round(value * 100) / 100;
  }
  return Math.round(value * 1000) / 1000;
}
