import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const CashIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
    <circle cx="12" cy="12" r="10.5" fill="#ffc53d" stroke="#1d1d22" strokeWidth="2" />
    <circle cx="12" cy="12" r="7" fill="none" stroke="#b97700" strokeWidth="1.5" />
    <circle cx="8.6" cy="8.8" r="2" fill="#b97700" />
    <circle cx="15.4" cy="8.8" r="2" fill="#b97700" />
    <ellipse cx="12" cy="12.6" rx="3.6" ry="3.2" fill="#b97700" />
    <circle cx="12" cy="16.2" r="0.9" fill="#1d1d22" />
  </svg>
);

export const PauseIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const PlayIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const GearIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3" />
  </svg>
);

export const BackIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M15 4.5L7.5 12 15 19.5" />
  </svg>
);

export const CloseIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
  </svg>
);

export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

export const LockIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </svg>
);

export const BagIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 8h14l-1.2 12.5H6.2z" fill="currentColor" fillOpacity="0.15" />
    <path d="M9 8V6.5a3 3 0 016 0V8" />
    <path d="M12 12.2l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="currentColor" stroke="none" />
  </svg>
);

export const ShirtIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M8 3.5l-5 3 2 4 2-1v11h10v-11l2 1 2-4-5-3c-.6 1.6-2 2.6-4 2.6s-3.4-1-4-2.6z" />
  </svg>
);

export const BoardIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="2.5" y="8.5" width="19" height="5" rx="2.5" />
    <circle cx="7" cy="17" r="1.6" />
    <circle cx="17" cy="17" r="1.6" />
  </svg>
);

export const TrophyIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7.5 4h9v4.5a4.5 4.5 0 01-9 0z" />
    <path d="M7.5 6H4.5a3 3 0 003 3.5M16.5 6h3a3 3 0 01-3 3.5M12 13v3.5M8.5 20.5h7M9.5 16.5h5v4h-5z" />
  </svg>
);

export const ChartIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 20.5h16M6.5 17v-5M11 17V7M15.5 17v-8M20 17V4.5" />
  </svg>
);

export const TargetIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const TvIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="3" y="6.5" width="18" height="12.5" rx="2" />
    <path d="M8.5 2.5l3.5 4 3.5-4M10 10.5v5l4-2.5z" />
  </svg>
);

export const RotateIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M20 12a8 8 0 11-2.4-5.7M20 4.5v4.5h-4.5" />
  </svg>
);

export const SparkIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" fill="currentColor" stroke="none" />
  </svg>
);

export const GuardIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M3.5 9.5c2-4 15-4 17 0l-1.5 1.5h-14z" fill="#1f2a4d" stroke="#0d1226" strokeWidth="1" />
    <rect x="10.4" y="6" width="3.2" height="2.6" rx="0.6" fill="#ffd23f" />
    <rect x="6" y="11" width="12" height="9" rx="3" fill="#e2a679" />
    <rect x="7.6" y="13" width="8.8" height="2" rx="1" fill="#1d1d22" />
    <rect x="8.5" y="16.6" width="7" height="1.6" rx="0.8" fill="#5a3a22" />
  </svg>
);
