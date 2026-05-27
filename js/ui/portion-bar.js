import { state } from '../app-state.js';
import { $ } from './dom.js';

/** Show compact portion stepper only when portions matter (recipe details / shopping). */
export function syncPortionBarVisibility() {
  const bar = $('#portion-bar');
  if (!bar) return;

  if (state.view === 'preferences') {
    bar.hidden = true;
    return;
  }

  if (state.view === 'today') {
    const panels = ['#panel-ingredients', '#panel-steps', '#panel-shopping'];
    const anyOpen = panels.some((sel) => $(sel)?.classList.contains('open'));
    bar.hidden = !anyOpen || !state.recipe;
    return;
  }

  if (state.view === 'week') {
    bar.hidden = !$('#panel-shopping-week')?.classList.contains('open');
    return;
  }

  bar.hidden = true;
}
