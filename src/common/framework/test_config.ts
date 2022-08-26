export type TestConfig = {
  maxSubcasesInFlight: number;
  testHeartbeatCallback: () => void;
};

export const globalTestConfig: TestConfig = {
  maxSubcasesInFlight: 500,
  testHeartbeatCallback: () => {},
};
