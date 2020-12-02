export const description = `
TODO:
- Try to map on one thread while mapping {pending, mapped with ArrayBuffer} on another thread
- postMessage a mapped range ArrayBuffer or ArrayBufferView {with, without} transferable
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);
