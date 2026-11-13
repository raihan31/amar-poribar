import type { ReactNode, SVGProps } from "react";

const PATHS = {
  mic: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3" />,
  buzz: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  video: <path d="M3 6h12v12H3V6Zm12 4 6-3v10l-6-3" />,
  home: <path d="M3 11 12 3l9 8M5 10v10h14V10" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h2M3 12h2M3 18h2" />,
  budget: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  family: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20c0-4 3-6 6-6s6 2 6 6M15 14c4 0 7 2 7 6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  play: <path d="M7 4v16l13-8L7 4Z" />,
  speaker: <path d="M4 9v6h4l5 4V5L8 9H4Zm13 0c2 2 2 4 0 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  back: <path d="M15 4 7 12l8 8" />,
  camera: (
    <>
      <path d="M3 8h4l2-3h6l2 3h4v12H3V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6" />,
  lock: (
    <>
      <path d="M5 11h14v10H5V11Zm3 0V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  warning: <path d="M12 3 2 21h20L12 3Zm0 6v6m0 3v.5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 3v.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-9.5v.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const iconNames = Object.keys(PATHS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

/** Decorative inline icon; pair it with a visible word or an aria-label on the parent control. */
export function Icon({ name, size = 24, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
