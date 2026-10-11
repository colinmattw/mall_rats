/**
 * Cosmetic catalogue. Every item is purely visual: no item changes speed,
 * jump height, hitboxes, pressure, pickup value or score multipliers.
 *
 * All non-starter items are directly purchasable with Mall Cash at a fixed,
 * permanent price, and are also eligible for very rare bag drops.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ClothingSlot = 'headwear' | 'top' | 'bottom' | 'shoes' | 'accessory';
export type Slot = ClothingSlot | 'board';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const CLOTHING_SLOTS: ClothingSlot[] = ['headwear', 'top', 'bottom', 'shoes', 'accessory'];
export const ALL_SLOTS: Slot[] = [...CLOTHING_SLOTS, 'board'];
/** Slots that may be left empty. */
export const OPTIONAL_SLOTS: Slot[] = ['headwear', 'accessory'];

export const SLOT_LABELS: Record<Slot, string> = {
  headwear: 'Headwear',
  top: 'Tops',
  bottom: 'Bottoms',
  shoes: 'Shoes',
  accessory: 'Accessories',
  board: 'Boards',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#8fa3b8',
  uncommon: '#46c46b',
  rare: '#3d8bff',
  epic: '#a24dff',
  legendary: '#ffb21e',
};

export interface BoardParts {
  /** Deck graphic id (drawn procedurally). */
  graphic: string;
  /** Prepared for separately collectible wheels / grip tape later. */
  wheels: string;
  grip: string;
  trucks: string;
}

export interface ItemVisual {
  kind: string;
  primary: string;
  secondary?: string;
  accent?: string;
  pattern?: 'stripes' | 'plaid' | 'checker' | 'denim' | 'camo' | 'none';
  print?: string;
  glow?: string;
  shimmer?: boolean;
  metallic?: boolean;
  board?: BoardParts;
}

export interface CatalogItem {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  price: number;
  description: string;
  visual: ItemVisual;
  starter?: boolean;
  dropEligible: boolean;
  dropWeight: number;
  tags?: string[];
}

const item = (i: Omit<CatalogItem, 'dropEligible' | 'dropWeight'> & Partial<Pick<CatalogItem, 'dropEligible' | 'dropWeight'>>): CatalogItem => ({
  dropEligible: !i.starter,
  dropWeight: 1,
  ...i,
});

const board = (graphic: string, wheels = '#f4f1e8', grip = '#1d1d22', trucks = '#b9c0c8'): BoardParts => ({ graphic, wheels, grip, trucks });

export const STARTER_ITEMS: CatalogItem[] = [
  item({ id: 'top_shop_tee', name: 'Shop Tee', slot: 'top', rarity: 'common', price: 0, starter: true, description: 'Free with every first visit.', visual: { kind: 'tee', primary: '#f4f1e8', accent: '#ff4f9a', print: 'rat-logo' } }),
  item({ id: 'bottom_everyday_jeans', name: 'Everyday Jeans', slot: 'bottom', rarity: 'common', price: 0, starter: true, description: 'Broken in, never broken.', visual: { kind: 'jeans', primary: '#3d5a8a', pattern: 'denim' } }),
  item({ id: 'shoes_canvas_lows', name: 'Canvas Lows', slot: 'shoes', rarity: 'common', price: 0, starter: true, description: 'Classic grip, classic scuffs.', visual: { kind: 'lowtop', primary: '#e9e4d8', secondary: '#c0392b' } }),
  item({ id: 'board_shop_deck', name: 'Mall Rats Shop Deck', slot: 'board', rarity: 'common', price: 0, starter: true, description: 'The house deck from Board Room Skate.', visual: { kind: 'deck', primary: '#ff4f9a', board: board('shop') } }),
];

