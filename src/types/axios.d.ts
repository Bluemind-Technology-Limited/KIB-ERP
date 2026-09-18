import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Controls the automatic toast for this request:
     * - omitted      -> errors toast; mutating requests also toast a success message
     * - `false`      -> no toast at all (the caller renders its own feedback)
     * - `{ success }`-> mutating requests toast this text instead of the default
     */
    toast?: false | { success?: string };
  }
}
