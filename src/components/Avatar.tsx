export const AVATAR_OPTIONS = ["🦁", "🐰", "🐻", "🐼", "🦊", "🐨", "🐧", "🐬"];

export function Avatar({
  emoji,
  photoUrl,
  size = "md",
}: {
  emoji: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-16 w-16 text-4xl" : size === "sm" ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className={`inline-block ${sizeClass} rounded-full border-2 border-ink object-cover`}
      />
    );
  }

  return (
    <span
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full border-2 border-ink bg-a-light`}
    >
      {emoji}
    </span>
  );
}
