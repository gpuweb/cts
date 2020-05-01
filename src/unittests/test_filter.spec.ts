export const description = `
Unit tests for test_filter .matches() methods.
`;

import {
  SimpleFilterGroup,
  SimpleFilterCase,
} from '../common/framework/test_filter/simple_filter.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

g.test('by group/match').fn(t => {
  t.shouldThrow('Error', () => {
    new SimpleFilterGroup('ab', 'de;f*');
  });
  {
    const f = new SimpleFilterGroup('ab', 'de;f;*');
    t.expect(!f.matches('ab:de;fg:'));
    t.expect(!f.matches('ab:de;fg:*'));
    t.expect(!f.matches('ab:de;fg:x:*'));
    t.expect(!f.matches('ab:de;fg:x:'));
    t.expect(!f.matches('ab:de;fg;:x:*'));
    t.expect(f.matches('ab:de;f;g:x:*'));
  }
});

g.test('by group/exact').fn(t => {
  const f = new SimpleFilterGroup('ab', 'de;fg');
  t.expect(f.matches('ab:de;fg:*'));
  t.expect(f.matches('ab:de;fg:x:*'));
});

g.test('by test/match').fn(t => {
  const f = new SimpleFilterCase('ab', 'de;f', 'xy*');
  t.expect(f.matches('ab:de;f:xy:*'));
  t.expect(f.matches('ab:de;f:xyz:'));
  t.expect(f.matches('ab:de;f:xyz:z=1'));
  t.expect(!f.matches('ab:de;f:'));
  t.expect(!f.matches('ab:de;f:zyx'));
  t.expect(!f.matches('ab:de;f;:xyz:'));
  t.expect(!f.matches('ab:de;f;:xyz:*'));
  t.expect(!f.matches('ab:de;fg:xyz:'));
  t.expect(!f.matches('ab:de;fg:xyz:*'));
});

g.test('by test/exact').fn(t => {
  const f = new SimpleFilterCase('ab', 'de;f', 'xy');
  t.expect(!f.matches('ab:de;f:xy:*'));
  t.expect(f.matches('ab:de;f:xy:'));
});

g.test('by params/match').fn(t => {
  const f = new SimpleFilterCase('ab', 'de;f', 'xy:*');
  t.expect(f.matches('ab:de;f:xy:'));
  t.expect(f.matches('ab:de;f:xy:*'));
  t.expect(f.matches('ab:de;f:xy:z=1'));
  t.expect(f.matches('ab:de;f:xy:z=1;*'));
  t.expect(!f.matches('ab:de;f:'));
  t.expect(!f.matches('ab:de;f:*'));
  t.expect(!f.matches('ab:de;f:xyz:'));
  t.expect(!f.matches('ab:de;f:xyz:*'));
  t.expect(!f.matches('ab:de;f;:xy:'));
  t.expect(!f.matches('ab:de;f;:xy:*'));
});

g.test('by params/exact').fn(t => {
  const f = new SimpleFilterCase('ab', 'de;f', 'xy:');
  t.expect(!f.matches('ab:*'));
  t.expect(!f.matches('ab:de;*'));
  t.expect(!f.matches('ab:de;f:*'));
  t.expect(!f.matches('ab:de;f:'));
  t.expect(!f.matches('ab:de;f:xy;*'));
  t.expect(f.matches('ab:de;f:xy:'));
  t.expect(!f.matches('ab:de;f:xy:*'));
  t.expect(!f.matches('ab:de;f:xy:z=1'));
  t.expect(!f.matches('ab:de;f:xy:z=1;*'));
  t.expect(!f.matches('ab:de;f:xyz:'));
  t.expect(!f.matches('ab:de;f;:xy:'));
});
