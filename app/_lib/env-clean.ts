/**
 * Strips a UTF-8 BOM / zero-width no-break space (U+FEFF) plus surrounding
 * whitespace from an environment variable value.
 *
 * Vercel env vars added on Windows/PowerShell can carry a leading BOM. When the
 * value is handed to Supabase as an HTTP header (`apikey`,
 * `Authorization: Bearer …`), header construction throws
 * `Cannot convert argument to a ByteString … value of 65279`. The failure only
 * surfaces on the first authenticated fetch (e.g. the proxy's `getUser()` once a
 * session cookie exists), which makes it easy to miss. Sanitizing at every read
 * keeps the app immune regardless of how the value was stored or whether a stale
 * build inlined a contaminated copy.
 *
 * The BOM is referenced via its code point (0xFEFF) rather than a literal
 * character so this source file itself stays pure ASCII.
 */
const BOM = String.fromCharCode(0xfeff);

export function cleanEnv(value: string | undefined): string | undefined {
  return value?.split(BOM).join("").trim();
}
