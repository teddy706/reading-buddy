import "server-only";
import { AzureOpenAI } from "openai/azure";
import type { ConversationMessage, ReadingCoachStage } from "@/lib/types";
import { fallbackQuestion, stageForQuestionIndex } from "@/lib/readingSession";

// 단계별 독서록 유도 질문 프레임워크(사용자 설계)의 단계별 지침. generateNextQuestion이
// questionIndex 대신 이 단계 정보로 시스템 프롬프트를 분기한다.
const STAGE_INSTRUCTIONS: Record<ReadingCoachStage, string> = {
  1: [
    "지금은 1단계 '장면 소환' 단계다 — 아이가 책을 실제로 읽었는지 자연스럽게 확인하면서 줄거리를 이끌어낸다.",
    "아직 '가장 큰 사건/문제'를 묻지 않았다면 그것부터 묻고, 이미 물어서 답을 들었다면 '주인공이 그 문제를 풀려고 어떤 행동을 했는지' 이어서 묻는다.",
  ].join("\n"),
  2: [
    "지금은 2단계 '역할 바꾸기' 단계다 — 아이가 인물의 마음이나 동기에 공감하고 입체적으로 생각해보게 한다.",
    "예: 주인공이 그런 결정을 했을 때 마음이 어땠을지, 또는 아이 자신이라면 그 상황에서 어떻게 했을지 묻는다.",
  ].join("\n"),
  3: [
    "지금은 3단계 '현실 적용' 단계이자 마지막 질문이다 — 책의 메시지를 아이의 실제 생활/경험과 연결지어 마무리한다.",
    "예: 비슷한 경험이 떠오르는지, 가장 인상 깊었던 장면 하나를 고른다면 무엇이고 왜 그런지 묻는다.",
  ].join("\n"),
};

// 질문 생성(저지연 경량 모델)과 감상문 생성(상위 품질 모델)은 서로 다른 배포를 쓴다(PRD 6.5).
// 두 모델 다 max_completion_tokens를 쓴다 — gpt-4o-mini 이후 세대 모델은 max_tokens를 거부한다
// (400 unsupported_parameter). gpt-4o는 둘 다 허용하므로 굳이 분기하지 않고 통일한다.

let client: AzureOpenAI | null = null;
function getClient() {
  if (!client) {
    client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    });
  }
  return client;
}

