import { TestQueryWithExpectation } from '../internal/query/query.js';

export type ExecutionContext = {
  expectations: TestQueryWithExpectation[];
  parallelSubcases: boolean;
};
