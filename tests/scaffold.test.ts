import { describe, expect, it } from 'vitest';

import { APP_NAME, APP_VERSION } from '../src/app/constants';

describe('scaffold', () => {
  it('expone el nombre de la aplicación', () => {
    expect(APP_NAME).toBe('Buscador de afinidad de voto');
  });

  it('expone una versión semántica', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
