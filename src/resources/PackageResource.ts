import type { SwiftRelease, SwiftReleasesIndex } from '../domain/Releases';
import type { RequestFn, TextRequestFn } from './types';

/**
 * Provides access to a single Swift package's releases and manifests
 * via the Swift Package Registry spec (SE-0292).
 *
 * Obtain an instance via {@link SwiftPMClient.package}.
 * @example
 * ```typescript
 * const pkg = client.package('apple', 'swift-argument-parser');
 * const releases = await pkg.releases();
 * const latest   = await pkg.latest();
 * const manifest = await pkg.manifest('2.0.0');
 * ```
 */
export class PackageResource {
  /** @internal */
  constructor(
    private readonly request: RequestFn,
    private readonly textRequest: TextRequestFn,
    private readonly scope: string,
    private readonly name: string,
  ) {}

  private get basePath(): string {
    return `/${this.scope}/${this.name}`;
  }

  /**
   * Lists all published releases for this package.
   *
   * `GET /{scope}/{name}`
   *
   * @param signal - Optional `AbortSignal` to cancel the request.
   */
  async releases(signal?: AbortSignal): Promise<SwiftReleasesIndex> {
    return this.request<SwiftReleasesIndex>(this.basePath, undefined, undefined, signal);
  }

  /**
   * Fetches metadata for a specific release version.
   *
   * `GET /{scope}/{name}/{version}`
   *
   * @param version - The semver version string (e.g. `'1.1.0'`).
   * @param signal - Optional `AbortSignal` to cancel the request.
   */
  async release(version: string, signal?: AbortSignal): Promise<SwiftRelease> {
    return this.request<SwiftRelease>(`${this.basePath}/${version}`, undefined, undefined, signal);
  }

  /**
   * Returns the metadata for the latest (highest semver) release.
   *
   * Fetches the releases index and picks the highest version, then
   * resolves the full release metadata.
   *
   * @param signal - Optional `AbortSignal` to cancel the request.
   */
  async latest(signal?: AbortSignal): Promise<SwiftRelease> {
    const index = await this.releases(signal);
    const versions = Object.keys(index.releases);
    if (versions.length === 0) {
      throw new Error('No releases found');
    }
    const latest = versions.sort(compareSemver).at(-1) as string;
    return this.release(latest, signal);
  }

  /**
   * Fetches the `Package.swift` manifest for a specific release version.
   *
   * `GET /{scope}/{name}/{version}/Package.swift`
   *
   * @param version - The semver version string (e.g. `'1.1.0'`).
   * @param signal - Optional `AbortSignal` to cancel the request.
   * @returns The raw manifest content as a string.
   */
  async manifest(version: string, signal?: AbortSignal): Promise<string> {
    return this.textRequest(`${this.basePath}/${version}/Package.swift`, signal);
  }
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map(Number);
  const [aMaj = 0, aMin = 0, aPat = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPat = 0] = parse(b);
  return aMaj !== bMaj ? aMaj - bMaj : aMin !== bMin ? aMin - bMin : aPat - bPat;
}
