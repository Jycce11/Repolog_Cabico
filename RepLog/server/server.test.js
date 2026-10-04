import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, seedFallbackData } from './server.js';

test('fallback app exposes exercises as an array', async () => {
  const data = seedFallbackData();
  const app = createApp({ dataPath: ':memory:' });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/exercises`);
    assert.equal(response.status, 200);
    const exercises = await response.json();
    assert.ok(Array.isArray(exercises));
    assert.ok(exercises.length > 0);
    assert.equal(exercises[0].name, 'Bench Press');
    assert.ok(Array.isArray(data.exercises));
  } finally {
    server.close();
  }
});
