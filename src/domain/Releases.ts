/** Author metadata attached to a Swift package release. */
export interface SwiftAuthor {
  name: string;
  email?: string;
  url?: string;
}

/** Metadata block on a {@link SwiftRelease}. */
export interface SwiftReleaseMetadata {
  author?: SwiftAuthor;
  description?: string;
  licenseURL?: string;
  readmeURL?: string;
  repositoryURLs?: string[];
}

/** A downloadable resource (e.g. source archive) attached to a release. */
export interface SwiftReleaseResource {
  /** Resource name, e.g. `'source-archive'`. */
  name: string;
  /** MIME type, e.g. `'application/zip'`. */
  type: string;
  /** Checksum string (algorithm:hex). */
  checksum: string;
}

/**
 * A single release as returned by `GET /{scope}/{name}/{version}` in the
 * Swift Package Registry spec (SE-0292).
 */
export interface SwiftRelease {
  id: string;
  version: string;
  resources: SwiftReleaseResource[];
  metadata: SwiftReleaseMetadata;
}

/**
 * Index of all releases for a package, as returned by
 * `GET /{scope}/{name}` in the Swift Package Registry spec (SE-0292).
 */
export interface SwiftReleasesIndex {
  releases: Record<string, { url: string }>;
}

/**
 * Result of `GET /identifiers?url={repositoryURL}` — maps a source repository
 * to the package identifiers registered for it.
 */
export interface SwiftIdentifiersResult {
  identifiers: string[];
}
