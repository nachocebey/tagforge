// A practical subset of Scryfall's search syntax — not the full grammar
// (no parentheses/OR grouping, no every operator Scryfall supports).
// Supported: bare text (name/oracle text), quoted phrases, negation with a
// leading "-", and field:value / field>=value etc. for t/type, o/oracle,
// c/color, id/identity, cmc/mv, tag, is.

export type Comparator = ':' | '=' | '!=' | '>' | '>=' | '<' | '<='

export type QueryClause =
  | { kind: 'text'; value: string; negate: boolean }
  | { kind: 'field'; field: string; comparator: Comparator; value: string; negate: boolean }

// A field:"quoted value" token, a standalone "quoted phrase", or any other
// non-space run (which itself may be a field:value pair with no spaces).
const TOKEN_RE = /-?[a-zA-Z]+(:|>=|<=|!=|>|<|=)"[^"]*"|"[^"]*"|\S+/g
const FIELD_TOKEN_RE = /^(-)?([a-zA-Z]+)(:|>=|<=|!=|>|<|=)(.+)$/s

function stripQuotes(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s
}

export function parseSearchQuery(raw: string): QueryClause[] {
  const tokens = raw.match(TOKEN_RE) ?? []
  const clauses: QueryClause[] = []

  for (const token of tokens) {
    const fieldMatch = token.match(FIELD_TOKEN_RE)
    if (fieldMatch) {
      const [, neg, field, comparator, rawValue] = fieldMatch
      clauses.push({
        kind: 'field',
        field: field.toLowerCase(),
        comparator: comparator as Comparator,
        value: stripQuotes(rawValue),
        negate: Boolean(neg),
      })
      continue
    }

    const negate = token.startsWith('-') && token.length > 1
    clauses.push({ kind: 'text', value: stripQuotes(negate ? token.slice(1) : token), negate })
  }

  return clauses
}
