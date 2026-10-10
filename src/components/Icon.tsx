// 丸みのある線のアイコン(試作画面と同じ書き方)
const PATHS = {
  back: <path d="M15 5 8 12l7 7" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
