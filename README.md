# swiftpm-api-client

<p align="center">
  <img src="https://developer.apple.com/assets/elements/icons/swift/swift-96x96_2x.png" alt="Swift logo" width="96" />
</p>

[![npm version](https://img.shields.io/npm/v/swiftpm-api-client)](https://www.npmjs.com/package/swiftpm-api-client)
[![npm downloads](https://img.shields.io/npm/dm/swiftpm-api-client)](https://www.npmjs.com/package/swiftpm-api-client)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/swiftpm-api-client)](https://bundlephobia.com/package/swiftpm-api-client)
[![CI](https://github.com/ElJijuna/swiftpm-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/ElJijuna/swiftpm-api-client/actions/workflows/ci.yml)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/swiftpm-api-client)](https://nodejs.org/)

TypeScript client for the [Swift Package Registry](https://github.com/swiftlang/swift-package-manager/blob/main/Documentation/PackageRegistry/Registry.md) (SE-0292) and the [Swift Package Index](https://swiftpackageindex.com). Covers release listings, version metadata, Package.swift manifests, identifier lookup, and package search. Works in **Node.js** and the **browser** (isomorphic). Fully typed, zero runtime dependencies.

**Data sources:**

| Source | What it provides |
| --- | --- |
| [Swift Package Registry](https://github.com/swiftlang/swift-package-manager/blob/main/Documentation/PackageRegistry/Registry.md) (SE-0292) | Release listings, release metadata, Package.swift manifests, identifier lookup |
| [swiftpackageindex.com](https://swiftpackageindex.com) | Full-text package search (requires API token) |

---

## Installation

```bash
npm install swiftpm-api-client
```

---

## Quick start

```typescript
import { SwiftPMClient } from 'swiftpm-api-client';

// Point to any SE-0292-compatible registry
const client = new SwiftPMClient({
  registryUrl: 'https://packages.example.com',
});

// With Swift Package Index search enabled
const clientWithSearch = new SwiftPMClient({
  registryUrl: 'https://packages.example.com',
  indexUrl: 'https://swiftpackageindex.com',
  indexToken: process.env.SPI_TOKEN,
});
```

---

## API reference

### Package releases

```typescript
// All published releases
const index = await client.package('apple', 'swift-argument-parser').releases();
console.log(Object.keys(index.releases)); // ['1.0.0', '1.1.0', '2.0.0', ...]

// Latest release (highest semver)
const latest = await client.package('apple', 'swift-argument-parser').latest();
console.log(latest.version);                   // '2.0.0'
console.log(latest.metadata.description);      // 'Straightforward, type-safe argument parsing for Swift'
console.log(latest.metadata.repositoryURLs);   // ['https://github.com/apple/swift-argument-parser']

// Specific release metadata
const v110 = await client.package('apple', 'swift-argument-parser').release('1.1.0');
console.log(v110.id);                    // 'apple.swift-argument-parser'
console.log(v110.version);               // '1.1.0'
console.log(v110.resources[0].name);     // 'source-archive'
console.log(v110.resources[0].checksum); // 'sha256:...'
```

### Package.swift manifest

```typescript
// Fetch the raw Package.swift manifest for a specific version
const manifest = await client.package('apple', 'swift-argument-parser').manifest('2.0.0');
console.log(manifest);
// // swift-tools-version:5.9
// import PackageDescription
// let package = Package(...)
```

### Search (requires SPI token)

```typescript
const results = await client.search({ query: 'vapor', page: 1, pageSize: 10 });

console.log(results.hasMoreResults); // true

results.results.forEach(pkg => {
  console.log(pkg.repositoryOwner, pkg.packageName); // 'vapor'  'vapor'
  console.log(pkg.stars);                            // 24000
  console.log(pkg.summary);                          // 'A server-side Swift HTTP web framework.'
  console.log(pkg.hasDocs);                          // true
});

// Paginate
const page2 = await client.search({ query: 'networking', page: 2, pageSize: 20 });
```

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `string` | Search text |
| `page` | `number` | Page number, 1-based (default: 1) |
| `pageSize` | `number` | Results per page |

### Identifier lookup

```typescript
// Resolve a repository URL to its registered package identifiers
const result = await client.lookupIdentifiers('https://github.com/apple/swift-argument-parser');
console.log(result.identifiers); // ['apple.swift-argument-parser']
```

---

## Cancelling requests

Pass an `AbortSignal` to any method to cancel the in-flight request:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

await client.package('apple', 'swift-argument-parser').releases(controller.signal);
await client.package('apple', 'swift-argument-parser').latest(controller.signal);
await client.package('apple', 'swift-argument-parser').release('2.0.0', controller.signal);
await client.package('apple', 'swift-argument-parser').manifest('2.0.0', controller.signal);
await client.search({ query: 'vapor' }, controller.signal);
await client.lookupIdentifiers('https://github.com/apple/swift-argument-parser', controller.signal);
```

When aborted, `fetch` throws a `DOMException` with `name === 'AbortError'`. The `request` event is still emitted with the error attached.

---

## Request events

Subscribe to every HTTP request for logging, monitoring, or debugging:

```typescript
client.on('request', (event) => {
  console.log(`[${event.statusCode}] ${event.method} ${event.url} (${event.durationMs}ms)`);
  if (event.error) {
    console.error('Request failed:', event.error.message);
  }
});
```

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string` | Full URL requested |
| `method` | `'GET'` | HTTP method |
| `startedAt` | `Date` | When the request started |
| `finishedAt` | `Date` | When the request finished |
| `durationMs` | `number` | Duration in milliseconds |
| `statusCode` | `number \| undefined` | HTTP status code, if a response was received |
| `error` | `Error \| undefined` | Present only if the request failed |

`on()` is chainable and supports multiple listeners:

```typescript
client
  .on('request', logToConsole)
  .on('request', sendToDatadog);
```

---

## Error handling

Non-2xx responses throw a `SwiftPMApiError`:

```typescript
import { SwiftPMApiError } from 'swiftpm-api-client';

try {
  await client.package('apple', 'non-existent').releases();
} catch (err) {
  if (err instanceof SwiftPMApiError) {
    console.log(err.status);     // 404
    console.log(err.statusText); // 'Not Found'
    console.log(err.message);    // 'SwiftPM API error: 404 Not Found'
  }
}
```

---

## TypeScript types

All domain types are exported:

```typescript
import type {
  // Client
  SwiftPMClientOptions,
  SwiftPMClientEvents,
  RequestEvent,

  // Registry — releases
  SwiftReleasesIndex,
  SwiftRelease,
  SwiftReleaseResource,
  SwiftReleaseMetadata,
  SwiftAuthor,
  SwiftIdentifiersResult,

  // Swift Package Index — search
  SwiftSearchParams,
  SwiftSearchResult,
  SwiftSearchPackage,
} from 'swiftpm-api-client';
```

---

## License

[MIT](LICENSE)
