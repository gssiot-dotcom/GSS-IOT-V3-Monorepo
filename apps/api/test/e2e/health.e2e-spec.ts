import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";

import { AppModule } from "../../src/app.module";

describe("health e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes a health endpoint", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get("/health").expect(200).expect({
      service: "api",
      status: "ok",
    });
  });
});
