// 손으로 쓴 타입. 나중에 `supabase gen types typescript`로 생성한 정식 타입으로 교체 권장.

export interface Family {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
}

export type ProfileRole = "parent" | "child";

export interface Profile {
  id: string;
  family_id: string;
  user_id: string | null;
  role: ProfileRole;
  name: string;
  avatar: string;
  pin_hash: string | null;
  pin_fail_count: number;
  pin_locked_until: string | null;
  created_at: string;
}

export type RecordSourceType = "conversation" | "ocr" | "manual";
export type DokseoroStatus = "pending" | "synced" | "failed";

export interface ReadingRecord {
  id: string;
  family_id: string;
  child_profile_id: string;
  book_title: string;
  book_author: string | null;
  source_type: RecordSourceType;
  content: string;
  source_ref_id: string | null;
  recorded_at: string;
  dokseoro_status: DokseoroStatus;
  created_at: string;
  updated_at: string;
}

export type ConversationStatus = "in_progress" | "completed";

export type ReadingCoachStage = 1 | 2 | 3;

export interface ConversationMessage {
  role: "assistant" | "child";
  content: string;
  created_at: string;
  // assistant(질문) 메시지에만 붙는다 — 단계별 독서록 유도 질문 프레임워크(1:장면 소환,
  // 2:역할 바꾸기, 3:현실 적용)에서 이 질문이 어느 단계인지. 감상문 조립 시 어떤 답변이
  // 어느 단락(처음/가운데/끝)에 들어가야 하는지 판별하는 데 쓴다.
  stage?: ReadingCoachStage;
}

export interface ConversationSession {
  id: string;
  family_id: string;
  child_profile_id: string;
  book_title: string;
  book_author: string | null;
  messages: ConversationMessage[];
  status: ConversationStatus;
  created_at: string;
}

export type OcrStatus = "pending" | "processed" | "failed";

export interface OcrUpload {
  id: string;
  family_id: string;
  child_profile_id: string;
  image_path: string;
  raw_text: string | null;
  parsed_result: Record<string, unknown> | null;
  status: OcrStatus;
  created_at: string;
}
