"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했어요.");
        return;
      }
      router.push("/profiles");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell justify-center">
      <div className="mx-auto w-full max-w-sm md:max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/icons/icon-192x192.png"
            alt="리딩버디 로고"
            width={64}
            height={64}
            className="h-16 w-16 rounded-[18px] shadow-sm mb-2"
            priority
          />
          <h1 className="text-2xl font-bold">리딩버디</h1>
          <p className="mt-1 text-center text-sm text-soft">부모 계정으로 로그인해요</p>
        </div>

        <form className="card" onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
          {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
          <button type="submit" className="btn btn-primary mb-0" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-soft">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-bold text-accent underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
