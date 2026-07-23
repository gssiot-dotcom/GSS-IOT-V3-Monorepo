import { Group, Pagination, Select, Skeleton, Table, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  align?: "left" | "center" | "right";
  width?: number | string;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: string) => void;
  pageSizeOptions?: string[];
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && Boolean(target.closest("button, a, input, textarea, select"))
  );
}

export function DataTable<Row extends { id: string }>({
  ariaLabel,
  caption,
  columns,
  density = "comfortable",
  loading = false,
  onRowClick,
  rowAriaLabel,
  rows,
  skeletonRows = 5,
  pagination,
}: {
  ariaLabel?: string;
  caption?: ReactNode;
  columns: DataTableColumn<Row>[];
  density?: "compact" | "comfortable";
  loading?: boolean;
  onRowClick?: (row: Row) => void;
  rowAriaLabel?: (row: Row) => string;
  rows: Row[];
  skeletonRows?: number;
  pagination?: DataTablePagination;
}) {
  const rowCount = loading ? skeletonRows : rows.length;
  return (
    <Table.ScrollContainer minWidth={640} type="native">
      <Table
        aria-label={ariaLabel}
        className={`gss-data-table gss-data-table-${density}`}
        highlightOnHover
        striped
      >
        {caption ? <Table.Caption>{caption}</Table.Caption> : null}
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.key} style={{ textAlign: column.align, width: column.width }}>
                {column.label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading
            ? Array.from({ length: rowCount }, (_, index) => (
                <Table.Tr aria-busy="true" key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <Table.Td key={column.key}>
                      <Skeleton height={density === "compact" ? 14 : 18} />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            : rows.map((row) => (
                <Table.Tr
                  aria-label={rowAriaLabel?.(row)}
                  className={onRowClick ? "gss-data-table-row-navigable" : undefined}
                  key={row.id}
                  onClick={(event) => {
                    if (onRowClick && !isInteractiveTarget(event.target)) onRowClick(row);
                  }}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((column) => (
                    <Table.Td key={column.key} style={{ textAlign: column.align }}>
                      {column.render(row)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
        </Table.Tbody>
      </Table>
      {pagination ? (
        <TablePaginationFooter
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          page={pagination.page}
          pageSize={pagination.pageSize}
          pageSizeLabel={ariaLabel ?? "Rows per page"}
          pageSizeOptions={pagination.pageSizeOptions}
          rangeLabel={
            pagination.total === 0
              ? "0-0 of 0"
              : `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`
          }
          totalPages={Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
        />
      ) : null}
    </Table.ScrollContainer>
  );
}

export function TablePaginationFooter({
  page = 1,
  pageSize,
  pageSizeLabel,
  rangeLabel,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ["10", "25", "50"],
}: {
  page?: number;
  pageSize: string | number;
  pageSizeLabel: string;
  rangeLabel: string;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: string) => void;
  pageSizeOptions?: string[];
}) {
  return (
    <Group className="gss-table-pagination" justify="space-between" mt="md" wrap="wrap">
      <Text c="dimmed" size="sm">
        {rangeLabel}
      </Text>
      <Group gap="sm">
        <Select
          aria-label={pageSizeLabel}
          data={pageSizeOptions}
          onChange={(value) => value && onPageSizeChange?.(value)}
          size="xs"
          value={String(pageSize)}
          w={92}
        />
        {onPageChange ? (
          <Pagination onChange={onPageChange} size="sm" total={totalPages} value={page} />
        ) : null}
      </Group>
    </Group>
  );
}
