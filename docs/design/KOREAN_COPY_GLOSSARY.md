# GSS IoT V3 — Korean copy glossary

## Canonical product terminology

| English            | Korean         |
| ------------------ | -------------- |
| Dashboard          | 대시보드       |
| Company            | 회사           |
| Company user       | 회사 사용자    |
| Construction site  | 현장           |
| Building           | 건물           |
| Device             | 장치           |
| Gateway            | 게이트웨이     |
| Node               | 노드           |
| Node type          | 노드 유형      |
| Monitoring         | 모니터링       |
| Sensor history     | 센서 이력      |
| Alarm              | 경보           |
| Alarm event        | 경보 이벤트    |
| Alarm rule         | 경보 규칙      |
| Recipient policy   | 수신 정책      |
| Notification       | 알림           |
| Report             | 보고서         |
| Archive Center     | 보관함         |
| Archive            | 보관           |
| Archive evidence   | 보관 증빙 자료 |
| Permanently delete | 영구 삭제      |
| Role               | 역할           |
| Position           | 직책           |
| Permission         | 권한           |
| Audit log          | 감사 로그      |
| Settings           | 설정           |

Do not use `알람`, `통지`, `아카이브`, standalone `회수`, or user-facing `퍼지`.

## Alarm semantics

| Stable field              | Korean UI | Meaning                                                           |
| ------------------------- | --------- | ----------------------------------------------------------------- |
| `requiredOccurrenceCount` | 발생 횟수 | Eligible matching readings required for one trigger cycle         |
| `countIntervalSeconds`    | 집계 간격 | Minimum interval between counted readings, not notification delay |

Each reading belongs to only one highest matching severity. The canonical severity labels are
`정상`, `주의`, `경고`, `위험`, `오프라인`.

## Actions and lifecycle

Use short operator copy: `저장`, `취소`, `삭제`, `수정`, `추가`, `등록`, `적용`, `재시도`,
`다운로드`, `검색`, `필터`, `필터 초기화`.

- Use `등록` for entity onboarding and `추가` for adding to an existing collection.
- Ordinary Company-context Delete is `삭제`; its description explains that the record leaves normal
  operational views while evidence remains in `보관함`.
- Only the GSS Archive Center physical purge action is `영구 삭제`.
- Alarm acknowledgement is `확인 처리`; alarm resolution is `해결 처리`.
- Avoid Korean particles attached directly to interpolated values. Restructure the sentence or use
  a label/value form.

## Stable node-type display

Stored node-type keys and English seed display names are not mutated. UI display maps stable keys:

| Key             | Korean    |
| --------------- | --------- |
| `door_node`     | 도어 노드 |
| `angle_node`    | 각도 노드 |
| `gangform_node` | 갱폼 노드 |

## Language names

Language names are self-names and are never translated: `한국어`, `English`.
