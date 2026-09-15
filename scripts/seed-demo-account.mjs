// 회원가입 화면의 "데모 체험하기" 링크가 로그인시키는 읽기 전용 데모 계정을 만든다/다시 만든다.
// 실행: node --env-file=.env.local scripts/seed-demo-account.mjs
//
// 이미 데모 가족(is_demo=true)이 있으면 완전히 지우고 새로 시딩한다(멱등) — 방문자가 어느 정도
// 건드릴 수 있는 부분(대화 시작 등)이 있어서, 데모 데이터가 지저분해지면 이 스크립트를 다시
// 실행해 깨끗한 상태로 되돌릴 수 있게 하기 위함. 실제 가족 데이터는 건드리지 않는다
// (is_demo=true인 가족만 대상으로 삼는다).
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHILD_AUTH_SECRET = process.env.CHILD_AUTH_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CHILD_AUTH_SECRET) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CHILD_AUTH_SECRET 이 필요해요.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// src/lib/childAuth.ts와 반드시 같은 규칙이어야 실제 로그인이 된다.
function childProfileEmail(profileId) {
  return `child+${profileId}@child.reading-buddy.internal`;
}
function deriveChildAuthPassword(profileId, pin) {
  return crypto.createHmac("sha256", CHILD_AUTH_SECRET).update(`${profileId}:${pin}`).digest("hex");
}
function generateJoinCode(length = 6) {
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

// demoMode.ts의 DEMO_CHILD_PIN과 반드시 같아야 한다(프로필 선택 화면의 안내 문구가 이 값을 보여준다).
const DEMO_CHILD_PIN = "1234";
const DEMO_PARENT_EMAIL = process.env.DEMO_PARENT_EMAIL ?? "demo@reading-buddy.app";
const DEMO_PARENT_PASSWORD = process.env.DEMO_PARENT_PASSWORD ?? crypto.randomBytes(18).toString("base64url");

async function wipeExistingDemoFamilies() {
  const { data: demoFamilies } = await admin.from("families").select("id").eq("is_demo", true);
  for (const family of demoFamilies ?? []) {
    const { data: profiles } = await admin.from("profiles").select("id, user_id").eq("family_id", family.id);
    for (const p of profiles ?? []) {
      if (p.user_id) await admin.auth.admin.deleteUser(p.user_id);
    }
    await admin.from("families").delete().eq("id", family.id);
  }
  if (demoFamilies?.length) console.log(`기존 데모 가족 ${demoFamilies.length}개 정리했어요.`);
}

async function createParent(familyId) {
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: DEMO_PARENT_EMAIL,
    password: DEMO_PARENT_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "parent", demo: true },
  });
  if (userError || !userData.user) throw new Error(`데모 부모 계정 생성 실패: ${userError?.message}`);

  const { error: profileError } = await admin.from("profiles").insert({
    family_id: familyId,
    user_id: userData.user.id,
    role: "parent",
    name: "데모 부모",
    avatar: "🧑",
  });
  if (profileError) throw new Error(`데모 부모 프로필 생성 실패: ${profileError.message}`);
  return userData.user.id;
}

async function createChild(familyId, { name, avatar }) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      family_id: familyId,
      role: "child",
      name,
      avatar,
      pin_hash: await bcrypt.hash(DEMO_CHILD_PIN, 10),
    })
    .select()
    .single();
  if (profileError || !profile) throw new Error(`데모 자녀(${name}) 프로필 생성 실패: ${profileError?.message}`);

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: childProfileEmail(profile.id),
    password: deriveChildAuthPassword(profile.id, DEMO_CHILD_PIN),
    email_confirm: true,
    user_metadata: { role: "child", profile_id: profile.id, demo: true },
  });
  if (userError || !userData.user) throw new Error(`데모 자녀(${name}) 계정 생성 실패: ${userError?.message}`);

  const { error: linkError } = await admin.from("profiles").update({ user_id: userData.user.id }).eq("id", profile.id);
  if (linkError) throw new Error(`데모 자녀(${name}) 계정 연결 실패: ${linkError.message}`);

  return profile;
}

