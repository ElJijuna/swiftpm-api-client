// Integration test against real APIs.
// Requires: npm run build first (npm run test:client handles this).
//
// SPI search requires a bearer token: set SPI_TOKEN env var to enable it.
//   SPI_TOKEN=your_token npm run test:client
import { SwiftPMClient } from '../dist/index.js';

const spiToken = process.env.SPI_TOKEN;

const client = new SwiftPMClient({
  indexUrl: 'https://swiftpackageindex.com',
  ...(spiToken && { indexToken: spiToken }),
});

client.on('request', (e) => {
  const status = e.error ? `ERROR ${e.statusCode ?? 'N/A'}` : `${e.statusCode}`;
  console.log(`  ${e.method} ${e.url} → ${status} (${e.durationMs}ms)`);
});

async function run() {
  if (spiToken) {
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
  } else {
    console.log('\n[SKIP] SPI search — set SPI_TOKEN env var to enable.');
    console.log('       SPI_TOKEN=<token> npm run test:client');
  }

  console.log('\nAll integration tests passed.\n');
}

try {
  await run();
} catch (err) {
  console.error('\nIntegration test failed:', err);
  process.exit(1);
}
