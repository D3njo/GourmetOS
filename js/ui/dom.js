export function $(sel) {
  return document.querySelector(sel);
}

export function $$(sel) {
  return document.querySelectorAll(sel);
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(text) {
  return escapeHtml(text);
}
