// Jednoduché obrysové ikony navigace (vlastní kresba, 24×24, tah 1,8).
const PATHS = {
  library: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13zM7 8h1.5M7 11h1.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  workflow: "M4 4h7v6H4zM13 14h7v6h-7zM7.5 10v3a2 2 0 0 0 2 2H13",
  education: "M2.5 9 12 4.5 21.5 9 12 13.5zM6 11v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3V11M21.5 9v5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  calendar: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4",
  pencil: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  filter: "M4 5h16l-6 7.5V19l-4-2v-4.5z",
  select: "M4 6.5l1.8 1.8L9 5M4 13.5l1.8 1.8L9 12M12 7h8M12 14h8M12 19h8",
  close: "M6 6l12 12M18 6 6 18",
  bug: "M9 7.5a3 3 0 0 1 6 0M7.5 9.5h9v5a4.5 4.5 0 0 1-9 0zM12 10v9M4 11h3.5M16.5 11H20M4.5 17l3-1.5M19.5 17l-3-1.5M5 5.5 8 8M19 5.5 16 8",
  alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5v5.5M12 16.5h.01",
  chevronDown: "M6 9l6 6 6-6",
  grip: "M6 8.5h12M6 12h12M6 15.5h12",
  copy: "M9 9h9.5A1.5 1.5 0 0 1 20 10.5v8A1.5 1.5 0 0 1 18.5 20h-8A1.5 1.5 0 0 1 9 18.5zM15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9",
  move: "M4 12h16M16 8l4 4-4 4M8 8l-4 4 4 4",
  send: "M12 19V5M6 11l6-6 6 6",
  open: "M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10",
  file: "M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h6",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  star: "M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z",
  archive: "M4 5h16v4H4zM5.5 9v10h13V9M10 13h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
