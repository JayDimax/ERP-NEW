import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/TokenManager', () => ({
  TokenManager: {
    getAccessToken: vi.fn(),
  },
}));

import { SupabaseDataService } from '../services/SupabaseDataService';
import { TokenManager } from '../services/TokenManager';

describe('SupabaseDataService course fee requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends the authenticated user JWT and sanitizes immutable/nullable fields on updateCourseFee', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('supabase-user-jwt');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ id: 'fee-1', fee_name: 'Tuition', amount: 1250 }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'sb_publishable_example';

    await service.updateCourseFee('fee-1', {
      id: 'fee-1',
      orgId: 'org-1',
      feeName: 'Tuition',
      amount: 1250,
      taxCategoryId: '',
      isSubjectToEwt: false,
      ewtRate: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      isDeleted: false,
    });

    expect(TokenManager.getAccessToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/course_fees?id=eq.fee-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          apikey: 'sb_publishable_example',
          Authorization: 'Bearer supabase-user-jwt',
          Prefer: 'return=representation',
        }),
      })
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      fee_name: 'Tuition',
      amount: 1250,
      tax_category_id: null,
      is_subject_to_ewt: false,
      ewt_rate: null,
    });
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('org_id');
    expect(body).not.toHaveProperty('created_at');
    expect(body).not.toHaveProperty('is_deleted');
  });

  it('rejects silent no-op updates when RLS returns no updated row', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('supabase-user-jwt');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'sb_publishable_example';

    await expect(
      service.updateCourseFee('fee-1', { feeName: 'Tuition', amount: 1500 })
    ).rejects.toThrow(/did not update a row/i);
  });

  it('paginates getCourseFeesByOrg beyond 1,000 rows so all organization course fees load', async () => {
    vi.mocked(TokenManager.getAccessToken).mockResolvedValue('supabase-user-jwt');
    const firstPage = Array.from({ length: 1000 }, (_, idx) => ({
      id: `fee-${idx + 1}`,
      org_id: 'org-1',
      fee_code: `FEE-${String(idx + 1).padStart(4, '0')}`,
      fee_name: `Fee ${idx + 1}`,
      amount: '1000.00',
      is_active: true,
      is_deleted: false,
    }));
    const secondPage = [
      {
        id: 'fee-1001',
        org_id: 'org-1',
        fee_code: 'FEE-1001',
        fee_name: 'Fee 1001',
        amount: '2500.00',
        is_active: true,
        is_deleted: false,
      },
    ];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseDataService();
    (service as any).supabaseUrl = 'https://example.supabase.co';
    (service as any).supabaseKey = 'sb_publishable_example';

    const fees = await service.getCourseFeesByOrg('org-1');

    expect(fees).toHaveLength(1001);
    expect(fees[1000]).toMatchObject({
      id: 'fee-1001',
      feeCode: 'FEE-1001',
      feeName: 'Fee 1001',
      amount: 2500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Range: '0-999' });
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({ Range: '1000-1999' });
  });
});
