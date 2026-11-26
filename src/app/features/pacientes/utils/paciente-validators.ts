const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MASKED_CPF_REGEX = /^\*{3}\.\d{3}\.\d{3}-\*{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isMaskedCpf(value: string): boolean {
  return MASKED_CPF_REGEX.test(value.trim());
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits.charAt(i)) * (10 - i);
  }
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits.charAt(i)) * (11 - i);
  }
  check = (sum * 10) % 11;
  if (check === 10) check = 0;

  return check === Number(digits.charAt(10));
}

export function formatCpf(value: string): string {
  const trimmed = value.trim();
  if (isMaskedCpf(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 11) return trimmed;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidTelefone(value: string): boolean {
  const digits = value.replace(/\D/g, '');

  return digits.length === 10 || digits.length === 11;
}

export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value.trim();
}

export function isValidDataNascimento(value: string): boolean {
  const trimmed = value.trim();
  if (!ISO_DATE_REGEX.test(trimmed)) return false;

  const [year, month, day] = trimmed.split('-').map(Number);
  if (!year || !month || !day || year < 1900) return false;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return false;
  }

  return trimmed <= getTodayIsoDate();
}

export function formatDateOnlyBr(value: string | null | undefined): string {
  if (!value || !ISO_DATE_REGEX.test(value)) return '-';

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function calculateAge(value: string | null | undefined): number | null {
  if (!value || !isValidDataNascimento(value)) return null;

  const [birthYear, birthMonth, birthDay] = value.split('-').map(Number);
  if (!birthYear || !birthMonth || !birthDay) return null;

  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const monthDiff = today.getMonth() + 1 - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 ? age : null;
}