// "YYYY-MM-DD" — 오늘로부터 daysAgo일 전.
function dateDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function insertConversationSession(familyId, childId, { bookTitle, bookAuthor, pageCount, messages }) {
  const { data, error } = await admin
    .from("conversation_sessions")
    .insert({
      family_id: familyId,
      child_profile_id: childId,
      book_title: bookTitle,
      book_author: bookAuthor,
      book_page_count: pageCount,
      messages,
      status: "completed",
    })
    .select()
    .single();
  if (error || !data) throw new Error(`대화 세션 생성 실패(${bookTitle}): ${error?.message}`);
  return data;
}

async function insertRecord(familyId, childId, record) {
  const { error } = await admin.from("reading_records").insert({
    family_id: familyId,
    child_profile_id: childId,
    ...record,
  });
  if (error) throw new Error(`기록 생성 실패(${record.book_title}): ${error.message}`);
}

function msg(role, content, stage) {
  return { role, content, created_at: new Date().toISOString(), ...(stage ? { stage } : {}) };
}

async function seedSomEssayAndRecord(familyId, somId) {
  const session1 = await insertConversationSession(familyId, somId, {
    bookTitle: "무지개 물고기",
    bookAuthor: "마르쿠스 피스터",
    pageCount: 32,
    messages: [
      msg("assistant", "무지개 물고기한테 무슨 일이 있었어? 가장 기억에 남는 사건을 말해줄래?", 1),
      msg("child", "무지개 물고기가 반짝이는 비늘이 예뻐서 친구들한테 안 나눠주다가 친구가 하나도 없게 됐어요."),
      msg("assistant", "친구들이 다 떠났을 때 무지개 물고기는 어떻게 했어?", 1),
      msg("child", "문어 할머니한테 가서 어떻게 하면 좋을지 물어봤어요. 그리고 반짝이는 비늘을 친구들한테 하나씩 나눠줬어요."),
      msg("assistant", "만약 네가 무지개 물고기였다면 처음부터 어떻게 했을 것 같아?", 2),
      msg("child", "저였으면 처음부터 비늘을 나눠줬을 것 같아요. 혼자 반짝이는 것보다 친구들이랑 노는 게 더 좋으니까요."),
      msg("assistant", "이 책을 읽고 나서, 내 물건을 친구랑 나눠본 적 있어? 그때 기분이 어땠어?", 3),
      msg("child", "지난주에 짝꿍한테 지우개를 빌려줬는데 같이 웃으면서 놀 수 있어서 좋았어요."),
    ],
  });
  await insertRecord(familyId, somId, {
    book_title: "무지개 물고기",
    book_author: "마르쿠스 피스터",
    page_count: 32,
    isbn: null,
    source_type: "conversation",
    content:
      "무지개 물고기는 반짝이는 비늘이 예뻐서 친구들에게 나눠주지 않다가 결국 친구가 모두 떠나버렸다. 혼자가 된 무지개 물고기는 문어 할머니를 찾아가 조언을 듣고, 용기를 내어 비늘을 하나씩 친구들에게 나눠주었다.\n나라면 처음부터 비늘을 나눠줬을 것 같다. 혼자 반짝이는 것보다 친구들과 함께 노는 게 훨씬 더 좋은 일이기 때문이다.\n지난주에 짝꿍에게 지우개를 빌려줬는데, 함께 웃으면서 놀 수 있어서 나도 무지개 물고기처럼 나누는 기쁨을 느낄 수 있었다.",
    source_ref_id: session1.id,
    recorded_at: dateDaysAgo(3),
    dokseoro_status: "synced",
  });

  const session2 = await insertConversationSession(familyId, somId, {
    bookTitle: "강아지똥",
    bookAuthor: "권정생",
    pageCount: 28,
    messages: [
      msg("assistant", "강아지똥은 처음에 스스로를 어떻게 생각했어?", 1),
      msg("child", "아무 쓸모도 없는 더러운 똥이라고 생각해서 슬퍼했어요."),
      msg("assistant", "민들레는 강아지똥한테 뭐라고 말해줬어?", 1),
      msg("child", "네가 거름이 되어야 예쁜 꽃을 피울 수 있다고 말해줬어요."),
      msg("assistant", "네가 강아지똥이었다면 그 말을 듣고 어떤 기분이 들었을 것 같아?", 2),
      msg("child", "처음엔 믿기 어려웠겠지만 누군가한테 도움이 될 수 있다는 게 기뻤을 것 같아요."),
      msg("assistant", "나도 누군가에게 도움이 됐던 적이 있어?", 3),
      msg("child", "동생이 숙제를 못 풀 때 제가 알려준 적이 있어요. 동생이 고맙다고 해서 뿌듯했어요."),
    ],
  });
  await insertRecord(familyId, somId, {
    book_title: "강아지똥",
    book_author: "권정생",
    page_count: 28,
    isbn: null,
    source_type: "conversation",
    content:
      "강아지똥은 자신이 아무 쓸모도 없는 더러운 존재라고 생각하며 슬퍼했다. 그러던 어느 날 민들레를 만나, 거름이 되어야 예쁜 꽃을 피울 수 있다는 이야기를 듣게 된다.\n나라면 처음엔 그 말을 믿기 어려웠겠지만, 누군가에게 도움이 될 수 있다는 사실이 기뻤을 것 같다.\n나도 동생이 숙제를 못 풀어 힘들어할 때 알려준 적이 있는데, 동생이 고맙다고 해서 정말 뿌듯했다.",
    source_ref_id: session2.id,
    recorded_at: dateDaysAgo(12),
    dokseoro_status: "synced",
  });

  const session3 = await insertConversationSession(familyId, somId, {
    bookTitle: "돼지책",
    bookAuthor: "앤서니 브라운",
    pageCount: 32,
    messages: [
      msg("assistant", "피곳 아줌마가 집을 나가기 전에 무슨 일이 있었어?", 1),
      msg("child", "아빠랑 오빠들이 집안일을 하나도 안 도와줘서 아줌마 혼자 다 했어요."),
      msg("assistant", "아줌마가 나간 뒤에 아빠랑 오빠들은 어떻게 됐어?", 1),
      msg("child", "밥도 못 챙겨 먹고 집이 엉망이 됐어요. 그러다 진짜 돼지처럼 변했어요."),
      msg("assistant", "네가 피곳 아줌마였다면 그때 어떤 기분이었을 것 같아?", 2),
      msg("child", "정말 힘들고 서운했을 것 같아요. 그래서 집을 나간 것도 이해가 돼요."),
      msg("assistant", "너는 집안일을 도와준 적 있어? 그때 어땠어?", 3),
      msg("child", "저는 밥 먹고 나서 제 그릇을 싱크대에 갖다 놔요. 별거 아니지만 엄마가 고맙다고 해줘요."),
    ],
  });
  await insertRecord(familyId, somId, {
    book_title: "돼지책",
    book_author: "앤서니 브라운",
    page_count: 32,
    isbn: null,
    source_type: "conversation",
    content:
      "피곳 아줌마는 아빠와 오빠들이 집안일을 하나도 도와주지 않자 혼자 모든 일을 떠맡다가 결국 집을 나가버렸다. 남겨진 가족은 밥도 제대로 못 챙겨 먹고 집이 엉망이 되면서 진짜 돼지처럼 변해버렸다.\n내가 피곳 아줌마였다면 정말 힘들고 서운했을 것 같다. 그래서 집을 나간 것도 충분히 이해가 된다.\n나는 밥을 먹고 나서 내 그릇을 싱크대에 갖다 놓는데, 별거 아닌 것 같아도 엄마가 고맙다고 말해줘서 뿌듯하다.",
    source_ref_id: session3.id,
    recorded_at: dateDaysAgo(8),
    dokseoro_status: "synced",
  });
}