export const CATALOG_ITEMS: CatalogItem[] = [
  // Headwear
  item({ id: 'hat_cuffed_beanie', name: 'Cuffed Beanie', slot: 'headwear', rarity: 'common', price: 350, description: 'Warm head, cool attitude.', visual: { kind: 'beanie', primary: '#ffc53d', secondary: '#e0a21c' }, tags: ['coversHair'] }),
  item({ id: 'hat_dad_cap', name: 'Dad Cap', slot: 'headwear', rarity: 'common', price: 400, description: 'Curved brim, zero regrets.', visual: { kind: 'cap', primary: '#23366b', accent: '#f4f1e8' }, tags: ['coversHair'] }),
  item({ id: 'hat_snapback', name: 'Backwards Snapback', slot: 'headwear', rarity: 'uncommon', price: 950, description: 'Flat brim, flipped around.', visual: { kind: 'capBack', primary: '#141414', secondary: '#ff4f9a' }, tags: ['coversHair'] }),
  item({ id: 'hat_bucket', name: 'Checker Bucket Hat', slot: 'headwear', rarity: 'uncommon', price: 1200, description: 'Shade for indoor skylights.', visual: { kind: 'bucket', primary: '#f4f1e8', secondary: '#1d1d22', pattern: 'checker' }, tags: ['coversHair'] }),
  item({ id: 'hat_sticker_helmet', name: 'Sticker Helmet', slot: 'headwear', rarity: 'rare', price: 3000, description: 'Covered in stickers from every store.', visual: { kind: 'helmet', primary: '#29e3d4', accent: '#ff4f9a', print: 'stickers' }, tags: ['coversHair', 'fullHead'] }),
  item({ id: 'hat_neon_visor', name: 'Neon Visor', slot: 'headwear', rarity: 'epic', price: 7500, description: 'Glows like the arcade at closing time.', visual: { kind: 'visor', primary: '#1a1a2e', glow: '#29e3d4' } }),
  item({ id: 'hat_food_court_crown', name: 'Food Court Crown', slot: 'headwear', rarity: 'legendary', price: 18000, description: 'Ruler of every table in the food court.', visual: { kind: 'crown', primary: '#ffcf3a', accent: '#ff4f9a', metallic: true } }),

  // Tops
  item({ id: 'top_striped_tee', name: 'Striped Tee', slot: 'top', rarity: 'common', price: 300, description: 'Horizontal stripes, vertical ollies.', visual: { kind: 'tee', primary: '#f4f1e8', secondary: '#2f5bd3', pattern: 'stripes' } }),
  item({ id: 'top_pizza_tee', name: 'Pizza Orbit Tee', slot: 'top', rarity: 'common', price: 450, description: 'Merch from the best slice in the galaxy.', visual: { kind: 'tee', primary: '#1d1d22', accent: '#ff9f1c', print: 'pizza' } }),
  item({ id: 'top_mesh_tank', name: 'Mesh Tank', slot: 'top', rarity: 'common', price: 380, description: 'Maximum airflow for maximum air.', visual: { kind: 'tank', primary: '#7dff6a', secondary: '#1d1d22' } }),
  item({ id: 'top_oversized_tee', name: 'Oversized Tee', slot: 'top', rarity: 'uncommon', price: 900, description: 'Three sizes too big. Perfect.', visual: { kind: 'oversized', primary: '#a46bff', accent: '#ffd23f', print: 'smiley-star' } }),
  item({ id: 'top_pullover_hoodie', name: 'Pullover Hoodie', slot: 'top', rarity: 'uncommon', price: 1300, description: 'Kangaroo pocket for snacks.', visual: { kind: 'hoodie', primary: '#e84a5f', secondary: '#b5303f' } }),
  item({ id: 'top_flannel', name: 'Flannel Overshirt', slot: 'top', rarity: 'rare', price: 2800, description: 'Open flannel over a plain tee.', visual: { kind: 'flannel', primary: '#c0392b', secondary: '#1d1d22', accent: '#f4f1e8', pattern: 'plaid' } }),
  item({ id: 'top_windbreaker', name: 'Color-Block Windbreaker', slot: 'top', rarity: 'rare', price: 3600, description: 'Teal, purple and a lot of swish.', visual: { kind: 'windbreaker', primary: '#29e3d4', secondary: '#6c3cf0', accent: '#ff4f9a' } }),
  item({ id: 'top_varsity', name: 'Varsity Jacket', slot: 'top', rarity: 'epic', price: 8000, description: 'Lettered in skating, minored in loitering.', visual: { kind: 'varsity', primary: '#23366b', secondary: '#f4f1e8', accent: '#ffd23f', print: 'letter-m' } }),
  item({ id: 'top_holo_bomber', name: 'Holo Bomber', slot: 'top', rarity: 'legendary', price: 22000, description: 'Shifts color with every trick.', visual: { kind: 'bomber', primary: '#b8f3ff', secondary: '#ff9be8', shimmer: true } }),

  // Bottoms
  item({ id: 'bottom_skate_shorts', name: 'Skate Shorts', slot: 'bottom', rarity: 'common', price: 320, description: 'Knee-length and scab-friendly.', visual: { kind: 'shorts', primary: '#6b7b3a' } }),
  item({ id: 'bottom_work_chinos', name: 'Work Chinos', slot: 'bottom', rarity: 'common', price: 500, description: 'Straight leg, reinforced knees.', visual: { kind: 'chinos', primary: '#c8a46b' } }),
  item({ id: 'bottom_baggy_jeans', name: 'Baggy Jeans', slot: 'bottom', rarity: 'uncommon', price: 1100, description: 'You could fit a second skater in there.', visual: { kind: 'baggy', primary: '#5f86c4', pattern: 'denim' } }),
  item({ id: 'bottom_cargo', name: 'Cargo Pants', slot: 'bottom', rarity: 'uncommon', price: 1400, description: 'Pockets for every pocket.', visual: { kind: 'cargo', primary: '#4b5320', secondary: '#3a4019' } }),
  item({ id: 'bottom_track', name: 'Track Pants', slot: 'bottom', rarity: 'rare', price: 2600, description: 'Triple side stripes, zero tracks.', visual: { kind: 'track', primary: '#1d1d22', secondary: '#f4f1e8', accent: '#ff4f9a' } }),
  item({ id: 'bottom_parachute', name: 'Parachute Pants', slot: 'bottom', rarity: 'epic', price: 6500, description: 'Shiny, swishy and ready for takeoff.', visual: { kind: 'parachute', primary: '#d8d8e8', secondary: '#6c3cf0', metallic: true } }),

  // Shoes
  item({ id: 'shoes_checker_slipons', name: 'Checker Slip-Ons', slot: 'shoes', rarity: 'common', price: 420, description: 'No laces, no problem.', visual: { kind: 'slipon', primary: '#f4f1e8', secondary: '#1d1d22', pattern: 'checker' } }),
  item({ id: 'shoes_puffy_skate', name: 'Puffy Skate Shoes', slot: 'shoes', rarity: 'common', price: 580, description: 'Tongues out, padding up.', visual: { kind: 'puffy', primary: '#2a2a33', secondary: '#f4f1e8', accent: '#29e3d4' } }),
  item({ id: 'shoes_high_tops', name: 'High-Top Sneakers', slot: 'shoes', rarity: 'uncommon', price: 1000, description: 'Ankle support for questionable landings.', visual: { kind: 'hightop', primary: '#e84a5f', secondary: '#f4f1e8' } }),
  item({ id: 'shoes_work_boots', name: 'Work Boots', slot: 'shoes', rarity: 'rare', price: 2900, description: 'Steel toes, soft heart.', visual: { kind: 'boots', primary: '#8a5a2b', secondary: '#3b2a1a' } }),
  item({ id: 'shoes_neon_hightops', name: 'Neon High-Tops', slot: 'shoes', rarity: 'epic', price: 9000, description: 'Light-up soles. Batteries not included.', visual: { kind: 'hightop', primary: '#1d1d22', secondary: '#a46bff', glow: '#7dff6a' } }),
  item({ id: 'shoes_gold_kicks', name: 'Gold Kicks', slot: 'shoes', rarity: 'legendary', price: 16000, description: 'Solid-looking gold. Do not bite.', visual: { kind: 'puffy', primary: '#ffcf3a', secondary: '#fff1b0', metallic: true } }),

  // Accessories
  item({ id: 'acc_sweatbands', name: 'Sweatbands', slot: 'accessory', rarity: 'common', price: 300, description: 'Wrist and head-free hydration control.', visual: { kind: 'wristbands', primary: '#ff4f9a', secondary: '#f4f1e8' } }),
  item({ id: 'acc_wallet_chain', name: 'Wallet Chain', slot: 'accessory', rarity: 'uncommon', price: 850, description: 'Jingles on every ollie.', visual: { kind: 'chain', primary: '#c9d1d9', metallic: true } }),
  item({ id: 'acc_patch_backpack', name: 'Patch Backpack', slot: 'accessory', rarity: 'uncommon', price: 1250, description: 'Patched with pins from every store.', visual: { kind: 'backpack', primary: '#2f5bd3', secondary: '#ffd23f', print: 'patches' }, tags: ['back'] }),
  item({ id: 'acc_star_shades', name: 'Star Shades', slot: 'accessory', rarity: 'rare', price: 2500, description: 'Star-shaped lenses for star-shaped dreams.', visual: { kind: 'shades', primary: '#ff4f9a', secondary: '#1d1d22' } }),
  item({ id: 'acc_big_headphones', name: 'Big Headphones', slot: 'accessory', rarity: 'rare', price: 3200, description: 'Bass so deep the guard can hear it.', visual: { kind: 'headphones', primary: '#1d1d22', secondary: '#29e3d4' }, tags: ['overEars'] }),
  item({ id: 'acc_shoulder_boombox', name: 'Shoulder Boombox', slot: 'accessory', rarity: 'epic', price: 9500, description: 'Portable party. Heavy. Worth it.', visual: { kind: 'boombox', primary: '#c9d1d9', secondary: '#1d1d22', accent: '#ff4f9a' } }),

  // Boards
  item({ id: 'board_natural_maple', name: 'Natural Maple', slot: 'board', rarity: 'common', price: 300, description: 'Blank deck, pure wood grain.', visual: { kind: 'deck', primary: '#d9b47a', board: board('maple') } }),
  item({ id: 'board_graffiti', name: 'Graffiti Deck', slot: 'board', rarity: 'common', price: 450, description: 'Tagged behind the loading dock.', visual: { kind: 'deck', primary: '#29e3d4', board: board('graffiti', '#ffd23f') } }),
  item({ id: 'board_checkerboard', name: 'Checkerboard Deck', slot: 'board', rarity: 'common', price: 550, description: 'Black, white, timeless.', visual: { kind: 'deck', primary: '#1d1d22', board: board('checker', '#e84a5f') } }),
  item({ id: 'board_food_court', name: 'Food Court Deck', slot: 'board', rarity: 'uncommon', price: 1000, description: 'Pizza, fries and a malt on the bottom.', visual: { kind: 'deck', primary: '#ff9f1c', board: board('foodcourt', '#ff4f9a') } }),
  item({ id: 'board_flame', name: 'Flame Deck', slot: 'board', rarity: 'uncommon', price: 1200, description: 'Hot rod flames for hot laps.', visual: { kind: 'deck', primary: '#ff6b3d', board: board('flame', '#1d1d22') } }),
  item({ id: 'board_cassette', name: 'Mixtape Deck', slot: 'board', rarity: 'uncommon', price: 1500, description: 'Side A: rails. Side B: more rails.', visual: { kind: 'deck', primary: '#f4f1e8', board: board('cassette', '#29e3d4') } }),
  item({ id: 'board_bubblegum', name: 'Bubblegum Drip Deck', slot: 'board', rarity: 'rare', price: 2500, description: 'Sticky graphics, smooth grinds.', visual: { kind: 'deck', primary: '#ff8fc8', board: board('bubblegum', '#f4f1e8', '#3a1d33') } }),
  item({ id: 'board_sunset_grid', name: 'Sunset Grid Deck', slot: 'board', rarity: 'rare', price: 3000, description: 'Retro horizon, endless grid.', visual: { kind: 'deck', primary: '#6c3cf0', board: board('synth', '#ff4f9a') } }),
  item({ id: 'board_patrol_parody', name: 'Patrol Parody Deck', slot: 'board', rarity: 'rare', price: 3800, description: '"Please walk your board." Respectfully, no.', visual: { kind: 'deck', primary: '#23366b', board: board('security', '#ffd23f') } }),
  item({ id: 'board_galaxy', name: 'Galaxy Deck', slot: 'board', rarity: 'epic', price: 6500, description: 'A whole universe under your feet.', visual: { kind: 'deck', primary: '#1a1446', board: board('galaxy', '#a46bff') } }),
  item({ id: 'board_holo', name: 'Holo Deck', slot: 'board', rarity: 'epic', price: 9000, description: 'Holographic-inspired foil that shifts as you flip.', visual: { kind: 'deck', primary: '#c8f7ff', shimmer: true, board: board('holo', '#f4f1e8', '#2a2a40') } }),
  item({ id: 'board_neon_rat_king', name: 'Neon Rat King Deck', slot: 'board', rarity: 'legendary', price: 20000, description: 'The crowned mascot of every mall rat.', visual: { kind: 'deck', primary: '#0f0f1a', board: board('ratking', '#7dff6a', '#141420') } }),
  item({ id: 'board_black_gold', name: 'Black & Gold Deck', slot: 'board', rarity: 'legendary', price: 25000, description: 'Gold-leaf inspired pinstripes on midnight black.', visual: { kind: 'deck', primary: '#0d0d0d', metallic: true, board: board('blackgold', '#ffcf3a', '#0d0d0d', '#ffcf3a') } }),
];

