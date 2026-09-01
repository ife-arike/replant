// KAN-345 — the api layer must THROW on RPC error, never fabricate
// success. The pre-deployment stub fallback resolved fabricated rows on
// ANY error (publish showed "live" while nothing reached the server);
// these tests pin the honest contract so it cannot quietly return.
import {
  fetchSubmissions,
  publishSubmission,
  requestChanges,
  submitAddressNetwork,
  withdrawSubmission,
} from './addressNetworkApi';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;

const RPC_ERROR = { message: 'boom', code: 'XX000' };

beforeEach(() => rpc.mockReset());

describe('addressNetworkApi error contract (KAN-345)', () => {
  it('fetchSubmissions rejects on RPC error instead of returning a list', async () => {
    rpc.mockResolvedValue({ data: null, error: RPC_ERROR });
    await expect(fetchSubmissions()).rejects.toEqual(RPC_ERROR);
  });

  it('submitAddressNetwork rejects on RPC error and fabricates nothing', async () => {
    rpc.mockResolvedValue({ data: null, error: RPC_ERROR });
    await expect(
      submitAddressNetwork({
        type: 'word',
        title: null,
        body: 'test',
        attribution: 'show_name',
      }),
    ).rejects.toEqual(RPC_ERROR);
  });

  it.each([
    ['publishSubmission', () => publishSubmission('id-1')],
    ['requestChanges', () => requestChanges('id-1', 'note')],
    ['withdrawSubmission', () => withdrawSubmission('id-1')],
  ])('%s rejects on RPC error', async (_name, call) => {
    rpc.mockResolvedValue({ data: null, error: RPC_ERROR });
    await expect(call()).rejects.toEqual(RPC_ERROR);
  });

  it('fetchSubmissions maps rows on success', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'abc',
          type: 'testimony',
          title: 'T',
          body: 'B',
          status: 'edits_pending_leader',
          attribution: 'show_name',
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-02T00:00:00Z',
        },
      ],
      error: null,
    });
    const rows = await fetchSubmissions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'abc',
      type: 'testimony',
      status: 'edits_proposed',
      attribution: 'show_name',
    });
  });

  it('submitAddressNetwork normalises a returned row on success', async () => {
    rpc.mockResolvedValue({
      data: { id: 'xyz', status: 'pending', type: 'word_for_today' },
      error: null,
    });
    const created = await submitAddressNetwork({
      type: 'word',
      title: null,
      body: 'test',
      attribution: 'role_region',
    });
    expect(created.id).toBe('xyz');
    expect(created.status).toBe('in_review');
  });
});
