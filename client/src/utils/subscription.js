// Tier hierarchy: free < premium < all-inclusive
export const TIERS = ['free', 'premium', 'all-inclusive'];

export const TIER_LABELS = {
  free: 'Free',
  premium: 'Premium',
  'all-inclusive': 'All-Inclusive',
};

export const TIER_COLORS = {
  free: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  premium: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'all-inclusive': { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};

export const TIER_ICONS = {
  free: '🆓',
  premium: '⭐',
  'all-inclusive': '👑',
};

// Modules accessible on each tier (cumulative — premium includes free, all-inclusive includes both)
const FREE_MODULE_IDS = new Set([
  'dashboard', 'coaching', 'feedback', 'quotes', 'smart-goals', 'scores',
]);

const PREMIUM_MODULE_IDS = new Set([
  'visual-board', 'lob', 'urgency', 'eq-opex', 'eq',
  'vision', 'mindfulness',
  'lean', 'problem-solving', 'disc',
  'skills', 'training', 'mentoring', 'career',
]);

const ALL_INCLUSIVE_MODULE_IDS = new Set([
  'expert-coaching', // placeholder — new section
]);

export function requiredTier(moduleId) {
  if (FREE_MODULE_IDS.has(moduleId)) return 'free';
  if (PREMIUM_MODULE_IDS.has(moduleId)) return 'premium';
  if (ALL_INCLUSIVE_MODULE_IDS.has(moduleId)) return 'all-inclusive';
  return 'free'; // default — unknown IDs open
}

export function canAccess(userTier, moduleId) {
  return true; // all modules free during launch period
}

export function isLocked(moduleId, userTier) {
  return !canAccess(userTier, moduleId);
}
