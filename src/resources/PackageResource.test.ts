import type { SwiftRelease, SwiftReleasesIndex } from '../domain/Releases';
import { PackageResource } from './PackageResource';
import type { RequestFn, TextRequestFn } from './types';

const releasesIndexFixture: SwiftReleasesIndex = {
  releases: {
    '1.0.0': { url: 'https://registry.example.com/apple/swift-argument-parser/1.0.0' },
    '1.1.0': { url: 'https://registry.example.com/apple/swift-argument-parser/1.1.0' },
    '2.0.0': { url: 'https://registry.example.com/apple/swift-argument-parser/2.0.0' },
  },
};

const releaseFixture: SwiftRelease = {
  id: 'apple.swift-argument-parser',
  version: '1.1.0',
  resources: [
    {
      name: 'source-archive',
      type: 'application/zip',
      checksum: 'sha256:abc123',
    },
  ],
  metadata: {
    description: 'Straightforward, type-safe argument parsing for Swift',
    repositoryURLs: ['https://github.com/apple/swift-argument-parser'],
  },
};

describe('PackageResource', () => {
  let mockRequest: jest.MockedFunction<RequestFn>;
  let mockTextRequest: jest.MockedFunction<TextRequestFn>;
  let resource: PackageResource;

  beforeEach(() => {
    mockRequest = jest.fn();
    mockTextRequest = jest.fn();
    resource = new PackageResource(mockRequest, mockTextRequest, 'apple', 'swift-argument-parser');
  });

  // Slice 2: releases()
  describe('releases()', () => {
    it('fetches the releases index for the package', async () => {
      mockRequest.mockResolvedValueOnce(releasesIndexFixture);

      const result = await resource.releases();

      expect(result).toEqual(releasesIndexFixture);
      expect(mockRequest).toHaveBeenCalledWith(
        '/apple/swift-argument-parser',
        undefined,
        undefined,
        undefined,
      );
    });

    it('propagates AbortSignal', async () => {
      mockRequest.mockResolvedValueOnce(releasesIndexFixture);
      const { signal } = new AbortController();

      await resource.releases(signal);

      expect(mockRequest).toHaveBeenCalledWith(
        '/apple/swift-argument-parser',
        undefined,
        undefined,
        signal,
      );
    });
  });

  // Slice 3: release(version)
  describe('release(version)', () => {
    it('fetches metadata for a specific version', async () => {
      mockRequest.mockResolvedValueOnce(releaseFixture);

      const result = await resource.release('1.1.0');

      expect(result).toEqual(releaseFixture);
      expect(mockRequest).toHaveBeenCalledWith(
        '/apple/swift-argument-parser/1.1.0',
        undefined,
        undefined,
        undefined,
      );
    });

    it('propagates AbortSignal', async () => {
      mockRequest.mockResolvedValueOnce(releaseFixture);
      const { signal } = new AbortController();

      await resource.release('1.1.0', signal);

      expect(mockRequest).toHaveBeenCalledWith(
        '/apple/swift-argument-parser/1.1.0',
        undefined,
        undefined,
        signal,
      );
    });
  });

  // Slice 4: latest()
  describe('latest()', () => {
    it('returns the metadata for the highest semver release', async () => {
      mockRequest.mockResolvedValueOnce(releasesIndexFixture).mockResolvedValueOnce(releaseFixture);

      const result = await resource.latest();

      expect(result).toEqual(releaseFixture);
      expect(mockRequest).toHaveBeenNthCalledWith(
        1,
        '/apple/swift-argument-parser',
        undefined,
        undefined,
        undefined,
      );
      expect(mockRequest).toHaveBeenNthCalledWith(
        2,
        '/apple/swift-argument-parser/2.0.0',
        undefined,
        undefined,
        undefined,
      );
    });

    it('throws when releases index is empty', async () => {
      mockRequest.mockResolvedValueOnce({ releases: {} } as SwiftReleasesIndex);

      await expect(resource.latest()).rejects.toThrow('No releases found');
    });
  });

  // Slice 5: manifest(version)
  describe('manifest(version)', () => {
    it('fetches the Package.swift manifest as a string', async () => {
      const manifestContent = '// swift-tools-version:5.9\nimport PackageDescription\n';
      mockTextRequest.mockResolvedValueOnce(manifestContent);

      const result = await resource.manifest('1.1.0');

      expect(result).toBe(manifestContent);
      expect(mockTextRequest).toHaveBeenCalledWith(
        '/apple/swift-argument-parser/1.1.0/Package.swift',
        undefined,
      );
    });

    it('propagates AbortSignal for manifest', async () => {
      mockTextRequest.mockResolvedValueOnce('// swift-tools-version:5.9\n');
      const { signal } = new AbortController();

      await resource.manifest('1.1.0', signal);

      expect(mockTextRequest).toHaveBeenCalledWith(
        '/apple/swift-argument-parser/1.1.0/Package.swift',
        signal,
      );
    });
  });
});
