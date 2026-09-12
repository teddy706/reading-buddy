import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 한글 가독성을 위해 프리텐다드(Pretendard)로 교체(2026-09-12, 사용자 요청). 가변 폰트
// 하나로 전체 굵기(45~920)를 커버해서 굵기별 파일을 따로 둘 필요가 없다. next/font/local로
// 셀프 호스팅해 별도 네트워크 요청(CDN) 없이 빌드에 포함시킨다 — Next.js가 자동으로 폰트를
// 프리로드하고 layout shift를 방지해준다.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "리딩버디",
  description: "아이와의 대화로 독서 기록을 남기는 가족용 PWA",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#fffdf8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${pretendard.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
