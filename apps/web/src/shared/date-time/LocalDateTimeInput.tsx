import { ActionIcon, Group, Stack, Text } from "@mantine/core";
import { DatePickerInput, TimeInput } from "@mantine/dates";
import { IconCalendar, IconClock, IconX } from "@tabler/icons-react";

import { t } from "../../app/i18n";
import type { LocalDateTimeValue } from "./local-date-time-range";

export function LocalDateTimeInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: LocalDateTimeValue) => void;
  value: LocalDateTimeValue;
}) {
  return (
    <Stack gap={4}>
      <Text fw={500} size="sm">
        {label}
      </Text>
      <Group align="end" gap="xs" grow wrap="nowrap">
        <DatePickerInput
          aria-label={`${label} — ${t("common.date")}`}
          ariaLabels={{
            monthLevelControl: t("monitoring.calendarChooseMonth"),
            nextDecade: t("monitoring.calendarNextDecade"),
            nextMonth: t("monitoring.calendarNextMonth"),
            nextYear: t("monitoring.calendarNextYear"),
            previousDecade: t("monitoring.calendarPreviousDecade"),
            previousMonth: t("monitoring.calendarPreviousMonth"),
            previousYear: t("monitoring.calendarPreviousYear"),
            yearLevelControl: t("monitoring.calendarChooseYear"),
          }}
          clearable
          leftSection={<IconCalendar aria-hidden="true" size={17} />}
          leftSectionPointerEvents="none"
          onChange={(date) => onChange({ ...value, date })}
          placeholder={t("common.date")}
          popoverProps={{ withinPortal: true, zIndex: 1000 }}
          value={value.date}
          valueFormat="YYYY-MM-DD"
        />
        <TimeInput
          aria-label={`${label} — ${t("common.optionalTime")}`}
          leftSection={<IconClock aria-hidden="true" size={17} />}
          leftSectionPointerEvents="none"
          onChange={(event) => onChange({ ...value, time: event.currentTarget.value })}
          placeholder={t("common.optionalTime")}
          rightSection={
            value.time ? (
              <ActionIcon
                aria-label={t("common.clearTime")}
                onClick={() => onChange({ ...value, time: "" })}
                size="sm"
                variant="subtle"
              >
                <IconX aria-hidden="true" size={14} />
              </ActionIcon>
            ) : undefined
          }
          rightSectionPointerEvents={value.time ? "all" : "none"}
          value={value.time}
        />
      </Group>
    </Stack>
  );
}