async function seedSomRemainingRecords(familyId, somId) {
  const manual = [
    { title: "구름빵", author: "백희나", days: 20, page: 40 },
    { title: "책 먹는 여우", author: "프란치스카 비어만", days: 35, page: 88 },
    { title: "마당을 나온 암탉", author: "황선미", days: 48, page: 152 },
    { title: "이솝 우화", author: "이솝", days: 60, page: 96 },
    { title: "코끼리 아저씨와 100개의 물방울", author: "노인경", days: 70, page: 40 },
  ];
  for (const b of manual) {
    await insertRecord(familyId, somId, {
      book_title: b.title,
      book_author: b.author,
      page_count: b.page,
      isbn: null,
      source_type: "manual",
      content: `${b.title}을(를) 읽고 느낀 점을 직접 적었어요. 주인공의 마음이 어떻게 변하는지 살펴보는 게 재미있었고, 나라면 어떻게 했을지 생각해보게 됐어요.`,
      recorded_at: dateDaysAgo(b.days),
      dokseoro_status: b.days < 40 ? "synced" : "pending",
    });
  }

  const ocr = [
    { title: "팥죽 할머니와 호랑이", days: 25, page: 32 },
    { title: "훨훨 간다", days: 55, page: 36 },
    { title: "치과 의사 드소토 선생님", days: 85, page: 40 },
  ];
  for (const b of ocr) {
    await insertRecord(familyId, somId, {
      book_title: b.title,
      book_author: null,
      page_count: b.page,
      isbn: null,
      source_type: "ocr",
      content: `학교 독서노트에 손으로 쓴 내용을 사진으로 찍어 옮겼어요. ${b.title} 이야기가 재미있었다고 적었어요.`,
      recorded_at: dateDaysAgo(b.days),
      dokseoro_status: "pending",
    });
  }
}

