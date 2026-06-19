import type { SwiftRelease, SwiftReleasesIndex } from './domain/Releases';
import type { SwiftSearchResult } from './domain/Search';
import { SwiftPMApiError } from './errors/SwiftPMApiError';
import { PackageResource } from './resources/PackageResource';
import { SwiftPMClient } from './SwiftPMClient';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockJsonResponse<T>(data: T, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockTextResponse(data: string, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(data),
  });
}

const releasesFixture: SwiftReleasesIndex = {
  releases: {
    '1.0.0': { url: 'https://registry.swift.example/apple/swift-argument-parser/1.0.0' },
    '1.1.0': { url: 'https://registry.swift.example/apple/swift-argument-parser/1.1.0' },
  },
};

const releaseFixture: SwiftRelease = {
  id: 'apple.swift-argument-parser',
  version: '1.1.0',
  resources: [{ name: 'source-archive', type: 'application/zip', checksum: 'sha256:abc' }],
  metadata: { description: 'Argument parsing for Swift' },
};

const searchFixture: SwiftSearchResult = {
  hasMoreResults: false,
  results: [
    {
      packageId: 'apple.swift-argument-parser',
      packageName: 'swift-argument-parser',
      repositoryName: 'swift-argument-parser',
      repositoryOwner: 'apple',
      stars: 3000,
      lastActivityAt: '2024-01-01T00:00:00Z',
      hasDocs: true,
    },
  ],
};

beforeEach(() => {
  mockFetch.mockClear();
});

// Slice 6: client.package()
describe('SwiftPMClient.package()', () => {
  it('returns a PackageResource', () => {
    const client = new SwiftPMClient();
    const pkg = client.package('apple', 'swift-argument-parser');
    expect(pkg).toBeInstanceOf(PackageResource);
  });

  it('PackageResource.releases() hits correct registry URL', async () => {
    const client = new SwiftPMClient({ registryUrl: 'https://registry.swift.example' });
    mockJsonResponse(releasesFixture);

    await client.package('apple', 'swift-argument-parser').releases();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://registry.swift.example/apple/swift-argument-parser',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('PackageResource.release(version) hits versioned URL', async () => {
    const client = new SwiftPMClient({ registryUrl: 'https://registry.swift.example' });
    mockJsonResponse(releaseFixture);

    await client.package('apple', 'swift-argument-parser').release('1.1.0');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://registry.swift.example/apple/swift-argument-parser/1.1.0',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('PackageResource.manifest() hits manifest URL and returns text', async () => {
    const client = new SwiftPMClient({ registryUrl: 'https://registry.swift.example' });
    const manifestContent = '// swift-tools-version:5.9\n';
    mockTextResponse(manifestContent);

    const result = await client.package('apple', 'swift-argument-parser').manifest('1.1.0');

    expect(result).toBe(manifestContent);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://registry.swift.example/apple/swift-argument-parser/1.1.0/Package.swift',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

// Slice 7: client.search()
describe('SwiftPMClient.search()', () => {
  it('searches using the SPI index URL', async () => {
    const client = new SwiftPMClient({ indexUrl: 'https://swiftpackageindex.com' });
    mockJsonResponse(searchFixture);

    const result = await client.search({ query: 'argument' });

    expect(result).toEqual(searchFixture);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('swiftpackageindex.com/api/search');
    expect(url).toContain('argument');
  });

  it('includes pagination params', async () => {
    const client = new SwiftPMClient();
    mockJsonResponse(searchFixture);

    await client.search({ query: 'vapor', page: 2, pageSize: 20 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=20');
  });
});

// Slice 8: client.lookupIdentifiers()
describe('SwiftPMClient.lookupIdentifiers()', () => {
  it('hits /identifiers with url param on registry base', async () => {
    const client = new SwiftPMClient({ registryUrl: 'https://registry.swift.example' });
    mockJsonResponse({ identifiers: ['apple.swift-argument-parser'] });

    const result = await client.lookupIdentifiers('https://github.com/apple/swift-argument-parser');

    expect(result.identifiers).toEqual(['apple.swift-argument-parser']);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('registry.swift.example/identifiers');
    expect(url).toContain(encodeURIComponent('https://github.com/apple/swift-argument-parser'));
  });
});

// Slice 9: event emission
describe('SwiftPMClient event emission', () => {
  it('emits request event on successful fetch', async () => {
    const client = new SwiftPMClient();
    mockJsonResponse(releasesFixture);

    const events: unknown[] = [];
    client.on('request', (e) => events.push(e));

    await client.package('apple', 'swift-argument-parser').releases();

    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event.url).toContain('/apple/swift-argument-parser');
    expect(event.method).toBe('GET');
    expect(event.statusCode).toBe(200);
    expect(event.startedAt).toBeInstanceOf(Date);
    expect(event.finishedAt).toBeInstanceOf(Date);
    expect(typeof event.durationMs).toBe('number');
    expect(event.error).toBeUndefined();
  });

  it('emits request event with error on failed fetch', async () => {
    const client = new SwiftPMClient();
    mockJsonResponse({}, 404);

    const events: unknown[] = [];
    client.on('request', (e) => events.push(e));

    await expect(client.package('apple', 'swift-argument-parser').releases()).rejects.toThrow(
      SwiftPMApiError,
    );

    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event.statusCode).toBe(404);
    expect(event.error).toBeInstanceOf(SwiftPMApiError);
  });

  it('supports multiple listeners via chaining', async () => {
    const client = new SwiftPMClient();
    mockJsonResponse(releasesFixture);

    const calls: number[] = [];
    client.on('request', () => calls.push(1)).on('request', () => calls.push(2));

    await client.package('apple', 'swift-argument-parser').releases();

    expect(calls).toEqual([1, 2]);
  });

  it('throws SwiftPMApiError on non-2xx response', async () => {
    const client = new SwiftPMClient();
    mockJsonResponse({}, 500);

    await expect(client.package('apple', 'swift-argument-parser').releases()).rejects.toThrow(
      SwiftPMApiError,
    );
  });
});
