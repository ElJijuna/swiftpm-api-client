/**
 * Thrown when the Swift Package Registry or Swift Package Index API returns
 * a non-2xx HTTP response.
 */
export class SwiftPMApiError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`SwiftPM API error: ${status} ${statusText}`);
    this.name = 'SwiftPMApiError';
    this.status = status;
    this.statusText = statusText;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
