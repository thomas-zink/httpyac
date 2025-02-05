import * as models from '../../../../models';
import { setEnvRequestOptions } from '../setEnvRequestOptions';

describe('setEnvRequestOptions', () => {
  describe('setEnvRequestOptions', () => {
    it('should set rejectUnauthorized=false', async () => {
      const request: models.HttpRequest = { protocol: 'HTTP', options: {} };
      await setEnvRequestOptions(request, {
        variables: { request_rejectUnauthorized: false },
      } as unknown as models.ProcessorContext);
      expect(request.options.https?.rejectUnauthorized).toEqual(false);
    });
    it('should set rejectUnauthorized=false', async () => {
      const request: models.HttpRequest = { protocol: 'HTTP', options: {} };
      await setEnvRequestOptions(request, {
        variables: { request_rejectUnauthorized: 'false' },
      } as unknown as models.ProcessorContext);
      expect(request.options.https?.rejectUnauthorized).toEqual(false);
    });
    it('should set rejectUnauthorized=true', async () => {
      const request: models.HttpRequest = { protocol: 'HTTP', options: {} };
      await setEnvRequestOptions(request, {
        variables: { request_rejectUnauthorized: 'true' },
      } as unknown as models.ProcessorContext);
      expect(request.options.https?.rejectUnauthorized).toEqual(true);
    });
    it('should ignore rejectUnauthorized', async () => {
      const request: models.HttpRequest = { protocol: 'HTTP', options: {} };
      await setEnvRequestOptions(request, {
        variables: {},
      } as unknown as models.ProcessorContext);
      expect(request.options.https?.rejectUnauthorized).toBeUndefined();
    });
    it('should set proxy', async () => {
      const httpRegion = {
        metaData: {},
      } as models.HttpRegion;
      await setEnvRequestOptions({ protocol: 'HTTP' }, {
        httpRegion,
        variables: {
          request_proxy: 'http://localhost:8080',
        },
      } as unknown as models.ProcessorContext);
      expect(httpRegion.metaData.proxy).toBe('http://localhost:8080');
    });
  });
});
