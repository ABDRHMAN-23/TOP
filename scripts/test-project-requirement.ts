import assert from 'node:assert/strict';
import { extractProjectRequirement } from '../lib/advisor/project-requirement.ts';

let result = extractProjectRequirement('I need 30m of 22mm copper pipe');
assert.equal(result.requiredQuantity, 30);
assert.equal(result.requiredUnit, 'm');
assert.equal(result.searchQuery, '22mm copper pipe');

result = extractProjectRequirement('Need 10 x 3m rolls of 22mm copper pipe');
assert.equal(result.requiredQuantity, undefined, 'pack expressions should stay in the product query');
assert.match(result.searchQuery, /10 x 3m rolls/i);
assert.match(result.searchQuery, /22mm copper pipe/i);

result = extractProjectRequirement('I need 25kg of cement');
assert.equal(result.requiredQuantity, 25);
assert.equal(result.requiredUnit, 'kg');
assert.equal(result.searchQuery, 'cement');

result = extractProjectRequirement('I need 3m copper pipe');
assert.equal(result.requiredQuantity, 3, 'explicit need + quantity is a project requirement');
assert.equal(result.requiredUnit, 'm');
assert.equal(result.searchQuery, 'copper pipe');

result = extractProjectRequirement('3m copper pipe');
assert.equal(result.requiredQuantity, undefined, 'bare product length must not become project quantity');
assert.equal(result.searchQuery, '3m copper pipe');

result = extractProjectRequirement('15kg adhesive');
assert.equal(result.requiredQuantity, undefined, 'bare product weight must not become project quantity');
assert.equal(result.searchQuery, '15kg adhesive');

result = extractProjectRequirement('30 metres of 22mm copper pipe');
assert.equal(result.requiredQuantity, 30);
assert.equal(result.requiredUnit, 'm');
assert.equal(result.searchQuery, '22mm copper pipe');

result = extractProjectRequirement('buy 12 pcs wall plugs');
assert.equal(result.requiredQuantity, 12);
assert.equal(result.requiredUnit, 'pcs');
assert.equal(result.searchQuery, 'wall plugs');

console.log('Project requirement extraction tests passed.');
