import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export const COLLECTION_PAGE_SIZES = [50, 100] as const;
export type CollectionPageSize = (typeof COLLECTION_PAGE_SIZES)[number];

export class PaginationQueryDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsIn(COLLECTION_PAGE_SIZES)
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  pageSize: CollectionPageSize = 50;
}

export class SearchPaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export function pageWindow(query: Partial<PaginationQueryDto> = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginated<T>(items: T[], total: number, query: Partial<PaginationQueryDto> = {}) {
  return { items, page: query.page ?? 1, pageSize: query.pageSize ?? 50, total };
}
