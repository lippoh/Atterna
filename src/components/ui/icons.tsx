// src/components/ui/icons.tsx — Atterna icon set
// Hand-authored inline SVGs, lucide-style geometry (24×24 viewBox,
// stroke 1.75, round caps/joins) so the design ships with ZERO new
// dependencies — swapping to lucide-react later is a drop-in refactor.
// Icon-only usages must pair these with aria-labels (a11y contract §11).
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2 11 14.7l4.7-4.9" />
    </svg>
  );
}

export function IconXCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5m0-5-5 5" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5m6 6-6-6 6-6" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconExternalLink(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6h5" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.2l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.6l6-.9L12 3.2Z" />
    </svg>
  );
}

/** Filled star for rating displays (uses currentColor fill). */
export function IconStarFilled(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 3.2l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.6l6-.9L12 3.2Z" />
    </svg>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v11m0 0-4-4m4 4 4-4" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function IconQr(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17.5 20h2.5M20 17.5v.01" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15.5 16 20 12l-4.5-4M20 12H9" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.4a2 2 0 1 1 0-4h.3a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3.4a2 2 0 1 1 4 0v.3a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1.1Z" />
    </svg>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5 13.4 9l4.6 1.4-4.6 1.5L12 16.5l-1.4-4.6L6 10.4 10.6 9 12 4.5Z" />
      <path d="M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2ZM5 3l.6 1.6L7.2 5.2 5.6 5.8 5 7.4 4.4 5.8 2.8 5.2l1.6-.6L5 3Z" />
    </svg>
  );
}

export function IconMessageSquare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 15.5a2 2 0 0 1-2 2H8l-4 3.5v-14A2 2 0 0 1 6 5h12a2 2 0 0 1 2 2v8.5Z" />
      <path d="M9 9.5h6M9 13h4" />
    </svg>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 13.5V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6.5" />
      <path d="M4 13.5h4l1.5 2.5h5l1.5-2.5h4v5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 4 18.5v-5Z" />
    </svg>
  );
}

export function IconChartLine(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19V5M4 19h16" />
      <path d="m7 14 3.5-4 3 2.5L19 7" />
    </svg>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 17 10 11l3.5 3.5L20 8" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

export function IconTrendingDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7 10 13l3.5-3.5L20 16" />
      <path d="M15 16h5v-5" />
    </svg>
  );
}

export function IconShieldCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 5 6v5.5c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6l-7-2.5Z" />
      <path d="M9.2 12 11.3 14l3.6-3.8" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 21V5.5A1.5 1.5 0 0 1 6.5 4H15a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M3 21h18M16.5 9H19a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M8.5 8h4.5M8.5 12h4.5M8.5 16h4.5" />
    </svg>
  );
}

export function IconThumbsUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 11v9H4.5A1.5 1.5 0 0 1 3 18.5V12.5A1.5 1.5 0 0 1 4.5 11H7Z" />
      <path d="M7 11l4-7a2.4 2.4 0 0 1 2.3 3l-.8 2.5H19a2 2 0 0 1 2 2.4l-1.2 6a2 2 0 0 1-2 1.6H7" />
    </svg>
  );
}

export function IconThumbsDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 13V4H4.5A1.5 1.5 0 0 0 3 5.5v6A1.5 1.5 0 0 0 4.5 13H7Z" />
      <path d="M7 13l4 7a2.4 2.4 0 0 0 2.3-3l-.8-2.5H19a2 2 0 0 0 2-2.4l-1.2-6a2 2 0 0 0-2-1.6H7" />
    </svg>
  );
}

export function IconLanguages(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h10M8 4v2c0 4-2 7-5 8.5" />
      <path d="M5.5 10.5c1 2.5 3 4.2 5.5 5" />
      <path d="m13 20 3.8-9 3.7 9M14.4 17.2h5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 11.5 16-7-7 16-2.2-6.8L4 11.5Z" />
      <path d="m10.8 13.7 3.2-3.2" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  );
}

export function IconCard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10.5h18M7 15h4" />
    </svg>
  );
}