export const ALL_ITEMS: CatalogItem[] = [...STARTER_ITEMS, ...CATALOG_ITEMS];
export const ITEMS_BY_ID: Record<string, CatalogItem> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));

export function getItem(id: string | null | undefined): CatalogItem | undefined {
  return id ? ITEMS_BY_ID[id] : undefined;
}

/** Tag pairs that clip badly when worn together. Equipping one removes the other. */
export const INCOMPATIBLE_TAGS: Array<[string, string]> = [['fullHead', 'overEars']];

export interface Loadout {
  headwear: string | null;
  top: string;
  bottom: string;
  shoes: string;
  accessory: string | null;
  board: string;
}

export const STARTER_LOADOUT: Loadout = {
  headwear: null,
  top: 'top_shop_tee',
  bottom: 'bottom_everyday_jeans',
  shoes: 'shoes_canvas_lows',
  accessory: null,
  board: 'board_shop_deck',
};

export interface Appearance {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  face: string;
}

export const SKIN_TONES = ['#f6d7c3', '#eac09e', '#d9a57c', '#c68a5d', '#a96d43', '#8a5232', '#6b3d24', '#4a2a19'];
export const HAIR_STYLES: Array<{ id: string; name: string }> = [
  { id: 'buzz', name: 'Buzz' },
  { id: 'spiky', name: 'Spiky' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'swoop', name: 'Swoop' },
  { id: 'long', name: 'Long' },
  { id: 'afro', name: 'Afro' },
  { id: 'bun', name: 'Top Bun' },
  { id: 'curly', name: 'Curly Top' },
];
export const HAIR_COLORS = ['#1b1512', '#3b2417', '#6b4426', '#8c3b1e', '#d9b46a', '#ece6d8', '#ff5fa8', '#2ad1c4', '#8b5cf6', '#6be05b'];
export const FACES: Array<{ id: string; name: string }> = [
  { id: 'grin', name: 'Grin' },
  { id: 'smirk', name: 'Smirk' },
  { id: 'chill', name: 'Chill' },
  { id: 'determined', name: 'Focused' },
  { id: 'surprised', name: 'Whoa' },
  { id: 'wink', name: 'Wink' },
];

export const DEFAULT_APPEARANCE: Appearance = {
  skinTone: SKIN_TONES[3]!,
  hairStyle: 'swoop',
  hairColor: HAIR_COLORS[1]!,
  face: 'grin',
};

/** Returns the item ids that conflict with `itemId` among a loadout's items. */
export function conflictingItems(itemId: string, loadout: Loadout): string[] {
  const it = getItem(itemId);
  if (!it?.tags?.length) return [];
  const out: string[] = [];
  for (const slot of ALL_SLOTS) {
    if (slot === it.slot) continue;
    const otherId = loadout[slot];
    const other = getItem(otherId);
    if (!other?.tags?.length) continue;
    for (const [a, b] of INCOMPATIBLE_TAGS) {
      if ((it.tags.includes(a) && other.tags.includes(b)) || (it.tags.includes(b) && other.tags.includes(a))) {
        out.push(other.id);
      }
    }
  }
  return out;
}
