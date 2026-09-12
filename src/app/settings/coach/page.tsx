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
      <p className="mb-4 text-center text-sm text-soft">
        아이와 대화할 때 AI가 각 단계에서 참고하는 지침이에요. 매번 같은 패턴이 지루하다면 자유롭게 바꿔보세요.
      </p>

      {/* 지침 문구를 읽고 고치는 화면이라, 넓은 화면에서도 한 줄이 너무 길어지지 않도록
          폭을 적당히 제한한다(가독성) — 그리드로 나눌 내용이 아니라 shell만 넓히는 다른
          화면들과 다르게 처리. */}
      <div className="w-full md:mx-auto md:max-w-xl">
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
