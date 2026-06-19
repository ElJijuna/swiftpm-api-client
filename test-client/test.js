// Integration test against real APIs.
// Requires: npm run build first (npm run test:client handles this).
import { SwiftPMClient } from '../dist/index.js';

const client = new SwiftPMClient({
  indexUrl: 'https://swiftpackageindex.com',
  // No registryUrl — Swift Package Registry requires authentication for most endpoints.
  // We use a public registry-compatible endpoint where available.
});

client.on('request', (e) => {
  const status = e.error ? `ERROR ${e.statusCode ?? 'N/A'}` : `${e.statusCode}`;
  console.log(`  ${e.method} ${e.url} → ${status} (${e.durationMs}ms)`);
});

async function run() {
  console.log('\n=== Swift Package Index: search ===');
  const results = await client.search({ query: 'vapor', page: 1, pageSize: 5 });
  console.log(`  hasMoreResults: ${results.hasMoreResults}`);
  for (const pkg of results.results) {
    console.log(`  - ${pkg.repositoryOwner}/${pkg.packageName} (⭐ ${pkg.stars})`);
  }

  console.log('\n=== Swift Package Index: search with pagination ===');
  const page2 = await client.search({ query: 'swift', page: 2, pageSize: 3 });
  console.log(`  hasMoreResults: ${page2.hasMoreResults}`);
  console.log(`  results: ${page2.results.length}`);

  console.log('\nAll integration tests passed.\n');
}

try {
  await run();
} catch (err) {
  console.error('\nIntegration test failed:', err);
  process.exit(1);
}
