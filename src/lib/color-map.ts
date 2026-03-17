/* ------------------------------------------------------------------ */
/*  Color-Word Mapping                                                 */
/*  Maps words to background color palettes based on their "energy"    */
/* ------------------------------------------------------------------ */

export interface ColorMapping {
  category: string;
  bgColor: string;         // Tailwind-friendly description for prompts
  cssGradient: string;     // CSS gradient for UI preview
  badgeClass: string;      // Tailwind badge classes
}

const COLOR_MAP: Record<string, { words: string[]; mapping: ColorMapping }> = {
  temperature_cold: {
    words: ["cold", "cool", "ice", "snow", "freeze", "winter", "chill"],
    mapping: {
      category: "Temperature (Cold)",
      bgColor: "soft icy blue wall with pale silver-white floor, cool-toned winter atmosphere",
      cssGradient: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)",
      badgeClass: "bg-blue-100 text-blue-700",
    },
  },
  temperature_hot: {
    words: ["hot", "warm", "fire", "burn", "heat", "sun", "summer"],
    mapping: {
      category: "Temperature (Hot)",
      bgColor: "warm coral-red wall with golden amber floor, sun-drenched warm atmosphere",
      cssGradient: "linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)",
      badgeClass: "bg-red-100 text-red-700",
    },
  },
  nature: {
    words: [
      "fast", "fly", "green", "tree", "grow", "rain", "water", "fish",
      "bird", "leaf", "grass", "wind", "sky", "cloud", "flower", "seed",
      "river", "lake", "ocean", "garden", "forest", "hill", "mountain",
    ],
    mapping: {
      category: "Nature",
      bgColor: "fresh mint green wall with soft sky blue accents, bright natural atmosphere",
      cssGradient: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
      badgeClass: "bg-emerald-100 text-emerald-700",
    },
  },
  action: {
    words: [
      "push", "hard", "stop", "go", "run", "jump", "kick", "pull",
      "hit", "throw", "catch", "climb", "fight", "break", "build",
      "slam", "crash", "smash", "punch", "lift", "carry", "drag",
    ],
    mapping: {
      category: "Action",
      bgColor: "energetic warm orange wall with soft lavender floor, dynamic playful atmosphere",
      cssGradient: "linear-gradient(135deg, #FED7AA 0%, #E9D5FF 100%)",
      badgeClass: "bg-orange-100 text-orange-700",
    },
  },
  emotion: {
    words: [
      "happy", "sad", "love", "like", "fear", "brave", "kind", "nice",
      "mad", "glad", "cry", "laugh", "smile", "hug", "miss", "care",
      "hope", "wish", "feel", "hurt",
    ],
    mapping: {
      category: "Emotion",
      bgColor: "soft warm pink wall with peachy cream floor, gentle heartfelt atmosphere",
      cssGradient: "linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)",
      badgeClass: "bg-pink-100 text-pink-700",
    },
  },
  sensory: {
    words: [
      "big", "small", "tall", "short", "long", "round", "soft", "loud",
      "quiet", "bright", "dark", "light", "heavy", "smooth", "rough",
      "wet", "dry", "sharp", "flat", "thick", "thin",
    ],
    mapping: {
      category: "Sensory",
      bgColor: "gentle yellow-cream wall with warm honey-gold floor, cozy inviting atmosphere",
      cssGradient: "linear-gradient(135deg, #FEF9C3 0%, #FDE68A 100%)",
      badgeClass: "bg-yellow-100 text-yellow-700",
    },
  },
  learning: {
    words: [
      "read", "book", "write", "draw", "play", "sing", "dance", "count",
      "find", "look", "see", "hear", "say", "tell", "ask", "know",
      "think", "learn", "try", "make", "help", "work", "open", "close",
    ],
    mapping: {
      category: "Learning",
      bgColor: "cheerful periwinkle blue wall with soft cream floor, bright educational atmosphere",
      cssGradient: "linear-gradient(135deg, #C7D2FE 0%, #A5B4FC 100%)",
      badgeClass: "bg-indigo-100 text-indigo-700",
    },
  },
  social: {
    words: [
      "friend", "share", "give", "take", "come", "here", "there",
      "with", "for", "new", "old", "good", "bad", "yes", "no",
      "please", "thank", "sorry", "hello", "bye",
    ],
    mapping: {
      category: "Social",
      bgColor: "warm teal wall with soft seafoam green floor, friendly welcoming atmosphere",
      cssGradient: "linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%)",
      badgeClass: "bg-teal-100 text-teal-700",
    },
  },
};

// Default for words that don't match any category
const DEFAULT_MAPPING: ColorMapping = {
  category: "General",
  bgColor: "flat solid soft lavender periwinkle purple wall with warm sandy beige tan floor",
  cssGradient: "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)",
  badgeClass: "bg-purple-100 text-purple-700",
};

/**
 * Look up the color mapping for a given word.
 * Returns the matching category or the default purple/lavender palette.
 */
export function getColorMapping(word: string): ColorMapping {
  const lower = word.toLowerCase().trim();

  for (const group of Object.values(COLOR_MAP)) {
    if (group.words.includes(lower)) {
      return group.mapping;
    }
  }

  return DEFAULT_MAPPING;
}

/**
 * Get all available color categories for display in the UI.
 */
export function getAllColorCategories(): { category: string; badgeClass: string; cssGradient: string; words: string[] }[] {
  return Object.values(COLOR_MAP).map((g) => ({
    category: g.mapping.category,
    badgeClass: g.mapping.badgeClass,
    cssGradient: g.mapping.cssGradient,
    words: g.words,
  }));
}
