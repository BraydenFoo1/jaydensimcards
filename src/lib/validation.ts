/**
 * Client-side form validation. The server (Better Auth) re-validates all of
 * this; these checks exist to give fast, specific feedback in the form.
 * Limits match the server config in src/lib/auth.ts.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 100;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

// Pragmatic, not RFC 5322: one @, something on both sides, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (value.length > 254 || !EMAIL_RE.test(value)) return "Enter a valid email address, like name@example.com.";
  return undefined;
}

export function passwordError(password: string): string | undefined {
  if (!password) return "Enter a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  return undefined;
}

export function confirmError(password: string, confirm: string): string | undefined {
  if (!confirm) return "Type the password again to confirm it.";
  if (password !== confirm) return "The passwords don't match.";
  return undefined;
}

export type RegistrationInput = { name: string; email: string; password: string; confirm: string; acknowledged: boolean; agreed: boolean };

export function validateRegistration(input: RegistrationInput): FieldErrors<keyof RegistrationInput> {
  const errors: FieldErrors<keyof RegistrationInput> = {};
  const name = input.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length > NAME_MAX) errors.name = `Use ${NAME_MAX} characters or fewer.`;
  const email = emailError(input.email);
  if (email) errors.email = email;
  const password = passwordError(input.password);
  if (password) errors.password = password;
  const confirm = confirmError(input.password, input.confirm);
  if (confirm) errors.confirm = confirm;
  if (!input.acknowledged) errors.acknowledged = "Please confirm you understand this is a fictional service.";
  if (!input.agreed) errors.agreed = "Please agree to the Terms of Service and Privacy Policy.";
  return errors;
}

export function validateSignIn(input: { email: string; password: string }): FieldErrors<"email" | "password"> {
  const errors: FieldErrors<"email" | "password"> = {};
  const email = emailError(input.email);
  if (email) errors.email = email;
  // Sign-in only checks presence: length rules would leak policy details for old passwords.
  if (!input.password) errors.password = "Enter your password.";
  return errors;
}

export function validateNewPassword(input: { password: string; confirm: string }): FieldErrors<"password" | "confirm"> {
  const errors: FieldErrors<"password" | "confirm"> = {};
  const password = passwordError(input.password);
  if (password) errors.password = password;
  const confirm = confirmError(input.password, input.confirm);
  if (confirm) errors.confirm = confirm;
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

export type ChangePasswordInput = { current: string; password: string; confirm: string };

export function validateChangePassword(input: ChangePasswordInput): FieldErrors<keyof ChangePasswordInput> {
  const errors: FieldErrors<keyof ChangePasswordInput> = {};
  if (!input.current) errors.current = "Enter your current password.";
  const password = passwordError(input.password);
  if (password) errors.password = password;
  else if (input.current && input.password === input.current) errors.password = "Choose a password different from your current one.";
  const confirm = confirmError(input.password, input.confirm);
  if (confirm) errors.confirm = confirm;
  return errors;
}
