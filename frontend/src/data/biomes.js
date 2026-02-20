/**
 * Pepper's Universe — Biome, Character, Achievement & Lore Data
 *
 * All visual assets are placeholder SVGs for now.
 * Each entity includes an `asset` key that maps to a future
 * illustration file once art is commissioned.
 */

// ---------------------------------------------------------------------------
// Biomes — 8 total (2 free, 4 earnable, 2 premium)
// ---------------------------------------------------------------------------

export const BIOMES = {
  peppers_home: {
    id: "peppers_home",
    name: "Pepper's Home",
    tagline: "Where every journey begins",
    description: "A cozy kitchen nook filled with cookbooks, dried herbs, and Pepper's reading chair.",
    unlockThreshold: 0,
    premium: false,
    palette: {
      bg: "#FFF8F0",
      accent: "#E8523F",
      surface: "#FFF1E6",
      text: "#3D2B1F",
      glow: "#FFD6CC",
    },
    timeOfDay: {
      morning: { bg: "#FFF8F0", glow: "#FFE8B0" },
      afternoon: { bg: "#FFF5E9", glow: "#FFD6A0" },
      evening: { bg: "#F5E6D8", glow: "#FFB088" },
      night: { bg: "#2C1810", glow: "#E8523F" },
    },
    nativeCharacters: ["pepper"],
    asset: "biome_peppers_home.svg",
  },

  sweet_garden: {
    id: "sweet_garden",
    name: "Sweet Garden",
    tagline: "For the tender-hearted reader",
    description: "A pastel flower garden with honeybees, lavender paths, and a wishing well.",
    unlockThreshold: 0,
    premium: false,
    palette: {
      bg: "#FFF5F8",
      accent: "#F4A0B5",
      surface: "#FFE8EF",
      text: "#4A2030",
      glow: "#FFD1E0",
    },
    timeOfDay: {
      morning: { bg: "#FFF5F8", glow: "#FFE0EB" },
      afternoon: { bg: "#FFF0F5", glow: "#FFCCD8" },
      evening: { bg: "#F0D0DD", glow: "#E899B0" },
      night: { bg: "#2A1520", glow: "#F4A0B5" },
    },
    nativeCharacters: ["honey"],
    asset: "biome_sweet_garden.svg",
  },

  spice_market: {
    id: "spice_market",
    name: "Spice Market",
    tagline: "Where flavors tell stories",
    description: "A bustling bazaar with saffron stalls, cinnamon barrels, and exotic aromas.",
    unlockThreshold: 100,
    premium: false,
    palette: {
      bg: "#FFF3E0",
      accent: "#D4740F",
      surface: "#FFE8CC",
      text: "#3E2500",
      glow: "#FFCC80",
    },
    timeOfDay: {
      morning: { bg: "#FFF3E0", glow: "#FFE0A0" },
      afternoon: { bg: "#FFEDCC", glow: "#FFD080" },
      evening: { bg: "#E8CFA0", glow: "#D4960F" },
      night: { bg: "#2A1800", glow: "#D4740F" },
    },
    nativeCharacters: ["cinnamon"],
    asset: "biome_spice_market.svg",
  },

  fire_plains: {
    id: "fire_plains",
    name: "Fire Plains",
    tagline: "Intensity burns bright here",
    description: "Cracked volcanic terrain with lava rivers, ember rain, and heat mirages.",
    unlockThreshold: 250,
    premium: false,
    palette: {
      bg: "#FFF0E0",
      accent: "#FF4500",
      surface: "#FFE0C0",
      text: "#401500",
      glow: "#FF8040",
    },
    timeOfDay: {
      morning: { bg: "#FFF0E0", glow: "#FFD0A0" },
      afternoon: { bg: "#FFE8D0", glow: "#FFC080" },
      evening: { bg: "#E0A878", glow: "#FF6030" },
      night: { bg: "#1A0800", glow: "#FF4500" },
    },
    nativeCharacters: ["blaze"],
    asset: "biome_fire_plains.svg",
  },

  inferno_peak: {
    id: "inferno_peak",
    name: "Inferno Peak",
    tagline: "Only the bold reach the summit",
    description: "A volcanic summit above the clouds with obsidian spires and molten gold streams.",
    unlockThreshold: 500,
    premium: false,
    palette: {
      bg: "#2A0A00",
      accent: "#FF6B00",
      surface: "#3D1500",
      text: "#FFE0C0",
      glow: "#FF8C00",
    },
    timeOfDay: {
      morning: { bg: "#3D1800", glow: "#FFA040" },
      afternoon: { bg: "#2A0A00", glow: "#FF8C00" },
      evening: { bg: "#1A0500", glow: "#FF6B00" },
      night: { bg: "#0D0200", glow: "#FF4500" },
    },
    nativeCharacters: ["ghost"],
    asset: "biome_inferno_peak.svg",
  },

  mystery_library: {
    id: "mystery_library",
    name: "Mystery Library",
    tagline: "Knowledge hides in every corner",
    description: "A towering library with floating books, secret passages, and whispering shelves.",
    unlockThreshold: 400,
    premium: false,
    palette: {
      bg: "#F0F4E8",
      accent: "#5B8C3E",
      surface: "#E0E8D0",
      text: "#1A2E10",
      glow: "#A0D070",
    },
    timeOfDay: {
      morning: { bg: "#F0F4E8", glow: "#C0D8A0" },
      afternoon: { bg: "#E8F0D8", glow: "#A8D080" },
      evening: { bg: "#C8D8B0", glow: "#7CB040" },
      night: { bg: "#101A08", glow: "#5B8C3E" },
    },
    nativeCharacters: ["sage"],
    asset: "biome_mystery_library.svg",
  },

  midnight_archive: {
    id: "midnight_archive",
    name: "Midnight Archive",
    tagline: "Where forbidden stories sleep",
    description: "An underground vault of banned books, glowing runes, and shadow-bound manuscripts.",
    unlockThreshold: 750,
    premium: true,
    palette: {
      bg: "#1A1028",
      accent: "#9B59B6",
      surface: "#2D1840",
      text: "#E0D0F0",
      glow: "#C084FC",
    },
    timeOfDay: {
      morning: { bg: "#2D1840", glow: "#B070D8" },
      afternoon: { bg: "#1A1028", glow: "#9B59B6" },
      evening: { bg: "#120820", glow: "#8040A0" },
      night: { bg: "#080410", glow: "#6B2FA0" },
    },
    nativeCharacters: ["shadow"],
    asset: "biome_midnight_archive.svg",
  },

  crystal_cove: {
    id: "crystal_cove",
    name: "Crystal Cove",
    tagline: "Rare and luminous",
    description: "A shimmering sea cave with bioluminescent pools, pearl deposits, and crystal formations.",
    unlockThreshold: 1000,
    premium: true,
    palette: {
      bg: "#F0F8FF",
      accent: "#4FC3F7",
      surface: "#E0F0FF",
      text: "#0A2540",
      glow: "#80D8FF",
    },
    timeOfDay: {
      morning: { bg: "#F0F8FF", glow: "#B0E0FF" },
      afternoon: { bg: "#E0F0FF", glow: "#80D8FF" },
      evening: { bg: "#B0D0E8", glow: "#4FC3F7" },
      night: { bg: "#081828", glow: "#2196F3" },
    },
    nativeCharacters: ["pearl"],
    asset: "biome_crystal_cove.svg",
  },
};

