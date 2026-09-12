import Link from "next/link";

// 기록 목록처럼 내용이 길어질 수 있는 화면에서 "뒤로"가 화면 맨 아래에만 있으면 끝까지
// 스크롤해야 나가진다는 피드백을 받고, 화면 위쪽에 두는 공용 버튼으로 뺐다.
export function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="btn-pill mb-4">
      ← 뒤로
    </Link>
  );
}
