import type { NormalizedReportDataset, ReportValue } from "./report-types";

export type ReportLocale = "en-US" | "ko-KR";

const koreanHeaders: Readonly<Record<string, string>> = {
  "ACK latency (ms)": "ACK 지연 시간(ms)",
  "Acknowledged at": "확인 처리 시각",
  "Acknowledged by": "확인 처리자",
  Action: "작업",
  "Active gateway count": "활성 게이트웨이 수",
  "Active user count": "활성 사용자 수",
  "Actor ID": "작업자 ID",
  "Actor type": "작업자 유형",
  "Alarm ID": "경보 ID",
  "Archive reason": "보관 사유",
  "Archived at": "보관 시각",
  "Archived by ID": "보관 처리자 ID",
  "Archived by type": "보관 처리자 유형",
  "Assigned at": "할당 시각",
  "Assignment status": "할당 상태",
  "Audit ID": "감사 로그 ID",
  Building: "건물",
  "Building count": "건물 수",
  "Building ID": "건물 ID",
  "Building number": "건물 번호",
  "Classified status": "분류 상태",
  cmd: "명령 번호",
  "Command ID": "명령 ID",
  "Command type": "명령 유형",
  "Company code": "회사 코드",
  "Company ID": "회사 ID",
  "Company name": "회사명",
  "Created at": "등록 시각",
  "Device ID": "장치 ID",
  "Device kind": "장치 종류",
  Entity: "대상",
  "Entity ID": "대상 ID",
  "Entity type": "대상 유형",
  "Failed at": "실패 시각",
  "Failure reason": "실패 사유",
  "Fault filtered": "오류 필터링 여부",
  "Gateway ID": "게이트웨이 ID",
  "Gateway serial": "게이트웨이 일련번호",
  "Inventory status": "재고 상태",
  "Last seen at": "마지막 수신 시각",
  "Last triggered at": "마지막 발동 시각",
  "Latest node count": "최근 노드 수",
  "Latest sensor values": "최근 센서 값",
  "Latest status": "최근 상태",
  "Measured at": "측정 시각",
  Name: "이름",
  "Node ID": "노드 ID",
  "Node number": "노드 번호",
  "Node type": "노드 유형",
  "Occurrence evidence": "발생 횟수 증빙",
  "Opened at": "발생 시각",
  "Parent-derived": "상위 항목 연계",
  "Reading ID": "수신 데이터 ID",
  "Received at": "수신 시각",
  "Request ID": "요청 ID",
  "Resolved at": "해결 시각",
  "Resolved by": "해결 처리자",
  "Safe new summary": "변경 후 안전 요약",
  "Safe old summary": "변경 전 안전 요약",
  "Safe response summary": "안전 응답 요약",
  Scope: "범위",
  "Sensor values": "센서 값",
  "Sent at": "전송 시각",
  "Serial / node number": "일련번호 / 노드 번호",
  Severity: "심각도",
  "Site count": "현장 수",
  "Site ID": "현장 ID",
  "Site name": "현장명",
  Status: "상태",
  Timestamp: "시각",
  Title: "제목",
  "Unassigned at": "할당 해제 시각",
};

const koreanValues: Readonly<Record<string, string>> = {
  ACKNOWLEDGED: "확인됨",
  ACTIVE: "활성",
  ASSIGNED: "할당됨",
  CAUTION: "주의",
  CANCELLED: "취소됨",
  COMPLETED: "완료",
  DANGER: "위험",
  FAILED: "실패",
  GATEWAY: "게이트웨이",
  INACTIVE: "비활성",
  NODE: "노드",
  OFFLINE: "오프라인",
  ONLINE: "온라인",
  OPEN: "미처리",
  PENDING: "대기",
  PROCESSING: "처리 중",
  RESOLVED: "해결됨",
  SAFE: "정상",
  SENT: "전송됨",
  UNASSIGNED: "미할당",
  WARNING: "경고",
  angle_node: "각도 노드",
  door_node: "도어 노드",
  false: "아니요",
  gangform_node: "갱폼 노드",
  true: "예",
};

export function normalizeReportLocale(value?: string): ReportLocale {
  return value?.toLowerCase().startsWith("en") ? "en-US" : "ko-KR";
}

export function localizeReportDataset(
  dataset: NormalizedReportDataset,
  locale: ReportLocale,
): NormalizedReportDataset {
  if (locale === "en-US") return dataset;
  return {
    columns: dataset.columns.map((column) => ({
      ...column,
      header: koreanHeaders[column.header] ?? column.header,
    })),
    rows: dataset.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, localizeValue(key, value)]),
      ),
    ),
  };
}

function localizeValue(key: string, value: ReportValue): ReportValue {
  if (typeof value === "boolean") return koreanValues[String(value)] ?? value;
  if (typeof value !== "string") return value;
  const semanticKeys = new Set([
    "actorType",
    "assignmentStatus",
    "deviceKind",
    "faultFiltered",
    "lifecycleStatus",
    "nodeType",
    "parentDerived",
    "severity",
    "status",
  ]);
  return semanticKeys.has(key) ? (koreanValues[value] ?? value) : value;
}

export function localizedReportFileName(
  locale: ReportLocale,
  reportType: string,
  id: string,
  extension: string,
): string {
  const prefix = locale === "ko-KR" ? "gss-보고서" : "gss-report";
  return `${prefix}-${reportType.toLowerCase()}-${id}.${extension.toLowerCase()}`;
}

export function attachmentDisposition(fileName: string): string {
  return `attachment; filename="gss-report"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
