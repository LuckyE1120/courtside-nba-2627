import names from './player-names.json';

// Cached 2026–27 roster names, primarily from https://www.laigame.cn/player/.
// ESPN and the roster source sometimes differ in accents, punctuation or suffixes.
function normalize(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const normalizedNames = new Map<string, string>();
for (const [english, chinese] of Object.entries(names)) {
  const key = normalize(english);
  if (!normalizedNames.has(key)) normalizedNames.set(key, chinese);
}

export function playerName(name: string): string {
  return normalizedNames.get(normalize(name)) || name;
}
