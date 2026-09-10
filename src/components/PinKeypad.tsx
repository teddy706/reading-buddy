"use client";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function PinKeypad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  function press(key: string) {
    if (disabled) return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 4) return;
    onChange(value + key);
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((key, i) =>
        key === "" ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            className="rounded-btn border-2 border-ink bg-white py-4 text-xl font-bold transition-transform active:scale-95 disabled:opacity-50"
          >
            {key === "back" ? "⌫" : key}
          </button>
        )
      )}
    </div>
  );
}

export function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="mb-6 flex justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full border-2 border-ink ${i < filled ? "bg-ink" : "bg-white"}`}
        />
      ))}
    </div>
  );
}
