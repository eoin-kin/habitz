import { CreateHabitInput, HabitFrequency } from '../types';

// ============================================================
// Generic string utilities
// ============================================================

const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function stripHtml(str: string): string {
  return str.replace(HTML_TAG_RE, '');
}

export function sanitizeText(
  input: unknown,
  opts: { maxLength?: number; allowNewlines?: boolean } = {}
): string {
  const { maxLength = 500, allowNewlines = false } = opts;
  if (typeof input !== 'string') return '';
  let out = input.replace(HTML_TAG_RE, '').replace(CONTROL_CHAR_RE, '');
  if (!allowNewlines) out = out.replace(/[\r\n]+/g, ' ');
  return out.trim().slice(0, maxLength);
}

export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase().slice(0, 320);
}

// ============================================================
// Format validators
// ============================================================

export type ValidationErrors = Record<string, string>; // field → message; empty = valid

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

// ============================================================
// Domain validators  (return empty object when valid)
// ============================================================

export function validateAuthInput(email: string, password: string): ValidationErrors {
  const errors: ValidationErrors = {};
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) {
    errors.email = 'Email is required.';
  } else if (!isValidEmail(cleanEmail)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  return errors;
}

export function validateHabitInput(input: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    errors.name = 'Habit name is required.';
  } else if (name.length > 60) {
    errors.name = 'Name must be 60 characters or fewer.';
  }

  if (input.color !== undefined && !isValidHexColor(input.color as string)) {
    errors.color = 'Invalid color value.';
  }

  const freq = input.frequency;
  if (freq !== undefined && !['daily', 'weekly', 'custom'].includes(freq as string)) {
    errors.frequency = 'Invalid frequency.';
  }

  const days = input.frequency_days;
  if (Array.isArray(days)) {
    if (days.length === 0) {
      errors.frequency_days = 'Select at least one day.';
    } else if (!days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
      errors.frequency_days = 'Invalid day values (must be 1–7).';
    }
  }

  const target = input.target_count;
  if (
    target !== undefined &&
    (typeof target !== 'number' || !Number.isInteger(target) || target < 1 || target > 100)
  ) {
    errors.target_count = 'Target count must be a whole number between 1 and 100.';
  }

  return errors;
}

// ============================================================
// Domain sanitizers  (clean + coerce to valid shape)
// ============================================================

const VALID_FREQUENCIES: HabitFrequency[] = ['daily', 'weekly', 'custom'];

export function sanitizeHabitInput(input: CreateHabitInput): CreateHabitInput {
  return {
    name: sanitizeText(input.name, { maxLength: 60 }),
    description: input.description
      ? sanitizeText(input.description, { maxLength: 200, allowNewlines: true }) || undefined
      : undefined,
    color: isValidHexColor(input.color) ? input.color : '#4F46E5',
    icon: sanitizeText(input.icon, { maxLength: 4 }) || '✅',
    frequency: VALID_FREQUENCIES.includes(input.frequency) ? input.frequency : 'daily',
    frequency_days: Array.isArray(input.frequency_days)
      ? input.frequency_days
          .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
          .slice(0, 7)
      : [1, 2, 3, 4, 5, 6, 7],
    target_count:
      typeof input.target_count === 'number' && input.target_count >= 1
        ? Math.min(Math.floor(input.target_count), 100)
        : 1,
  };
}

export function sanitizeCompletionNote(note: unknown): string {
  return sanitizeText(note, { maxLength: 500, allowNewlines: true });
}
