import { ProcessorContext } from './processorContext.js';


/**
 * @returns false if processing cancelled
 */
export interface HttpRegionAction {
  id: ActionType | string;
  process(context: ProcessorContext): Promise<boolean>;
}

export enum ActionType{
  cookieJar = 'cookieJar',
  envDefaultHeaders = 'envDefaultHeaders',
  defaultHeaders = 'defaultHeaders',
  intellij = 'intellij',
  gql = 'gql',
  loop = 'loop',
  js = 'js',
  request = 'request',
  httpClient = 'httpClient',
  import = 'import',
  ref = 'ref',
  requestBodyImport = 'requestBodyImport',
  response = 'response',
  variable = 'variable',
  variableReplacer = 'variableReplacer',
}
