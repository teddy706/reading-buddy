"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ label = "로그아웃", className = "btn btn-ghost mb-0" }: { label?: string; className?: string }) {
  const router = useRouter();

  async function onClick() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
