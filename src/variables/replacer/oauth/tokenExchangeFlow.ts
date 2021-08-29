import { OpenIdConfiguration, assertConfiguration } from './openIdConfiguration.js';
import { OpenIdInformation, requestOpenIdInformation } from './openIdInformation.js';
import { toQueryParams, decodeJWT } from '../../../utils/index.js';
import { ProcessorContext } from '../../../models/index.js';
import encodeUrl from 'encodeurl';

export class TokenExchangeFlow {
  static getCacheKey(config: OpenIdConfiguration) : string | false {
    if (assertConfiguration(config, ['tokenEndpoint', 'clientId', 'clientSecret'])) {
      return `${config.tokenEndpoint}_${config.clientId}`;
    }
    return false;
  }

  static async perform(config: OpenIdConfiguration,
    openIdInformation: OpenIdInformation,
    context: ProcessorContext): Promise<OpenIdInformation | false> {
    if (openIdInformation) {
      const jwtToken = decodeJWT(openIdInformation.accessToken);

      return requestOpenIdInformation({
        url: config.tokenEndpoint,
        method: 'POST',
        body: toQueryParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          scope: config.scope || 'openid',
          subject_issuer: config.subjectIssuer || jwtToken?.iss,
          subject_token: encodeUrl(openIdInformation.accessToken)
        })
      }, {
        httpClient: context.httpClient,
        config,
        id: openIdInformation.id,
        title: `${openIdInformation.title} (token exchange)`,
        description: openIdInformation.description,
      }, context);

    }
    return false;
  }
}