// ---------------------------------------------------------------------------
// Characters — 8 total, each native to a biome
// ---------------------------------------------------------------------------

export const CHARACTERS = {
  pepper: {
    id: "pepper",
    name: "Pepper",
    title: "The Honest Critic",
    personality: "Witty, blunt, fiercely honest. Loves quality writing and has zero patience for lazy prose.",
    homeBiome: "peppers_home",
    unlockThreshold: 0,
    rarity: "common",
    palette: { primary: "#E8523F", secondary: "#FF8A78" },
    phrases: {
      greeting: "Ready to judge some books?",
      discovery: "Finally, someone with taste.",
      streak: "Back again? I respect consistency.",
    },
    asset: "char_pepper.svg",
  },

  honey: {
    id: "honey",
    name: "Honey",
    title: "The Sweetheart",
    personality: "Warm, encouraging, always sees the best in a story. Loves clean romance and HEAs.",
    homeBiome: "sweet_garden",
    unlockThreshold: 0,
    rarity: "common",
    palette: { primary: "#F4A0B5", secondary: "#FFD1E0" },
    phrases: {
      greeting: "Oh, a new reader! How exciting!",
      discovery: "Every book deserves a chance, don't you think?",
      streak: "You came back! That makes me so happy!",
    },
    asset: "char_honey.svg",
  },

  cinnamon: {
    id: "cinnamon",
    name: "Cinnamon",
    title: "The Merchant",
    personality: "Charismatic, worldly, a collector of rare editions. Knows a deal when she sees one.",
    homeBiome: "spice_market",
    unlockThreshold: 100,
    rarity: "uncommon",
    palette: { primary: "#D4740F", secondary: "#FFCC80" },
    phrases: {
      greeting: "Welcome to the market. Looking for something specific?",
      discovery: "Ah, a rare find. You have good instincts.",
      streak: "A regular customer. I like that.",
    },
    asset: "char_cinnamon.svg",
  },

  blaze: {
    id: "blaze",
    name: "Blaze",
    title: "The Provocateur",
    personality: "Bold, unapologetic, thrives on intensity. Recommends the spiciest reads without flinching.",
    homeBiome: "fire_plains",
    unlockThreshold: 250,
    rarity: "uncommon",
    palette: { primary: "#FF4500", secondary: "#FF8040" },
    phrases: {
      greeting: "Think you can handle the heat?",
      discovery: "Now THAT'S what I'm talking about.",
      streak: "You keep coming back for more. I respect that.",
    },
    asset: "char_blaze.svg",
  },

  ghost: {
    id: "ghost",
    name: "Ghost",
    title: "The Enigma",
    personality: "Mysterious, appears only at milestones. Speaks in riddles and cryptic book references.",
    homeBiome: "inferno_peak",
    unlockThreshold: 500,
    rarity: "rare",
    palette: { primary: "#B0BEC5", secondary: "#ECEFF1" },
    phrases: {
      greeting: "...you can see me?",
      discovery: "Some stories exist between the lines.",
      streak: "Persistence reveals what haste cannot.",
    },
    asset: "char_ghost.svg",
  },

  sage: {
    id: "sage",
    name: "Sage",
    title: "The Scholar",
    personality: "Wise, methodical, deeply analytical. Reads for craft and form above all else.",
    homeBiome: "mystery_library",
    unlockThreshold: 400,
    rarity: "rare",
    palette: { primary: "#5B8C3E", secondary: "#A0D070" },
    phrases: {
      greeting: "Knowledge is the one currency that multiplies when shared.",
      discovery: "Interesting. This warrants further study.",
      streak: "Discipline is the foundation of mastery.",
    },
    asset: "char_sage.svg",
  },

  shadow: {
    id: "shadow",
    name: "Shadow",
    title: "The Archivist",
    personality: "Secretive, guardian of forbidden knowledge. Only appears in the darkest biomes.",
    homeBiome: "midnight_archive",
    unlockThreshold: 750,
    rarity: "epic",
    palette: { primary: "#9B59B6", secondary: "#C084FC" },
    phrases: {
      greeting: "You've ventured far to reach these shelves.",
      discovery: "This story was hidden for a reason.",
      streak: "The archive remembers those who return.",
    },
    asset: "char_shadow.svg",
  },

  pearl: {
    id: "pearl",
    name: "Pearl",
    title: "The Luminary",
    personality: "Radiant, serene, speaks only in profound truths. The rarest character to encounter.",
    homeBiome: "crystal_cove",
    unlockThreshold: 1000,
    rarity: "legendary",
    palette: { primary: "#4FC3F7", secondary: "#80D8FF" },
    phrases: {
      greeting: "Light finds those who seek it.",
      discovery: "This one shines from within.",
      streak: "Like the tide, you always return.",
    },
    asset: "char_pearl.svg",
  },
};

