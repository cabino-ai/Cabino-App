import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateContent = vi.fn();

// Mock @google/genai before importing the worker
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
  ThinkingLevel: { HIGH: 'HIGH' },
}));

// Dynamically import the worker default export after mocks are set up
const makeRequest = (method: string, path: string, body?: unknown) =>
  new Request(`https://app.cabino.ai${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

const makeEnv = (overrides: Record<string, string> = {}) => ({
  ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('static', { status: 200 })) },
  GEMINI_API_KEY: 'test-key',
  ...overrides,
});

describe('Worker routing', () => {
  let worker: typeof import('./worker').default;

  beforeEach(async () => {
    mockGenerateContent.mockReset();
    worker = (await import('./worker')).default;
  });

  it('passes non-API GET requests to ASSETS', async () => {
    const env = makeEnv();
    await worker.fetch(makeRequest('GET', '/'), env as any);
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it('passes unknown POST paths to ASSETS', async () => {
    const env = makeEnv();
    await worker.fetch(makeRequest('POST', '/api/unknown'), env as any);
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it('returns 500 when GEMINI_API_KEY is missing on /api/generate-prompt', async () => {
    const env = makeEnv({ GEMINI_API_KEY: '' });
    const res = await worker.fetch(
      makeRequest('POST', '/api/generate-prompt', { roomImage: '', cabinetImages: [] }),
      env as any
    );
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('returns 500 when GEMINI_API_KEY is missing on /api/generate-image', async () => {
    const env = makeEnv({ GEMINI_API_KEY: '' });
    const res = await worker.fetch(
      makeRequest('POST', '/api/generate-image', { roomImage: '', cabinetImages: [], prompt: '' }),
      env as any
    );
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('calls Gemini and returns a prompt on /api/generate-prompt', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Generated prompt' });

    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('POST', '/api/generate-prompt', {
        roomImage: 'data:image/jpeg;base64,abc',
        cabinetImages: [],
        extendToCeiling: false,
        stageRoom: false,
      }),
      env as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.prompt).toBe('Generated prompt');
  });
});
