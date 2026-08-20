import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

// A fixed hash to compare against when no user exists, so a login attempt
// against an unregistered email takes about as long as one against a real
// user — otherwise the response-time difference leaks which emails exist.
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOakInHOFocpBWJhFdMhpjT4TCzHvTQaC'

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH)
}
