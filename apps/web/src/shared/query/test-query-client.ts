import { createQueryClient } from "./query-client";

export function createTestQueryClient() {
  return createQueryClient({ test: true });
}
