import { Group, Select, Table, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

export function DataTable<Row extends { id: string }>({
  ariaLabel,
  caption,
  columns,
  rows,
}: {
  ariaLabel?: string;
  caption?: ReactNode;
  columns: DataTableColumn<Row>[];
  rows: Row[];
}) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table className="gss-data-table" aria-label={ariaLabel} highlightOnHover striped verticalSpacing="sm">
        {caption ? <Table.Caption>{caption}</Table.Caption> : null}
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.key}>{column.label}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              {columns.map((column) => (
                <Table.Td key={column.key}>{column.render(row)}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function TablePaginationFooter({
  pageSize,
  pageSizeLabel,
  rangeLabel,
}: {
  pageSize: string;
  pageSizeLabel: string;
  rangeLabel: string;
}) {
  return (
    <Group justify="space-between" mt="md">
      <Text c="dimmed" size="sm">
        {rangeLabel}
      </Text>
      <Select
        aria-label={pageSizeLabel}
        data={["10", "25", "50"]}
        size="xs"
        value={pageSize}
        w={88}
      />
    </Group>
  );
}
