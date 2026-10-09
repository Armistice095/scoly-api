import { BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service.js';

const createSignedUrl = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

function creer() {
  const config = {
    get: (cle: string) =>
      ({
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'cle',
        SUPABASE_STORAGE_BUCKET: 'documents',
      })[cle],
  };
  return new StorageService(config as never);
}

describe('StorageService.obtenirUrlSignee', () => {
  beforeEach(() => createSignedUrl.mockReset());

  it('transmet le nom à Supabase via `download` pour forcer l’enregistrement', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signee' },
      error: null,
    });

    const url = await creer().obtenirUrlSignee(
      'a/b.pdf',
      'Certificat de scolarite - X Y.pdf',
    );

    expect(url).toBe('https://signee');
    expect(createSignedUrl).toHaveBeenCalledWith('a/b.pdf', 3600, {
      download: 'Certificat de scolarite - X Y.pdf',
    });
  });

  it('sans nom, ne force pas le téléchargement (images du logo, etc.)', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signee' },
      error: null,
    });
    await creer().obtenirUrlSignee('a/logo.png');
    expect(createSignedUrl).toHaveBeenCalledWith('a/logo.png', 3600, undefined);
  });

  it('une erreur du stockage reste une erreur (lien indisponible), comme avant', async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'introuvable' },
    });
    await expect(
      creer().obtenirUrlSignee('a/b.pdf', 'x.pdf'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
