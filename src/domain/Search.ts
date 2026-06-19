/** Parameters for {@link SwiftPMClient.search}. */
export interface SwiftSearchParams {
  /** Keyword query string. */
  query: string;
  /** Page number (1-based). */
  page?: number;
  /** Number of results per page. */
  pageSize?: number;
}

/** A single package entry in SPI search results. */
export interface SwiftSearchPackage {
  packageId: string;
  packageName: string;
  repositoryName: string;
  repositoryOwner: string;
  summary?: string;
  stars: number;
  lastActivityAt: string;
  hasDocs: boolean;
}

/** Response from `GET /api/packages/search` on swiftpackageindex.com. */
export interface SwiftSearchResult {
  hasMoreResults: boolean;
  results: SwiftSearchPackage[];
}
