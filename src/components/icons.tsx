type P = { className?: string };

const S = ({ children, className }: P & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? 'h-[17px] w-[17px]'}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconHome = (p: P) => (
  <S {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></S>
);
export const IconUsers = (p: P) => (
  <S {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 5.4a3.2 3.2 0 0 1 0 5.2" /><path d="M18.5 14.4A5.6 5.6 0 0 1 21.5 20" /></S>
);
export const IconGlobe = (p: P) => (
  <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z" /></S>
);
export const IconClients = (p: P) => (
  <S {...p}><rect x="3.5" y="4" width="17" height="16" rx="2" /><circle cx="12" cy="10" r="2.4" /><path d="M8 17a4 4 0 0 1 8 0" /></S>
);
export const IconGroup = (p: P) => (
  <S {...p}><circle cx="7" cy="7.5" r="2.6" /><circle cx="17" cy="7.5" r="2.6" /><circle cx="12" cy="16.5" r="2.6" /><path d="M9.3 9.1 10.8 14" /><path d="M14.7 9.1 13.2 14" /></S>
);
export const IconPlanning = (p: P) => (
  <S {...p}><path d="M5 3.5h14v17l-7-3.5L5 20.5Z" /><path d="M9 8.5h6" /><path d="M9 12h6" /></S>
);
export const IconShield = (p: P) => (
  <S {...p}><path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" /><path d="M9.2 12.2 11.2 14l3.6-3.8" /></S>
);
export const IconReports = (p: P) => (
  <S {...p}><path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20Z" /><path d="M14 3.5V8h4" /><path d="M9 13h6" /><path d="M9 16.5h4" /></S>
);
export const IconAccounting = (p: P) => (
  <S {...p}><rect x="4.5" y="3" width="15" height="18" rx="2" /><path d="M8 7.5h8" /><path d="M8 11.5h3" /><path d="M13.5 11.5h2.5" /><path d="M8 15.5h3" /><path d="M13.5 15.5h2.5" /></S>
);
export const IconSetting = (p: P) => (
  <S {...p}><circle cx="12" cy="12" r="3.1" /><path d="M19.4 14.5a1.7 1.7 0 0 0 .35 1.9l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.9.35l-.06.06A2 2 0 1 1 4.13 16.9l.06-.06a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.35-1.9l-.06-.06A2 2 0 1 1 7.07 4.1l.06.06a1.7 1.7 0 0 0 1.9.35H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.9-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.35 1.9V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></S>
);
export const IconGuide = (p: P) => (
  <S {...p}><path d="M4 5.5A2 2 0 0 1 6 3.5h5.5v17H6a2 2 0 0 0-2 2Z" /><path d="M20 5.5a2 2 0 0 0-2-2h-5.5v17H18a2 2 0 0 1 2 2Z" /></S>
);
export const IconContact = (p: P) => (
  <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.6 6.5 8.4 6 8.4-6" /></S>
);
export const IconLogout = (p: P) => (
  <S {...p}><path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" /><path d="M17 15.5 20.5 12 17 8.5" /><path d="M20 12H10" /></S>
);
export const IconGift = (p: P) => (
  <S {...p}><rect x="3.5" y="8.5" width="17" height="4" rx="1" /><path d="M5 12.5V20h14v-7.5" /><path d="M12 8.5V20" /><path d="M12 8.5S10.8 4 8.6 4a2.3 2.3 0 0 0 0 4.5Z" /><path d="M12 8.5S13.2 4 15.4 4a2.3 2.3 0 0 1 0 4.5Z" /></S>
);
export const IconCash = (p: P) => (
  <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11" /><path d="M14.8 9.2a2.9 2.9 0 0 0-2.8-1.4c-1.7 0-2.8.9-2.8 2.2 0 3 5.6 1.5 5.6 4.4 0 1.4-1.2 2.3-2.9 2.3a3 3 0 0 1-2.9-1.5" /></S>
);
export const IconClipboard = (p: P) => (
  <S {...p}><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2v1.3Z" /><path d="M8.8 11h6.4" /><path d="M8.8 14.8h4" /></S>
);
export const IconUpload = (p: P) => (
  <S {...p}><path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" /></S>
);
export const IconSearch = (p: P) => (
  <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></S>
);
export const IconBell = (p: P) => (
  <S {...p}><path d="M18 8.6a6 6 0 1 0-12 0c0 6-2 7.4-2 7.4h16s-2-1.4-2-7.4" /><path d="M13.7 19.4a2 2 0 0 1-3.4 0" /></S>
);
export const IconMonitor = (p: P) => (
  <S {...p}><rect x="2.5" y="4" width="19" height="12.5" rx="1.6" /><path d="M8.5 20.5h7" /><path d="M12 16.5v4" /></S>
);
export const IconUser = (p: P) => (
  <S {...p}><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></S>
);
export const IconChevron = (p: P) => (
  <S {...p}><path d="m9 5 7 7-7 7" /></S>
);
export const IconInbox = (p: P) => (
  <S {...p}><path d="M3.5 13.5h4l1.4 2.5h6.2l1.4-2.5h4" /><path d="M5.6 5.2h12.8l3.1 8.3V19a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-5.5Z" /></S>
);
export const IconCar = (p: P) => (
  <S {...p}><path d="M4.5 16.5v2a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8v-2" /><path d="M21.8 16.5v2a.8.8 0 0 1-.8.8h-.7a.8.8 0 0 1-.8-.8v-2" /><path d="M2.5 16.5h19v-4.2l-1.6-.6-2-4.4a1.6 1.6 0 0 0-1.5-1H7.6a1.6 1.6 0 0 0-1.5 1l-2 4.4-1.6.6Z" /><circle cx="6.8" cy="13.8" r="1.1" /><circle cx="17.2" cy="13.8" r="1.1" /></S>
);
export const IconFire = (p: P) => (
  <S {...p}><path d="M12 2.5s5.5 4.4 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2 1-3.6 1.9-4.6.3 1.4 1.2 2.3 2.1 2.3 1.3 0 2-1.4 1.5-7.1Z" /></S>
);

// Split shield: the two halves are the two payment records every policy
// carries — what the client owes the agency, what the agency owes the
// principal. Brand red and its tint, so it holds on light and dark alike.
export const Logo = ({ className }: P) => (
  <svg viewBox="0 0 48 48" className={className ?? 'h-7 w-7'} aria-hidden="true">
    <path d="M23.1 4.2 6 9.4V24c0 9.5 7.1 16.5 17.1 20Z" fill="#d0342c" />
    <path d="M24.9 4.2 42 9.4V24c0 9.5-7.1 16.5-17.1 20Z" fill="#f0837b" />
  </svg>
);
