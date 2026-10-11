import { useMemo } from 'react';
import type { CatalogItem } from '../config/catalog';
import { boardGraphicDataUrl } from '../render/textures';

/**
 * Flat catalogue illustrations, drawn as SVG from the same item data that
 * builds the 3D meshes (silhouette per kind, colours and patterns per item).
 */
const INK = '#1d1d22';

function Fill({ id, item }: { id: string; item: CatalogItem }) {
  const v = item.visual;
  const a = v.primary;
  const b = v.secondary ?? INK;
  switch (v.shimmer ? 'holo' : v.pattern) {
    case 'stripes':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={a} />
          <rect width="12" height="5" fill={b} />
        </pattern>
      );
    case 'plaid':
      return (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill={a} />
          <rect x="0" width="6" height="16" fill={b} opacity="0.5" />
          <rect y="0" width="16" height="6" fill={b} opacity="0.5" />
          <rect x="10" width="1.5" height="16" fill={v.accent ?? '#fff'} opacity="0.7" />
        </pattern>
      );
    case 'checker':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={a} />
          <rect width="6" height="6" fill={b} />
          <rect x="6" y="6" width="6" height="6" fill={b} />
        </pattern>
      );
    case 'denim':
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={a} />
          <path d="M0 6L6 0" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
        </pattern>
      );
    case 'holo':
      return (
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8f3ff" />
          <stop offset="0.35" stopColor="#ff9be8" />
          <stop offset="0.65" stopColor="#fff4a8" />
          <stop offset="1" stopColor="#a8ffcf" />
        </linearGradient>
      );
    default:
      return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
      );
  }
}

