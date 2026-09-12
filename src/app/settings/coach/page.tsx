import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { CoachSettingsForm } from "@/components/CoachSettingsForm";
import { DEFAULT_STAGE_INSTRUCTIONS, STAGE_LABELS, type StageInstructions } from "@/lib/readingSession";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

export default async function CoachSettingsPage() {
  const parent = await requireParentProfile();
  const supabase = createClient();

  const { data: family } = await supabase
    .from("families")
    .select("custom_stage_instructions")
    .eq("id", parent.family_id)
    .maybeSingle();

  const custom = (family?.custom_stage_instructions as Partial<StageInstructions> | null) ?? null;

  return (
    <div className="app-shell">
      <BackLink href="/settings" />
      <h1 className="mb-1 text-center text-2xl font-bold">AI 질문 스타일</h1>

      {/* 지침 문구를 읽고 고치는 화면이라, 넓은 화면에서도 한 줄이 너무 길어지지 않도록
          폭을 적당히 제한한다(가독성) — 그리드로 나눌 내용이 아니라 shell만 넓히는 다른
          화면들과 다르게 처리. 안내 문구도 폭을 맞추려고 같은 래퍼 안에 둔다. */}
      <div className="w-full md:mx-auto md:max-w-xl">
        <p className="mb-3 text-center text-sm text-soft">
          아이와 대화할 때 AI가 각 단계에서 참고하는 지침이에요. 매번 같은 패턴이 지루하다면 자유롭게 바꿔보세요.
        </p>

        {/* 사용자 피드백: "질문에 무조건 4단계를 유지하는 건 아니라고 했었는데, 이 화면에는 그
            내용이 알 수가 없어" — 아래 지침을 부모가 바꿀 때 팔로업(같은 단계에서 한 번 더
            캐묻는 질문)의 존재를 모르면 "왜 가끔 질문이 5개가 되지?" 싶을 수 있어서 명시적으로
            알려준다(2026-09-12). 팔로업 자체의 말투는 이 화면에서 못 바꾼다는 점도 같이 안내 —
            아래 지침 문구는 팔로업이 아니라 "새 단계로 넘어갈 때"의 질문에만 적용된다. */}
        <div className="mb-4 rounded-2xl border-2 border-[#eee] bg-[#f4f0e8] p-3 text-xs text-soft">
          <p className="mb-1">
            질문은 보통 <strong>1단계(장면 소환) 2개 → 2단계(역할 바꾸기) 1개 → 3단계(현실 적용) 1개</strong>, 총
            4개 순서로 진행돼요.
          </p>
          <p>
            다만 아이가 &ldquo;몰라&rdquo;처럼 너무 짧게 답하면, AI가 같은 단계에서 한 번 더 다정하게 캐물어요(단계당
            최대 1회) — 그래서 실제 질문 수는 4개보다 많아질 수 있어요. 이 &lsquo;다시 물어보기&rsquo;의 말투는
            고정돼 있어 아래 지침으로는 못 바꾸고, 아래 지침은 새로운 단계로 넘어갈 때의 질문에만 적용돼요.
          </p>
        </div>

        <CoachSettingsForm
          defaultInstructions={DEFAULT_STAGE_INSTRUCTIONS}
          initialInstructions={{
            1: custom?.[1] ?? DEFAULT_STAGE_INSTRUCTIONS[1],
            2: custom?.[2] ?? DEFAULT_STAGE_INSTRUCTIONS[2],
            3: custom?.[3] ?? DEFAULT_STAGE_INSTRUCTIONS[3],
          }}
          isCustom={!!custom}
          stageLabels={STAGE_LABELS}
        />
      </div>
    </div>
  );
}
