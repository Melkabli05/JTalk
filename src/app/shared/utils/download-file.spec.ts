import { downloadText } from './download-file';

describe('downloadText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers the text as a file with the given name, then lets go of the temporary address', async () => {
    const create = vi.fn().mockReturnValue('blob:one');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadText('notes.md', 'مرحبا', 'text/markdown');

    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(await blob.text()).toBe('مرحبا');
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('notes.md');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:one');
    vi.unstubAllGlobals();
  });
});
