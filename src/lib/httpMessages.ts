import type { AxiosError } from 'axios';

/**
 * The only user-facing API error copy in the app.
 *
 * Backend/axios error text is never shown raw — every failure is mapped to one
 * of these sentences so nothing internal (stack traces, SQL errors, Prisma
 * messages) can leak into the UI.
 */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong please refresh';
export const UNAUTHORIZED_MESSAGE = 'Please refresh and login';

/** Maps any thrown request error to the sentence the user should see. */
export function toUserMessage(error: unknown): string {
  const status = (error as AxiosError | undefined)?.response?.status;
  if (status === 401) return UNAUTHORIZED_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}
