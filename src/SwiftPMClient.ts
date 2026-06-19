import type { SwiftIdentifiersResult } from './domain/Releases';
import type { SwiftSearchParams, SwiftSearchResult } from './domain/Search';
import { SwiftPMApiError } from './errors/SwiftPMApiError';
import { PackageResource } from './resources/PackageResource';

const DEFAULT_REGISTRY_URL = 'https://registry.swift.example';
const DEFAULT_INDEX_URL = 'https://swiftpackageindex.com';

/**
 * Payload emitted on every HTTP request made by {@link SwiftPMClient}.
 */
export interface RequestEvent {
  /** Full URL that was requested. */
  url: string;
  /** HTTP method used. */
  method: 'GET';
  /** Timestamp when the request started. */
  startedAt: Date;
  /** Timestamp when the request finished (success or error). */
  finishedAt: Date;
  /** Total duration in milliseconds. */
  durationMs: number;
  /** HTTP status code, if a response was received. */
  statusCode?: number;
  /** Error thrown, if the request failed. */
  error?: Error;
}

/** Map of supported client events to their callback signatures. */
export interface SwiftPMClientEvents {
  request: (event: RequestEvent) => void;
}

/**
 * Constructor options for {@link SwiftPMClient}.
 */
export interface SwiftPMClientOptions {
  /**
   * Base URL for the Swift Package Registry (SE-0292).
   * Defaults to `'https://registry.swift.example'`.
   * Override for GitHub Packages or a private registry.
   */
  registryUrl?: string;
  /**
   * Base URL for the Swift Package Index search API.
   * Defaults to `'https://swiftpackageindex.com'`.
   */
  indexUrl?: string;
}

/**
 * Main entry point for the Swift PM API client.
 *
 * Covers two APIs:
 * - **Swift Package Registry** (SE-0292) — release listings, metadata, manifests
 * - **Swift Package Index** — package search
 *
 * @example
 * ```typescript
 * import { SwiftPMClient } from 'swiftpm-api-client';
 *
 * const client = new SwiftPMClient();
 *
 * // List releases
 * const index = await client.package('apple', 'swift-argument-parser').releases();
 *
 * // Latest release
 * const latest = await client.package('apple', 'swift-argument-parser').latest();
 *
 * // Specific release metadata
 * const v110 = await client.package('apple', 'swift-argument-parser').release('1.1.0');
 *
 * // Package.swift manifest
 * const manifest = await client.package('apple', 'swift-argument-parser').manifest('1.1.0');
 *
 * // Search packages
 * const results = await client.search({ query: 'vapor', page: 1 });
 *
 * // Lookup identifiers by repository URL
 * const ids = await client.lookupIdentifiers('https://github.com/apple/swift-argument-parser');
 * ```
 */
export class SwiftPMClient {
  private readonly registryUrl: string;
  private readonly indexUrl: string;
  private readonly listeners: Map<
    keyof SwiftPMClientEvents,
    SwiftPMClientEvents[keyof SwiftPMClientEvents][]
  > = new Map();

  constructor(options: SwiftPMClientOptions = {}) {
    this.registryUrl = (options.registryUrl ?? DEFAULT_REGISTRY_URL).replace(/\/$/, '');
    this.indexUrl = (options.indexUrl ?? DEFAULT_INDEX_URL).replace(/\/$/, '');
  }

  /**
   * Subscribes to a client event. Supports method chaining.
   *
   * @param event - Event name (currently only `'request'`).
   * @param callback - Called each time the event fires.
   * @returns `this`, for chaining.
   *
   * @example
   * ```typescript
   * client
   *   .on('request', (e) => console.log(`${e.method} ${e.url} → ${e.statusCode} (${e.durationMs}ms)`))
   *   .on('request', (e) => { if (e.error) reportToSentry(e.error); });
   * ```
   */
  on<K extends keyof SwiftPMClientEvents>(event: K, callback: SwiftPMClientEvents[K]): this {
    const cbs = this.listeners.get(event) ?? [];
    cbs.push(callback);
    this.listeners.set(event, cbs);
    return this;
  }

  private emit<K extends keyof SwiftPMClientEvents>(
    event: K,
    payload: Parameters<SwiftPMClientEvents[K]>[0],
  ): void {
    const cbs = this.listeners.get(event) ?? [];
    for (const cb of cbs) {
      (cb as (p: typeof payload) => void)(payload);
    }
  }

