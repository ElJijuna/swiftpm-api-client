export type {
  SwiftAuthor,
  SwiftIdentifiersResult,
  SwiftRelease,
  SwiftReleaseMetadata,
  SwiftReleaseResource,
  SwiftReleasesIndex,
} from './domain/Releases';
export type {
  SwiftSearchPackage,
  SwiftSearchParams,
  SwiftSearchResult,
} from './domain/Search';
export { SwiftPMApiError } from './errors/SwiftPMApiError';
export { PackageResource } from './resources/PackageResource';
export type { RequestEvent, SwiftPMClientEvents, SwiftPMClientOptions } from './SwiftPMClient';
export { SwiftPMClient } from './SwiftPMClient';
