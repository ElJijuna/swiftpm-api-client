import { SwiftPMApiError } from './SwiftPMApiError';

describe('SwiftPMApiError', () => {
  it('carries status and statusText', () => {
    const err = new SwiftPMApiError(404, 'Not Found');
    expect(err.status).toBe(404);
    expect(err.statusText).toBe('Not Found');
  });

  it('has a descriptive message', () => {
    const err = new SwiftPMApiError(500, 'Internal Server Error');
    expect(err.message).toContain('500');
    expect(err.message).toContain('Internal Server Error');
  });

  it('is an instance of Error', () => {
    const err = new SwiftPMApiError(404, 'Not Found');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of SwiftPMApiError', () => {
    const err = new SwiftPMApiError(404, 'Not Found');
    expect(err).toBeInstanceOf(SwiftPMApiError);
  });

  it('has the correct name', () => {
    const err = new SwiftPMApiError(403, 'Forbidden');
    expect(err.name).toBe('SwiftPMApiError');
  });
});
