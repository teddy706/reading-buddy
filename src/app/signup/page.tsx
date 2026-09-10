"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [parentName, setParentName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, parentName, familyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "회원가입에 실패했어요.");
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
      <h1 className="mb-1 text-center text-2xl font-bold">부모 회원가입</h1>
      <p className="mb-6 text-center text-sm text-soft">가족 계정을 만들어요</p>

      <form className="card" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="내 이름 (예: 엄마)"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          required
          className="input"
        />
        <input
          type="text"
          placeholder="가족 이름 (선택, 예: 우리집)"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          className="input"
        />
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
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="input"
        />
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading}>
          {loading ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-soft">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold text-accent underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