  /** @internal */
  private async request<T>(
    path: string,
    params?: Record<string, string | number | boolean>,
    baseUrl?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const base = baseUrl === 'index' ? this.indexUrl : this.registryUrl;
    const url = buildUrl(`${base}${path}`, params);
    const startedAt = new Date();
    let statusCode: number | undefined;
    try {
      const response = await fetch(url, { method: 'GET', signal });
      statusCode = response.status;
      if (!response.ok) {
        throw new SwiftPMApiError(response.status, response.statusText);
      }
      const data = (await response.json()) as T;
      this.emit('request', {
        url,
        method: 'GET',
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        statusCode,
      });
      return data;
    } catch (err) {
      const finishedAt = new Date();
      this.emit('request', {
        url,
        method: 'GET',
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        statusCode,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }

  /** @internal */
  private async textRequest(path: string, signal?: AbortSignal): Promise<string> {
    const url = `${this.registryUrl}${path}`;
    const startedAt = new Date();
    let statusCode: number | undefined;
    try {
      const response = await fetch(url, { method: 'GET', signal });
      statusCode = response.status;
      if (!response.ok) {
        throw new SwiftPMApiError(response.status, response.statusText);
      }
      const text = await response.text();
      this.emit('request', {
        url,
        method: 'GET',
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        statusCode,
      });
      return text;
    } catch (err) {
      const finishedAt = new Date();
      this.emit('request', {
        url,
        method: 'GET',
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        statusCode,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }

  /**
   * Returns a {@link PackageResource} scoped to the given `scope` and `name`.
   *
   * @param scope - The package scope (e.g. `'apple'`).
   * @param name - The package name (e.g. `'swift-argument-parser'`).
   *
   * @example
   * ```typescript
   * const releases = await client.package('apple', 'swift-argument-parser').releases();
   * ```
   */
  package(scope: string, name: string): PackageResource {
    return new PackageResource(
      <T>(
        path: string,
        params?: Record<string, string | number | boolean>,
        baseUrl?: string,
        signal?: AbortSignal,
      ) => this.request<T>(path, params, baseUrl, signal),
      (path: string, signal?: AbortSignal) => this.textRequest(path, signal),
      scope,
      name,
    );
  }

  /**
   * Searches for Swift packages using the Swift Package Index API.
   *
   * `GET /api/packages/search` (via `swiftpackageindex.com`)
   *
   * @param params - Search parameters.
   * @param signal - Optional `AbortSignal` to cancel the request.
   *
   * @example
   * ```typescript
   * const results = await client.search({ query: 'vapor', page: 1, pageSize: 20 });
   * console.log(results.hasMoreResults);
   * results.results.forEach(p => console.log(p.packageName, p.stars));
   * ```
   */
  async search(params: SwiftSearchParams, signal?: AbortSignal): Promise<SwiftSearchResult> {
    return this.request<SwiftSearchResult>(
      '/api/packages/search',
      {
        query: params.query,
        ...(params.page !== undefined && { page: params.page }),
        ...(params.pageSize !== undefined && { pageSize: params.pageSize }),
      },
      'index',
      signal,
    );
  }

  /**
   * Looks up package identifiers by source repository URL.
   *
   * `GET /identifiers?url={repositoryURL}` (via the registry base URL)
   *
   * @param repositoryURL - The source repository URL (e.g. a GitHub URL).
   * @param signal - Optional `AbortSignal` to cancel the request.
   *
   * @example
   * ```typescript
   * const result = await client.lookupIdentifiers('https://github.com/apple/swift-argument-parser');
   * console.log(result.identifiers); // ['apple.swift-argument-parser']
   * ```
   */
  async lookupIdentifiers(
    repositoryURL: string,
    signal?: AbortSignal,
  ): Promise<SwiftIdentifiersResult> {
    return this.request<SwiftIdentifiersResult>(
      '/identifiers',
      { url: repositoryURL },
      undefined,
      signal,
    );
  }
}

function buildUrl(base: string, params?: Record<string, string | number | boolean>): string {
  if (!params) {
    return base;
  }
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return base;
  }
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `${base}?${search.toString()}`;
}