async function seedYeoreum(familyId, yeoreumId) {
  await insertRecord(familyId, yeoreumId, {
    book_title: "곰 사냥을 떠나자",
    book_author: "마이클 로젠",
    page_count: 32,
    isbn: null,
    source_type: "manual",
    content: "가족이 곰을 사냥하러 떠나는 이야기예요. 리듬감 있게 반복되는 말이 재미있었어요.",
    recorded_at: dateDaysAgo(5),
    dokseoro_status: "pending",
  });
  await insertRecord(familyId, yeoreumId, {
    book_title: "손 큰 할머니의 만두 만들기",
    book_author: "채인선",
    page_count: 40,
    isbn: null,
    source_type: "manual",
    content: "할머니가 동물 친구들과 함께 아주 큰 만두를 빚는 이야기예요. 다 같이 나눠 먹는 장면이 따뜻했어요.",
    recorded_at: dateDaysAgo(18),
    dokseoro_status: "synced",
  });
}

async function main() {
  await wipeExistingDemoFamilies();

  const { data: family, error: familyError } = await admin
    .from("families")
    .insert({ name: "체험 가족", join_code: generateJoinCode(), is_demo: true })
    .select()
    .single();
  if (familyError || !family) throw new Error(`데모 가족 생성 실패: ${familyError?.message}`);

  await createParent(family.id);
  const som = await createChild(family.id, { name: "봄이", avatar: "🌸" });
  const yeoreum = await createChild(family.id, { name: "여름이", avatar: "☀️" });

  await seedSomEssayAndRecord(family.id, som.id);
  await seedSomRemainingRecords(family.id, som.id);
  await seedYeoreum(family.id, yeoreum.id);

  console.log("데모 계정 시딩 완료!");
  console.log(`  가족: ${family.name} (${family.id})`);
  console.log(`  부모 로그인: ${DEMO_PARENT_EMAIL} / ${DEMO_PARENT_PASSWORD}`);
  console.log(`  자녀 PIN: ${DEMO_CHILD_PIN} (봄이, 여름이 공통)`);
  if (!process.env.DEMO_PARENT_PASSWORD) {
    console.log(
      "\n⚠️ DEMO_PARENT_PASSWORD가 .env.local에 없어서 방금 새로 생성했어요 — 이 값을 .env.local과 Vercel Environment Variables에 DEMO_PARENT_EMAIL과 함께 등록해야 데모 로그인 버튼이 동작해요."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
