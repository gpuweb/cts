export const description = `
Test for "pp" preprocessor.
`;

import { pp } from '../common/framework/preprocessor2.js';
import { makeTestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

class F extends UnitTest {
  test(act: string, exp: string): void {
    this.expect(act === exp, 'got: ' + act.replace('\n', '⏎'));
  }
}

export const g = makeTestGroup(F);

g.test('empty').fn(t => {
  t.test(pp``, '');
  t.test(pp`\n`, '\n');
  t.test(pp`\n\n`, '\n\n');
});

g.test('plain').fn(t => {
  t.test(pp`\na`, '\na');
  t.test(pp`\n\na`, '\n\na');
  t.test(pp`\na\n`, '\na\n');
  t.test(pp`\na\n\n`, '\na\n\n');
});

g.test('substitutions,1').fn(t => {
  const act = pp`a ${3} b`;
  const exp = 'a 3 b';
  t.test(act, exp);
});

g.test('substitutions,2').fn(t => {
  const act = pp`a ${'x'}`;
  const exp = 'a x';
  t.test(act, exp);
});

g.test('substitutions,3').fn(t => {
  const act = pp`a ${'x'} b`;
  const exp = 'a x b';
  t.test(act, exp);
});

g.test('substitutions,4').fn(t => {
  const act = pp`
a
${pp.if(false)}
${'x'}
${pp.endif}
b`;
  const exp = '\na\n\nb';
  t.test(act, exp);
});

g.test('if,true').fn(t => {
  const act = pp`
a
${pp.if(true)}c${pp.endif}
d
`;
  const exp = '\na\nc\nd\n';
  t.test(act, exp);
});

g.test('if,false').fn(t => {
  const act = pp`
a
${pp.if(false)}c${pp.endif}
d
`;
  const exp = '\na\n\nd\n';
  t.test(act, exp);
});

g.test('else,1').fn(t => {
  const act = pp`
a
${pp.if(true)}
b
${pp.else}
c
${pp.endif}
d
`;
  const exp = '\na\n\nb\n\nd\n';
  t.test(act, exp);
});

g.test('else,2').fn(t => {
  const act = pp`
a
${pp.if(false)}
b
${pp.else}
c
${pp.endif}
d
`;
  const exp = '\na\n\nc\n\nd\n';
  t.test(act, exp);
});

g.test('else,3').fn(t => {
  const act = pp`
a
${pp.if(false)}
b
${pp.else}
c
${pp.else}
e
${pp.endif}
d
`;
  const exp = '\na\n\nc\n\nd\n';
  t.test(act, exp);
});

g.test('elif,1').fn(t => {
  const act = pp`
a
${pp.if(false)}
b
${pp.elif(true)}
e
${pp.else}
c
${pp.endif}
d
`;
  const exp = '\na\n\ne\n\nd\n';
  t.test(act, exp);
});

g.test('elif,2').fn(t => {
  const act = pp`
a
${pp.if(true)}
b
${pp.elif(true)}
e
${pp.else}
c
${pp.endif}
d
`;
  const exp = '\na\n\nb\n\nd\n';
  t.test(act, exp);
});

g.test('nested,1').fn(t => {
  const act = pp`
a
${pp.if(false)}
b
${pp.if(true)}
e
${pp.endif}
c
${pp.endif}
d
`;
  const exp = '\na\n\nd\n';
  t.test(act, exp);
});

g.test('nested,2').fn(t => {
  const act = pp`
a
${pp.if(false)}
b
${pp.else}
h
${pp.if(false)}
e
${pp.elif(true)}
f
${pp.else}
g
${pp.endif}
c
${pp.endif}
d
`;
  const exp = '\na\n\nh\n\nf\n\nc\n\nd\n';
  t.test(act, exp);
});

g.test('errors,pass').fn(() => {
  pp`${pp.if(true)}${pp.endif}`;
  pp`${pp.if(true)}${pp.else}${pp.endif}`;
  pp`${pp.if(true)}${pp.if(true)}${pp.endif}${pp.endif}`;
  pp`${pp.if(true)}${pp.if(true)}${pp.else}${pp.else}${pp.endif}${pp.endif}`;
});

g.test('errors,fail').fn(t => {
  const e = (fn: () => void) => t.shouldThrow('Error', fn);
  e(() => pp`${pp.if(true)}`);
  e(() => pp`${pp.elif(true)}`);
  e(() => pp`${pp.else}`);
  e(() => pp`${pp.endif}`);
  e(() => pp`${pp.if(true)}${pp.elif(true)}`);
  e(() => pp`${pp.if(true)}${pp.elif(true)}${pp.else}`);
  e(() => pp`${pp.if(true)}${pp.else}`);
  e(() => pp`${pp.else}${pp.endif}`);
});
