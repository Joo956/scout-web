import { useState } from "react";

function Icon({ className = "h-5 w-5", children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const GridIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const BoxIcon = (p) => (
  <Icon {...p}>
    <path d="M21 8.5v7a2 2 0 0 1-1 1.73l-6 3.5a2 2 0 0 1-2 0l-6-3.5a2 2 0 0 1-1-1.73v-7a2 2 0 0 1 1-1.73l6-3.5a2 2 0 0 1 2 0l6 3.5a2 2 0 0 1 1 1.73Z" />
    <path d="m3.3 7.3 8.7 5 8.7-5M12 22v-9.5" />
  </Icon>
);

export const ClipboardIcon = (p) => (
  <Icon {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V4ZM9 10h6M9 14h6M9 18h3" />
  </Icon>
);

export const CartIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3.5h2.2l2.5 12h11.6l2.2-8.5H6.1" />
  </Icon>
);

export const MegaphoneIcon = (p) => (
  <Icon {...p}>
    <path d="m3 11 14-6v14L3 13v-2Z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6M17 9.5a3 3 0 0 1 0 5" />
  </Icon>
);

export const MenuIcon = (p) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const XIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

export const BellIcon = (p) => (
  <Icon {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 21a2 2 0 0 0 3.4 0" />
  </Icon>
);

export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const EditIcon = (p) => (
  <Icon {...p}>
    <path d="M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15 17 3.5Z" />
  </Icon>
);

export const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M19 6l-1 14a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 20L5 6M10 11v6M14 11v6" />
  </Icon>
);

export const TrendUpIcon = (p) => (
  <Icon {...p}>
    <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />
  </Icon>
);

export const AlertIcon = (p) => (
  <Icon {...p}>
    <path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />
  </Icon>
);

export const DollarIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15 8.5c-.6-1-1.7-1.5-3-1.5-1.8 0-3 1-3 2.5S10.5 12 12 12s3 .9 3 2.5-1.2 2.5-3 2.5c-1.3 0-2.4-.5-3-1.5M12 5v14" />
  </Icon>
);

export const UsersIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3 3.4-5 6.5-5s5.7 2 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 15.4c1.6.8 2.7 2.3 3 4.6" />
  </Icon>
);

export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);

export const ListIcon = (p) => (
  <Icon {...p}>
    <path d="M8.5 6.5H21M8.5 12H21M8.5 17.5H21M4 6.5h.01M4 12h.01M4 17.5h.01" />
  </Icon>
);

export const ChartIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </Icon>
);

export const PinIcon = (p) => (
  <Icon {...p}>
    <path d="M12 17v5M7 3h10l-1.5 6.5 2.5 3H6l2.5-3L7 3Z" />
  </Icon>
);

export const LogoutIcon = (p) => (
  <Icon {...p}>
    <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9M15 16.5 19.5 12 15 7.5M19.5 12H9" />
  </Icon>
);

export const HelpIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 1.8-2.6 2.3-2.6 4M12 17.5h.01" />
  </Icon>
);

export const CompassMarkIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const BookIcon = (p) => (
  <Icon {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z" />
    <path d="M9 7.5h7" />
  </Icon>
);

export const MedalIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m8.8 13.8-1.8 7 5-2.6 5 2.6-1.8-7" />
  </Icon>
);

export const GlobeIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
  </Icon>
);

export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
);

export const ArrowRightIcon = (p) => (
  <Icon {...p}>
    <path d="M4 12h16M13 5l7 7-7 7" />
  </Icon>
);

export const DownloadIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </Icon>
);

export const StarIcon = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    className={p.className ?? "h-5 w-5"}
    aria-hidden="true"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
  </svg>
);

export const KeyIcon = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.2-8.2M16 7l3 3M14 9l2 2" />
  </Icon>
);

export const ChevronDownIcon = (p) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronUpIcon = (p) => (
  <Icon {...p}>
    <path d="m18 15-6-6-6 6" />
  </Icon>
);

// ✅ UploadIcon مضافة مرة واحدة فقط
export const UploadIcon = (p) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </Icon>
);