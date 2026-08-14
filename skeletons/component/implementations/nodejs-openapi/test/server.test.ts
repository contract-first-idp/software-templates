import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';

import {createApp} from '../src/server.js';

test('health endpoint is available', async () => {
  const app = await createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {status: 'UP'});
  } finally {
    server.close();
    await once(server, 'close');
  }
});