function toChatMessages(history: ConversationMessage[]) {
  return history.map((m) => ({
    role: (m.role === "child" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));
}

// 아이의 직전 답변을 참고해 다음 질문을 만든다. 단계별 독서록 유도 질문 프레임워크에 따라
// questionIndex가 아니라 stage(1 장면 소환/2 역할 바꾸기/3 현실 적용)로 질문의 성격을 분기한다.
// API 호출 자체가 실패하는 경우와 응답은 왔지만 tool call이 비어있는/잘못된 경우 둘 다
// 똑같이 stage에 맞는 고정 폴백 질문으로 수렴한다(PRD 9.5 폴백 원칙) — 실패 경로마다 다른
// 문구가 나가면 "단계별 프레임워크를 항상 유지한다"는 설계 의도가 깨지므로, 호출부가 별도
// 폴백 문구를 준비할 필요 없이 이 함수가 절대 null을 반환하지 않도록 통일한다.
export async function generateNextQuestion(params: {
  bookTitle: string;
  bookAuthor: string | null;
  bookContext: string | null;
  history: ConversationMessage[];
  questionIndex: number;
  stage: ReadingCoachStage;
}): Promise<string> {
  const { bookTitle, bookAuthor, bookContext, history, questionIndex, stage } = params;

  try {
    const response = await getClient().chat.completions.create({
      model: process.env.AZURE_OPENAI_QUESTION_DEPLOYMENT!,
      max_completion_tokens: 120,
      messages: [
        {
          role: "system",
          content: [
            "너는 초등학교 3학년 아이와 방금 읽은 책에 대해 짧게 대화하며 독서 기록을 도와주는 1:1 독서 코치다.",
            `아이가 읽은 책: "${bookTitle}"${bookAuthor ? ` (저자: ${bookAuthor})` : ""}`,
            ...(bookContext ? [`책 줄거리 요약(참고용, 아이에게 그대로 알려주지 말 것): ${bookContext}`] : []),
            STAGE_INSTRUCTIONS[stage],
            questionIndex > 0
              ? "아이의 직전 답변에 짧게(한 문장) 공감하거나 칭찬한 뒤, 이어서 위 단계에 맞는 질문을 하나만 던져라. 단답형 퀴즈처럼 묻지 말고, 아이가 자기 생각을 편하게 말할 수 있게 묻는다."
              : "첫 질문이니 바로 위 단계에 맞는 질문 하나로 시작한다.",
            "질문은 짧고 쉬운 말투(반말, 친구처럼)로 쓴다. 이모지는 쓰지 않는다.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        ...toChatMessages(history),
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "ask_question",
            description: "아이에게 물어볼 다음 질문 하나를 만든다.",
            parameters: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description: "(선택) 짧은 공감/칭찬 한 문장 + 아이에게 물어볼 질문 한 문장",
                },
              },
              required: ["question"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "ask_question" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return fallbackQuestion(questionIndex);
    const input = JSON.parse(toolCall.function.arguments) as { question?: string };
    return input.question?.trim() || fallbackQuestion(questionIndex);
  } catch {
    return fallbackQuestion(questionIndex);
  }
}

// history에서 어떤 답변이 몇 단계(1 장면 소환/2 역할 바꾸기/3 현실 적용) 질문에 대한 답인지
// 묶어낸다. 옛 세션(이 기능 이전에 생성됨)처럼 assistant 메시지에 stage가 없으면 등장 순서로
// 추정한다(STAGE_PLAN과 동일한 순서 규칙).
function groupAnswersByStage(history: ConversationMessage[]): Record<ReadingCoachStage, string[]> {
  const groups: Record<ReadingCoachStage, string[]> = { 1: [], 2: [], 3: [] };
  let assistantIndex = 0;
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;
    const stage = msg.stage ?? stageForQuestionIndex(assistantIndex);
    assistantIndex += 1;
    const answer = history[i + 1];
    if (answer?.role === "child" && answer.content.trim()) {
      groups[stage].push(answer.content.trim());
    }
  }
  return groups;
}

// 대화 로그만 근거로 감상문을 만든다. 아이가 말하지 않은 내용을 창작하지 않는다(PRD 8절 윤리 기준).
// 단계별 독서록 유도 질문 프레임워크(사용자 설계)의 "독서록 조립 공식"에 따라 처음(줄거리)-
// 가운데(공감·비판적 사고)-끝(현실 적용) 3단 구성으로 조립한다.
export async function generateEssay(params: {
  bookTitle: string;
  bookAuthor: string | null;
  history: ConversationMessage[];
}): Promise<string> {
  const { bookTitle, bookAuthor, history } = params;
  const byStage = groupAnswersByStage(history);

  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_ESSAY_DEPLOYMENT!,
    max_completion_tokens: 500,
    messages: [
      {
        role: "system",
        content: [
          "너는 초등학교 3학년 아이가 책을 읽고 나눈 대화를 바탕으로 독서 감상문을 대신 써주는 도우미다.",
          `책 제목: "${bookTitle}"${bookAuthor ? ` (저자: ${bookAuthor})` : ""}`,
          "아래 원칙을 반드시 지켜라.",
          "1. 아이가 실제로 답변한 내용만 사용한다. 아이가 말하지 않은 사건, 감정, 등장인물을 절대 지어내지 않는다.",
          "2. 아이의 답변을 자연스러운 한국어 문장으로 이어 붙여 감상문 형태로 다듬는다.",
          "3. 초등 3학년이 쓴 것처럼 쉽고 담백한 문장으로 쓴다.",
          "4. 아래 3단계 답변을 순서대로 활용해 감상문을 정확히 3개 문단(처음-가운데-끝)으로 구성한다. 문단 사이는 줄바꿈 하나로 구분하고, 문단 제목은 쓰지 않는다.",
          `   - 처음 문단(줄거리): 1단계 답변 — ${byStage[1].join(" / ") || "(답변 없음)"}`,
          `   - 가운데 문단(생각·공감): 2단계 답변 — ${byStage[2].join(" / ") || "(답변 없음)"}`,
          `   - 끝 문단(현실 연결): 3단계 답변 — ${byStage[3].join(" / ") || "(답변 없음)"}`,
          "5. 가운데 문단은 아이 답변을 바탕으로 '나라면 ~했을 것 같다'는 생각을 자연스러운 말투로 녹여내되, 매번 똑같은 문장 틀을 쓰지 말고 아이의 실제 답변에 맞게 표현을 바꾼다.",
          "6. 각 문단은 1~3문장으로 짧게 쓴다.",
        ].join("\n"),
      },
      ...toChatMessages(history),
      { role: "user", content: "지금까지 대화를 바탕으로 독서 감상문을 써줘." },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "write_essay",
          description: "대화 내용을 바탕으로 독서 감상문을 작성한다.",
          parameters: {
            type: "object",
            properties: {
              essay: { type: "string", description: "처음-가운데-끝 3개 문단으로 구성된 한국어 독서 감상문" },
            },
            required: ["essay"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "write_essay" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    throw new Error("감상문을 만들지 못했어요.");
  }
  const input = JSON.parse(toolCall.function.arguments) as { essay?: string };
  if (!input.essay?.trim()) throw new Error("감상문을 만들지 못했어요.");
  return input.essay.trim();
}

export interface ParsedOcrRecord {
  bookTitle: string;
  content: string;
}

// 독서노트 손글씨 OCR 원문은 줄바꿈이 뒤섞여 있어 "책 제목 / 내용"으로 나누기 어렵다.
// 저지연 경량 모델로 항목만 분류하게 한다 — 문장을 새로 짓거나 내용을 보태지 않고,
// 인식된 텍스트에 실제로 있는 것만 재배열/오탈자 정리한다(감상문 생성과 달리 창작 여지가 없음).
export async function parseOcrRecord(rawText: string): Promise<ParsedOcrRecord> {
  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_QUESTION_DEPLOYMENT!,
    max_completion_tokens: 600,
    messages: [
      {
        role: "system",
        content: [
          "너는 초등학생 독서노트를 OCR로 인식한 텍스트를 정리하는 도우미다.",
          "아래 원칙을 반드시 지켜라.",
          "1. 텍스트에 실제로 있는 내용만 사용한다. 없는 내용을 새로 짓지 않는다.",
          "2. OCR 특유의 오탈자나 줄바꿈 깨짐만 자연스럽게 다듬는다.",
          "3. 책 제목으로 보이는 부분을 bookTitle로, 나머지 감상/줄거리 내용을 content로 나눈다.",
          "4. 책 제목을 못 찾겠으면 bookTitle을 빈 문자열로 둔다.",
        ].join("\n"),
      },
      { role: "user", content: rawText || "(인식된 텍스트 없음)" },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "structure_ocr",
          description: "OCR 텍스트를 책 제목과 내용으로 나눈다.",
          parameters: {
            type: "object",
            properties: {
              bookTitle: { type: "string", description: "책 제목. 못 찾으면 빈 문자열" },
              content: { type: "string", description: "책 제목을 제외한 나머지 독서 기록 내용" },
            },
            required: ["bookTitle", "content"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "structure_ocr" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    return { bookTitle: "", content: rawText };
  }
  const input = JSON.parse(toolCall.function.arguments) as { bookTitle?: string; content?: string };
  return {
    bookTitle: input.bookTitle?.trim() ?? "",
    content: input.content?.trim() || rawText,
  };
}

export interface CoverGuess {
  title: string;
  author: string | null;
}

// 표지 사진 OCR 원문(제목, 부제, 지은이, 출판사, 띠지 문구 등이 뒤섞여 있음)에서 "책 제목으로
// 가장 유력한 것" 하나만 추려낸다. 이 추정치는 최종 확정이 아니라 카카오 도서 검색의 검색어로만
// 쓰이고, 실제 후보 확정은 검색 결과를 사람이 골라서 한다 — 그래서 부제/지은이를 정확히 가려낼
// 필요 없이 "검색했을 때 그 책이 나올 만한 제목"이면 충분하다.
export async function guessCoverTitle(rawText: string): Promise<CoverGuess> {
  if (!rawText.trim()) return { title: "", author: null };

  try {
    const response = await getClient().chat.completions.create({
      model: process.env.AZURE_OPENAI_QUESTION_DEPLOYMENT!,
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content: [
            "너는 책 표지를 OCR로 인식한 텍스트에서 책 제목과 지은이를 추측하는 도우미다.",
            "표지에는 제목, 부제, 지은이, 출판사, 추천사 등 여러 문구가 섞여 있다.",
            "가장 크고 중심에 있을 법한 문구를 책 제목으로 고른다. 확신이 없어도 가장 유력한 후보를 고른다.",
            "지은이로 보이는 이름이 있으면 author에 넣고, 없으면 빈 문자열로 둔다.",
            "텍스트에 없는 내용을 새로 짓지 않는다.",
          ].join("\n"),
        },
        { role: "user", content: rawText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "guess_cover_title",
            description: "표지 OCR 텍스트에서 책 제목과 지은이를 추측한다.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "가장 유력한 책 제목" },
                author: { type: "string", description: "지은이 이름. 모르면 빈 문자열" },
              },
              required: ["title", "author"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "guess_cover_title" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return { title: "", author: null };
    const input = JSON.parse(toolCall.function.arguments) as { title?: string; author?: string };
    return { title: input.title?.trim() ?? "", author: input.author?.trim() || null };
  } catch {
    return { title: "", author: null };
  }
}
