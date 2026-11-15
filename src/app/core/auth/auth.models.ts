export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * Shortest password the app accepts: OWASP ASVS asks for 12 (NIST and OWASP say 15 without a second
 * factor, 8 with one). There are deliberately no composition rules (digits, symbols, capitals): they
 * push people to predictable passwords. Spaces and any Unicode are allowed, and pasting works.
 */
export const MIN_PASSWORD_LENGTH = 12;
