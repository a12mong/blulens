/**
 * Team name normalization and suggestion matching (architecture.md §6.6, A8).
 * Pure: no Date, no Math.random, no I/O. Inputs not mutated.
 */

/**
 * Normalize a team name: Unicode NFC, Thai digits → Arabic, remove zero-width chars,
 * collapse whitespace, trim, lowercase.
 */
export function normalizeTeamName(input: string): string {
  // Step 1: Unicode NFC normalization
  let normalized = input.normalize('NFC');

  // Step 2: Convert Thai digits U+0E50..U+0E59 to ASCII 0..9
  let result = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= 0xe50 && code <= 0xe59) {
      // Thai digit: convert to ASCII digit
      result += String.fromCharCode(code - 0xe50 + 0x30);
    } else {
      result += normalized[i];
    }
  }

  // Step 3: Remove zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
  result = result.replace(/[​‌‍﻿]/g, '');

  // Step 4: Collapse whitespace runs (space, tab, NBSP, etc.) to single space
  result = result.replace(/\s+/g, ' ');

  // Step 5: Trim whitespace
  result = result.trim();

  // Step 6: Lowercase
  result = result.toLowerCase();

  return result;
}

/**
 * Calculate Levenshtein edit distance between two strings (UTF-16 code unit basis).
 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) {
    dp[i]![0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j;
  }

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * A team candidate for suggestion matching (name, alias, and pre-normalized key).
 */
export interface TeamNameCandidate {
  teamId: string;
  name: string;
  alias: string | null;
  key: string; // pre-normalized by caller
}

/**
 * A suggested team with matched details and distance metric.
 */
export interface TeamSuggestion {
  teamId: string;
  name: string;
  matchedAlias: string | null;
  distance: number;
}

/**
 * Suggest teams matching a query by prefix, word prefix, or small edit distance.
 * One suggestion per teamId (best match wins on tie-break). Sorted by distance, name, teamId.
 */
export function suggestTeams(
  query: string,
  candidates: readonly TeamNameCandidate[],
  limit = 8,
): TeamSuggestion[] {
  // Validate limit
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new RangeError('TEAM_SUGGEST_INVALID_LIMIT');
  }

  // Normalize query
  const q = normalizeTeamName(query);

  // Empty query returns no suggestions
  if (q === '') {
    return [];
  }

  // Build matches per teamId
  const matches = new Map<string, { suggestion: TeamSuggestion; distance: number; aliasIsNull: boolean; alias: string | null }>();

  for (const candidate of candidates) {
    const key = candidate.key;
    let distance: number | null = null;

    // Check for prefix match or word prefix match
    if (key.startsWith(q)) {
      distance = 0;
    } else {
      // Check word prefix: any word in key starts with q
      const words = key.split(' ');
      for (const word of words) {
        if (word.startsWith(q)) {
          distance = 0;
          break;
        }
      }

      // No prefix match; try edit distance if q is long enough
      if (distance === null && q.length >= 4) {
        const d1 = editDistance(q, key);
        const d2 = editDistance(q, key.slice(0, q.length));
        distance = Math.min(d1, d2);
      }
    }

    // Keep match if distance <= 2
    if (distance !== null && distance <= 2) {
      const suggestion: TeamSuggestion = {
        teamId: candidate.teamId,
        name: candidate.name,
        matchedAlias: candidate.alias,
        distance,
      };

      const teamId = candidate.teamId;
      const aliasIsNull = candidate.alias === null;

      // Keep best match per teamId: lowest distance, then prefer name (alias null), then earliest alias
      const existing = matches.get(teamId);
      if (!existing || distance < existing.distance ||
          (distance === existing.distance && aliasIsNull && !existing.aliasIsNull) ||
          (distance === existing.distance && aliasIsNull === existing.aliasIsNull && (candidate.alias ?? '') < (existing.alias ?? ''))) {
        matches.set(teamId, {
          suggestion,
          distance,
          aliasIsNull,
          alias: candidate.alias,
        });
      }
    }
  }

  // Convert to array and sort
  const suggestions = Array.from(matches.values()).map((m) => m.suggestion);

  suggestions.sort((a, b) => {
    // Sort by distance asc
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }

    // Then by name (plain < compare)
    if (a.name !== b.name) {
      return a.name < b.name ? -1 : 1;
    }

    // Then by teamId
    return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
  });

  return suggestions.slice(0, limit);
}
