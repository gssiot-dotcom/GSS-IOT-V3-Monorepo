import { Group, Pagination, Select, Skeleton, Table, Text } from "@mantine/core";
import { Fragment, type ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  align?: "left" | "center" | "right";
  width?: number | string;
}

export interface DataTablePagination {
  page: number;
  pageSize: 50 | 100;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: string) => void;
  pageSizeLabel: string;
  rangeLabel: string;
  pageSizeOptions?: Array<50 | 100>;
}

const interactiveSelector =
  'button, a, input, textarea, select, [role="button"], [role="menuitem"], [data-row-action]';

export function isInteractiveTarget(
  target: EventTarget | null,
  activationRoot?: Element | null,
): boolean {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(interactiveSelector);
  return Boolean(interactive && interactive !== activationRoot);
}

export function DataTable<Row extends { id: string }>({
  ariaLabel,
  caption,
  columns,
  density = "comfortable",
  loading = false,
  isRowSelected,
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
  isRowSelected?: (row: Row) => boolean;
  onRowClick?: (row: Row) => void;
  rowAriaLabel?: (row: Row) => string;
  rows: Row[];
  skeletonRows?: number;
  pagination?: DataTablePagination;
}) {
  const rowCount = loading ? skeletonRows : rows.length;
  return (
    <Fragment>
      {pagination ? (
        <CollectionPagination
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          page={pagination.page}
          pageSize={pagination.pageSize}
          pageSizeLabel={pagination.pageSizeLabel}
          pageSizeOptions={pagination.pageSizeOptions}
          rangeLabel={pagination.rangeLabel}
          totalPages={Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
        />
      ) : null}
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
                    aria-selected={isRowSelected?.(row) || undefined}
                    className={onRowClick ? "gss-data-table-row-navigable" : undefined}
                    data-selected={isRowSelected?.(row) || undefined}
                    key={row.id}
                    onClick={(event) => {
                      if (onRowClick && !isInteractiveTarget(event.target, event.currentTarget)) {
                        onRowClick(row);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        onRowClick &&
                        !isInteractiveTarget(event.target, event.currentTarget) &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
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
      </Table.ScrollContainer>
    </Fragment>
  );
}

export function CollectionPagination({
  actions,
  page = 1,
  pageSize,
  pageSizeLabel,
  rangeLabel,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100],
}: {
  actions?: ReactNode;
  page?: number;
  pageSize: 50 | 100;
  pageSizeLabel: string;
  rangeLabel: string;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: string) => void;
  pageSizeOptions?: Array<50 | 100>;
}) {
  return (
    <Group className="gss-collection-pagination" justify="space-between" mb="sm" wrap="wrap">
      <Group gap="sm" wrap="wrap">
        {actions}
        <Text c="dimmed" size="sm">
          {rangeLabel}
        </Text>
      </Group>
      <Group gap="sm">
        <Select
          aria-label={pageSizeLabel}
          data={pageSizeOptions.map(String)}
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

export const TablePaginationFooter = CollectionPagination;