// ---------------------------------------------------------------------------
// Achievements — badges with unlock criteria
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS = {
  // Action-based
  first_scanner: {
    id: "first_scanner",
    name: "First Scan",
    description: "Request your first book score",
    icon: "magnifying-glass",
    category: "action",
    rarity: "common",
  },
  bookworm: {
    id: "bookworm",
    name: "Bookworm",
    description: "View 100 book profiles",
    icon: "book-open",
    category: "action",
    rarity: "rare",
  },
  hidden_gem_hunter: {
    id: "hidden_gem_hunter",
    name: "Hidden Gem Hunter",
    description: "Discover 10 hidden gems",
    icon: "gem",
    category: "action",
    rarity: "epic",
  },
  spice_explorer: {
    id: "spice_explorer",
    name: "Spice Explorer",
    description: "View a book at spice level 6",
    icon: "flame",
    category: "action",
    rarity: "uncommon",
  },

  // Streak-based
  streak_3: {
    id: "streak_3",
    name: "Getting Started",
    description: "3-day reading streak",
    icon: "fire-small",
    category: "streak",
    rarity: "common",
  },
  streak_7: {
    id: "streak_7",
    name: "Week Warrior",
    description: "7-day reading streak",
    icon: "fire-medium",
    category: "streak",
    rarity: "uncommon",
  },
  streak_14: {
    id: "streak_14",
    name: "Fortnight Focus",
    description: "14-day reading streak",
    icon: "fire-large",
    category: "streak",
    rarity: "rare",
  },
  streak_30: {
    id: "streak_30",
    name: "Streak Master",
    description: "30-day reading streak",
    icon: "fire-legendary",
    category: "streak",
    rarity: "legendary",
  },
  streak_master: {
    id: "streak_master",
    name: "Streak Master",
    description: "Achieve a 30-day streak (legacy)",
    icon: "fire-legendary",
    category: "streak",
    rarity: "legendary",
  },
};

