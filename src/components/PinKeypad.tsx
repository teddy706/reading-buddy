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

// PIN 4자리를 다 입력해도 곧바로 서버에 보내지 않고 이 버튼을 눌러야 넘어가게 한다 —
// 자동 제출은 응답이 오기 전까지 화면이 멈춘 것처럼 보여 아이가 "눌렀는데 안 되나?" 하고
// 다시 누르게 되는 문제가 있었다(사용자 피드백). 로딩 중엔 버튼 라벨로 진행 상태를 보여준다.
export function PinConfirmButton({
  ready,
  loading,
  onClick,
  label = "확인",
  loadingLabel = "확인하는 중...",
}: {
  ready: boolean;
  loading?: boolean;
  onClick: () => void;
  label?: string;
  loadingLabel?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!ready || loading} className="btn btn-primary mt-2 mb-0">
      {loading ? loadingLabel : label}
    </button>
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
