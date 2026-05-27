#!/usr/bin/env node
/**
 * Adds fineDiningMeta, editorial metadata, and richer descriptions to top premium catalog seeds.
 * Run: node scripts/curate-premium-catalog.js
 */

const fs = require('fs');
const path = require('path');
const {
  enrichEditorialFields,
  ensureDescription
} = require('./lib/editorial-inference.cjs');

const ROOT = path.join(__dirname, '..');
const catalogPath = path.join(ROOT, 'data/recipe-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const STYLE_BY_TECHNIQUE = {
  'Pastry & Roast': 'haute-cuisine',
  'Braise & Red Wine': 'haute-cuisine',
  'Poach & Emulsion': 'fine-dining',
  'Grill & Smoke': 'modern',
  'Sous-vide & Glaze': 'haute-cuisine',
  'Pasta & Cream': 'classic',
  'Seafood & Butter': 'fine-dining'
};

let updated = 0;
const meals = (catalog.meals || [])
  .sort((a, b) => (b.rating || 0) - (a.rating || 0))
  .map((meal, index) => {
    const next = { ...meal };
    const isTop = index < 50;

    if (isTop && !next.fineDiningMeta) {
      next.fineDiningMeta = {
        style: STYLE_BY_TECHNIQUE[next.technique_en] || 'haute-cuisine',
        service: index < 20 ? 'tasting-menu' : 'a-la-carte'
      };
      updated++;
    }

    const context = {
      weatherTag: next.weather_primary || 'mild',
      effortLevel: next.effort || 'medium'
    };

    const editorial = enrichEditorialFields(
      {
        ...next,
        name: next.name_en || next.name,
        technique: next.technique_en || next.technique,
        effort: next.effort || 'medium',
        weather_primary: next.weather_primary || 'mild',
        fineDiningMeta: next.fineDiningMeta
      },
      context
    );

    if (isTop) {
      const description = ensureDescription(
        {
          ...next,
          name: next.name_en || next.name,
          description: next.description_en,
          description_en: next.description_en
        },
        context
      );

      if (next.description_en !== description) {
        next.description_en = description;
        updated++;
      }

      for (const field of [
        'taste_profile',
        'why_this_works',
        'chef_move',
        'occasion',
        'skill_focus',
        'mise_en_place',
        'weather_mood'
      ]) {
        if (!next[field] && editorial[field]) {
          next[field] = editorial[field];
          updated++;
        }
      }

      if (!next.technique_en && editorial.technique) {
        next.technique_en = editorial.technique;
        updated++;
      }
    }

    return next;
  });

catalog.meals = meals;
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`Curated premium catalog: ${updated} field updates across top 50 seeds.`);
