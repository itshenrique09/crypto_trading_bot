export interface LiveConnectionTest {
  ok: boolean;
  balance?: number;
  error?: string;
}

export function validateLiveStartConnection(test: LiveConnectionTest): void {
  if (!test.ok) {
    throw new Error(`Cannot start live engine: MEXC connection test failed${test.error ? ` (${test.error})` : ""}`);
  }
}
