import { useEffect, useMemo, useState } from "react";

export type NodeHistoryMode = "DAY" | "HOUR";
export type NodeHistoryHours = 1 | 12 | 24;

export interface NodeHistoryRange {
  from: string;
  to: string;
}

export function useNodeHistoryRange(activeNodeId?: string) {
  const [mode, setModeState] = useState<NodeHistoryMode>("HOUR");
  const [hours, setHoursState] = useState<NodeHistoryHours>(12);
  const [date, setDateState] = useState(todayInputValue());
  const [anchor, setAnchor] = useState(() => new Date());

  useEffect(() => {
    if (activeNodeId) setAnchor(new Date());
  }, [activeNodeId]);

  const range = useMemo(
    () => (mode === "HOUR" ? hourRange(hours, anchor) : localDayRange(date)),
    [anchor, date, hours, mode],
  );

  return {
    date,
    hours,
    maxDate: todayInputValue(),
    mode,
    range,
    setDate(value: string) {
      setDateState(value);
      setAnchor(new Date());
    },
    setHours(value: NodeHistoryHours) {
      setHoursState(value);
      setAnchor(new Date());
    },
    setMode(value: NodeHistoryMode) {
      setModeState(value);
      setAnchor(new Date());
    },
  };
}

export function hourRange(hours: NodeHistoryHours, now = new Date()): NodeHistoryRange {
  return {
    from: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
    to: now.toISOString(),
  };
}

export function localDayRange(dateValue: string): NodeHistoryRange {
  const [year, month, day] = dateValue.split("-").map(Number);
  const from = new Date(year!, month! - 1, day!);
  const to = new Date(year!, month! - 1, day! + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function todayInputValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