// ---------------------------------------------------------------------------
// Lore Cards — collectible story fragments about Pepper's Universe
// ---------------------------------------------------------------------------

export const LORE_CARDS = [
  {
    id: "lore_origins",
    title: "The Origin of StyleScope",
    text: "Long before algorithms, there was a pepper who refused to accept bad prose. She built a machine that could measure the craft behind every story.",
    rarity: "common",
    biome: "peppers_home",
    unlockCondition: { type: "points", threshold: 50 },
  },
  {
    id: "lore_sweet_garden",
    title: "The Sweet Garden's Secret",
    text: "Honey planted the first flower in the garden — a rosemary bush that only bloomed when someone nearby was reading a clean romance.",
    rarity: "common",
    biome: "sweet_garden",
    unlockCondition: { type: "biome_visit", biome: "sweet_garden" },
  },
  {
    id: "lore_spice_trade",
    title: "The Great Spice Trade",
    text: "Cinnamon once traded a first-edition manuscript for a barrel of saffron. She still says she got the better deal.",
    rarity: "uncommon",
    biome: "spice_market",
    unlockCondition: { type: "points", threshold: 150 },
  },
  {
    id: "lore_fire_ritual",
    title: "Trial by Fire",
    text: "Blaze believes every book should be tested by fire. The ones that survive are worth reading. The rest were kindling all along.",
    rarity: "uncommon",
    biome: "fire_plains",
    unlockCondition: { type: "achievement", achievementId: "streak_7" },
  },
  {
    id: "lore_ghost_sighting",
    title: "The First Sighting",
    text: "Nobody knows when Ghost first appeared. Some say she's been reading in the shadows since the first story was told.",
    rarity: "rare",
    biome: "inferno_peak",
    unlockCondition: { type: "character_unlock", characterId: "ghost" },
  },
  {
    id: "lore_sage_wisdom",
    title: "Sage's First Lesson",
    text: "Sage once read a book so poorly written that she wept. Not for the story, but for the wasted potential of every misplaced comma.",
    rarity: "rare",
    biome: "mystery_library",
    unlockCondition: { type: "points", threshold: 500 },
  },
  {
    id: "lore_shadow_archive",
    title: "The Banned Collection",
    text: "Shadow guards the books that were too dangerous to publish. Not because of their content — because of what they revealed about their authors.",
    rarity: "epic",
    biome: "midnight_archive",
    unlockCondition: { type: "biome_visit", biome: "midnight_archive" },
  },
  {
    id: "lore_pearl_prophecy",
    title: "Pearl's Prophecy",
    text: "Pearl says there is one book that, when read, will change everything. She has been searching for it since the first wave touched the shore.",
    rarity: "legendary",
    biome: "crystal_cove",
    unlockCondition: { type: "points", threshold: 1000 },
  },
];

// ---------------------------------------------------------------------------
// Rarity colors — for consistent badge / card styling
// ---------------------------------------------------------------------------

export const RARITY_COLORS = {
  common:    { bg: "#E8E8E8", text: "#555", border: "#CCC" },
  uncommon:  { bg: "#D4EDDA", text: "#2D6A4F", border: "#95D5B2" },
  rare:      { bg: "#D0E8FF", text: "#1A5276", border: "#85C1E9" },
  epic:      { bg: "#E8D5F5", text: "#6B2FA0", border: "#C084FC" },
  legendary: { bg: "#FFF3CD", text: "#856404", border: "#FFD700" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getBiome(biomeId) {
  return BIOMES[biomeId] || BIOMES.peppers_home;
}

export function getCharacter(charId) {
  return CHARACTERS[charId] || CHARACTERS.pepper;
}

export function getAchievement(achId) {
  return ACHIEVEMENTS[achId] || null;
}

export function getBiomePalette(biomeId, timeOfDay = null) {
  const biome = getBiome(biomeId);
  if (timeOfDay && biome.timeOfDay?.[timeOfDay]) {
    return { ...biome.palette, ...biome.timeOfDay[timeOfDay] };
  }
  return biome.palette;
}

export function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}
