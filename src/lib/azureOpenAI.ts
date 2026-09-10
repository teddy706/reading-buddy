import "server-only";
import { AzureOpenAI } from "openai/azure";
import type { ConversationMessage } from "@/lib/types";
import { fallbackQuestion } from "@/lib/readingSession";

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

// 아이의 직전 답변을 참고해 다음 질문을 만든다. 실패하면 호출한 쪽이 고정 폴백 질문을 쓸 수 있도록
// null을 반환한다(PRD 9.5 "고정 백업 질문 3개" 폴백 원칙).
export async function generateNextQuestion(params: {
  bookTitle: string;
  bookAuthor: string | null;
  bookContext: string | null;
  history: ConversationMessage[];
  questionIndex: number;
}): Promise<string | null> {
  const { bookTitle, bookAuthor, bookContext, history, questionIndex } = params;

  try {
    const response = await getClient().chat.completions.create({
      model: process.env.AZURE_OPENAI_QUESTION_DEPLOYMENT!,
      max_completion_tokens: 100,
      messages: [
        {
          role: "system",
          content: [
            "너는 초등학교 3학년 아이와 방금 읽은 책에 대해 짧게 대화하며 독서 기록을 도와주는 도우미다.",
            `아이가 읽은 책: "${bookTitle}"${bookAuthor ? ` (저자: ${bookAuthor})` : ""}`,
            ...(bookContext ? [`책 줄거리 요약(참고용, 아이에게 그대로 알려주지 말 것): ${bookContext}`] : []),
            "아이의 직전 답변을 참고해서, 그 답변을 더 구체적으로 풀어낼 수 있는 다음 질문 하나만 만들어라.",
            bookContext
              ? "줄거리 요약에 나오는 사건이나 등장인물을 활용해 더 구체적인 질문을 만들어도 좋다."
              : "",
            "질문은 한 문장, 짧고 쉬운 말투(반말, 친구처럼)로 쓴다. 이모지는 쓰지 않는다.",
            "아직 답변이 없으면(첫 질문이면) 책에서 재미있었던 부분을 묻는 질문으로 시작한다.",
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
                question: { type: "string", description: "아이에게 물어볼 한 문장짜리 질문" },
              },
              required: ["question"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "ask_question" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return null;
    const input = JSON.parse(toolCall.function.arguments) as { question?: string };
    return input.question?.trim() || null;
  } catch {
    return fallbackQuestion(questionIndex);
  }
}

// 대화 로그만 근거로 감상문을 만든다. 아이가 말하지 않은 내용을 창작하지 않는다(PRD 8절 윤리 기준).
export async function generateEssay(params: {
  bookTitle: string;
  bookAuthor: string | null;
  history: ConversationMessage[];
}): Promise<string> {
  const { bookTitle, bookAuthor, history } = params;

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
          "4. 4~6문장 정도의 분량으로 쓴다.",
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
              essay: { type: "string", description: "4~6문장의 한국어 독서 감상문" },
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
