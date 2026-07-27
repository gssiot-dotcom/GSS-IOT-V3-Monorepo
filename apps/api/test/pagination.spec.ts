import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import {
  PaginationQueryDto,
  SearchPaginationQueryDto,
  pageWindow,
  paginated,
} from "../src/common/dto/pagination.dto";

describe("collection pagination contract", () => {
  it("defaults to the first 50 records and returns the shared response envelope", async () => {
    const query = plainToInstance(PaginationQueryDto, {});

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ page: 1, pageSize: 50 });
    expect(pageWindow(query)).toEqual({ skip: 0, take: 50 });
    expect(paginated([{ id: "record-1" }], 1, query)).toEqual({
      items: [{ id: "record-1" }],
      page: 1,
      pageSize: 50,
      total: 1,
    });
  });

  it("accepts 100, transforms query strings, and produces a stable page window", async () => {
    const query = plainToInstance(SearchPaginationQueryDto, {
      page: "3",
      pageSize: "100",
      search: "gateway",
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ page: 3, pageSize: 100, search: "gateway" });
    expect(pageWindow(query)).toEqual({ skip: 200, take: 100 });
  });

  it.each([1, 25, 49, 51, 500])("rejects unsupported page size %s", async (pageSize) => {
    const query = plainToInstance(PaginationQueryDto, { pageSize });
    const errors = await validate(query);

    expect(errors.some((error) => error.property === "pageSize")).toBe(true);
  });
});