function Shape({ item, fill }: { item: CatalogItem; fill: string }) {
  const v = item.visual;
  const sec = v.secondary ?? INK;
  const acc = v.accent ?? sec;
  const st = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (v.kind) {
    case 'tee':
    case 'oversized': {
      const w = v.kind === 'oversized' ? 4 : 0;
      return (
        <g>
          <path d={`M${30 - w} 22 L42 15 Q50 24 58 15 L${70 + w} 22 L${86 + w} 38 L${75 + w} 47 L${68 + w} 41 L${68 + w} ${86 + w} L${32 - w} ${86 + w} L${32 - w} 41 L${25 - w} 47 L${14 - w} 38 Z`} fill={fill} {...st} />
          {v.print && <circle cx="50" cy="50" r="10" fill={v.accent ?? '#ff4f9a'} stroke={INK} strokeWidth="2" />}
        </g>
      );
    }
    case 'tank':
      return <path d="M36 15 L44 15 Q50 28 56 15 L64 15 L66 38 L69 86 L31 86 L34 38 Z" fill={fill} {...st} />;
    case 'hoodie':
    case 'windbreaker':
    case 'varsity':
    case 'bomber':
    case 'flannel': {
      const sleeve = v.kind === 'varsity' ? sec : v.kind === 'windbreaker' ? sec : fill;
      return (
        <g>
          <path d="M33 22 L18 34 L12 78 L24 80 L30 46 Z" fill={sleeve} {...st} />
          <path d="M67 22 L82 34 L88 78 L76 80 L70 46 Z" fill={sleeve} {...st} />
          <path d="M33 22 L42 16 Q50 24 58 16 L67 22 L70 86 L30 86 Z" fill={v.kind === 'flannel' ? fill : fill} {...st} />
          {v.kind === 'hoodie' && <path d="M38 18 Q50 6 62 18 Q50 28 38 18 Z" fill={sec} {...st} />}
          {v.kind === 'hoodie' && <rect x="38" y="60" width="24" height="12" rx="3" fill={sec} {...st} />}
          {v.kind === 'flannel' && <path d="M44 22 L50 86 L56 22" fill="#f4f1e8" {...st} />}
          {v.kind === 'windbreaker' && <rect x="30.5" y="44" width="39" height="10" fill={acc} stroke={INK} strokeWidth="2" />}
          {v.kind === 'varsity' && <text x="38" y="52" fontFamily="Bungee, sans-serif" fontSize="14" fill={acc} stroke={INK} strokeWidth="1">M</text>}
          {(v.kind === 'varsity' || v.kind === 'bomber') && <rect x="30" y="80" width="40" height="6" fill={v.kind === 'bomber' ? '#2a2a40' : acc} {...st} />}
        </g>
      );
    }
    case 'jeans':
    case 'chinos':
    case 'track':
    case 'cargo':
    case 'baggy':
    case 'parachute':
    case 'shorts': {
      const wide = v.kind === 'parachute' ? 8 : v.kind === 'baggy' ? 6 : v.kind === 'cargo' ? 4 : 0;
      const bottom = v.kind === 'shorts' ? 56 : 88;
      return (
        <g>
          <path d={`M30 12 L70 12 L${72 + wide} ${bottom} L${54} ${bottom} L50 36 L${46} ${bottom} L${28 - wide} ${bottom} Z`} fill={fill} {...st} />
          <rect x="30" y="12" width="40" height="7" fill={fill} {...st} />
          {v.kind === 'track' && (
            <>
              <path d={`M31 20 L${29 - wide} ${bottom}`} stroke={sec} strokeWidth="4" />
              <path d={`M69 20 L${71 + wide} ${bottom}`} stroke={sec} strokeWidth="4" />
            </>
          )}
          {v.kind === 'cargo' && (
            <>
              <rect x="24" y="48" width="12" height="14" rx="2" fill={sec} stroke={INK} strokeWidth="2" />
              <rect x="64" y="48" width="12" height="14" rx="2" fill={sec} stroke={INK} strokeWidth="2" />
            </>
          )}
        </g>
      );
    }
    case 'lowtop':
    case 'slipon':
    case 'puffy':
    case 'hightop':
    case 'boots': {
      const tall = v.kind === 'boots' ? 30 : v.kind === 'hightop' ? 24 : 0;
      const puff = v.kind === 'puffy' ? 6 : 0;
      return (
        <g>
          <path d={`M18 ${60 - tall} L46 ${60 - tall} L50 56 Q66 52 82 62 Q88 70 82 74 L18 74 Z`} fill={fill} transform={`translate(0 ${puff ? -3 : 0}) scale(1 ${1 + puff / 60})`} {...st} />
          <rect x="15" y="72" width="70" height={8 + puff / 2} rx="3" fill={v.glow ?? sec} {...st} />
          {v.kind !== 'slipon' && <path d="M40 58 L56 54 M42 64 L60 60" stroke={v.kind === 'boots' ? '#d9b47a' : '#f4f1e8'} strokeWidth="3" />}
        </g>
      );
    }
    case 'beanie':
      return (
        <g>
          <path d="M22 62 Q22 22 50 22 Q78 22 78 62 Z" fill={fill} {...st} />
          <rect x="18" y="58" width="64" height="16" rx="4" fill={sec} {...st} />
        </g>
      );
    case 'cap':
    case 'capBack':
      return (
        <g>
          <path d="M22 62 Q22 26 50 26 Q78 26 78 62 Z" fill={fill} {...st} />
          <path d={v.kind === 'cap' ? 'M70 60 Q92 60 94 70 L62 70 Z' : 'M30 60 Q8 60 6 70 L38 70 Z'} fill={v.kind === 'capBack' ? sec : fill} {...st} />
          {v.accent && <rect x="40" y="40" width="20" height="10" rx="2" fill={v.accent} stroke={INK} strokeWidth="2" />}
        </g>
      );
    case 'bucket':
      return (
        <g>
          <path d="M28 58 L32 26 L68 26 L72 58 Z" fill={fill} {...st} />
          <path d="M12 66 Q50 50 88 66 Q50 78 12 66 Z" fill={fill} {...st} />
        </g>
      );
    case 'helmet':
      return (
        <g>
          <path d="M18 66 Q18 18 50 18 Q82 18 82 66 Z" fill={fill} {...st} />
          <circle cx="38" cy="40" r="6" fill={acc} stroke={INK} strokeWidth="2" />
          <path d="M60 32 l3 6 6 1-5 4 2 6-6-3-6 3 2-6-5-4 6-1z" fill="#ffd23f" stroke={INK} strokeWidth="1.5" />
        </g>
      );
    case 'visor':
      return (
        <g>
          <rect x="18" y="44" width="64" height="12" rx="5" fill={fill} {...st} />
          <path d="M60 52 Q90 52 92 64 L56 62 Z" fill={fill} {...st} />
          {v.glow && <rect x="20" y="47" width="60" height="4" fill={v.glow} />}
        </g>
      );
    case 'crown':
      return (
        <g>
          <path d="M18 70 L22 32 L36 52 L50 26 L64 52 L78 32 L82 70 Z" fill={fill} {...st} />
          <circle cx="50" cy="58" r="5" fill={acc} stroke={INK} strokeWidth="2" />
        </g>
      );
    case 'wristbands':
      return (
        <g>
          <rect x="16" y="36" width="30" height="28" rx="10" fill={fill} {...st} />
          <rect x="54" y="36" width="30" height="28" rx="10" fill={fill} {...st} />
          <rect x="16" y="46" width="30" height="7" fill={sec} />
          <rect x="54" y="46" width="30" height="7" fill={sec} />
        </g>
      );
    case 'chain':
      return (
        <g fill="none" stroke={INK} strokeWidth="3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={22 + i * 11} cy={40 + Math.sin(i) * 12} rx="7" ry="5" fill="none" stroke={v.primary} strokeWidth="4" />
          ))}
          <rect x="72" y="52" width="18" height="22" rx="3" fill="#6b4426" stroke={INK} />
        </g>
      );
    case 'backpack':
      return (
        <g>
          <rect x="26" y="20" width="48" height="64" rx="12" fill={fill} {...st} />
          <rect x="34" y="52" width="32" height="22" rx="5" fill={sec} {...st} />
          <circle cx="40" cy="36" r="5" fill="#ff4f9a" stroke={INK} strokeWidth="2" />
          <path d="M58 32 l3 5 5 1-4 3 1 5-5-2-5 2 1-5-4-3 5-1z" fill="#ffd23f" stroke={INK} strokeWidth="1.2" />
        </g>
      );
    case 'shades':
      return (
        <g>
          <path d="M28 34 l5 10 11 2-8 7 2 11-10-6-10 6 2-11-8-7 11-2z" fill={fill} {...st} />
          <path d="M72 34 l5 10 11 2-8 7 2 11-10-6-10 6 2-11-8-7 11-2z" fill={fill} {...st} />
          <path d="M40 46 Q50 40 60 46" stroke={sec} strokeWidth="4" fill="none" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M22 62 Q22 18 50 18 Q78 18 78 62" fill="none" stroke={INK} strokeWidth="8" />
          <path d="M22 62 Q22 18 50 18 Q78 18 78 62" fill="none" stroke={v.primary} strokeWidth="4" />
          <rect x="12" y="52" width="20" height="28" rx="8" fill={fill} {...st} />
          <rect x="68" y="52" width="20" height="28" rx="8" fill={fill} {...st} />
          <rect x="17" y="58" width="10" height="16" rx="4" fill={sec} />
          <rect x="73" y="58" width="10" height="16" rx="4" fill={sec} />
        </g>
      );
    case 'boombox':
      return (
        <g>
          <path d="M30 34 Q50 14 70 34" fill="none" stroke={INK} strokeWidth="5" />
          <rect x="10" y="32" width="80" height="44" rx="6" fill={fill} {...st} />
          <circle cx="30" cy="56" r="12" fill={sec} stroke={INK} strokeWidth="2" />
          <circle cx="70" cy="56" r="12" fill={sec} stroke={INK} strokeWidth="2" />
          <rect x="42" y="40" width="16" height="8" fill={acc} stroke={INK} strokeWidth="2" />
        </g>
      );
    default:
      return <rect x="20" y="20" width="60" height="60" rx="10" fill={fill} {...st} />;
  }
}

export function ItemArt({ item, size = 72 }: { item: CatalogItem; size?: number }) {
  const id = useMemo(() => `f_${item.id}_${Math.random().toString(36).slice(2, 7)}`, [item.id]);
  if (item.slot === 'board' && item.visual.board) {
    const url = boardGraphicDataUrl(item.visual.board.graphic, item.visual.primary);
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="item-art">
        <defs>
          <clipPath id={`${id}_clip`}>
            <rect x="34" y="4" width="32" height="92" rx="16" />
          </clipPath>
        </defs>
        <g transform="rotate(18 50 50)">
          <g clipPath={`url(#${id}_clip)`}>
            <image href={url} x="4" y="34" width="92" height="32" preserveAspectRatio="none" transform="rotate(90 50 50)" />
          </g>
          <rect x="34" y="4" width="32" height="92" rx="16" fill="none" stroke={INK} strokeWidth="3" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="item-art">
      <defs>
        <Fill id={id} item={item} />
      </defs>
      <Shape item={item} fill={`url(#${id})`} />
    </svg>
  );
}
