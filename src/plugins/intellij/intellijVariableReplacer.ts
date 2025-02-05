import * as utils from '../../utils';
import { v4 } from 'uuid';

export async function replaceDynamicIntellijVariables(text: unknown): Promise<unknown> {
  if (!utils.isString(text)) {
    return text;
  }
  let match: RegExpExecArray | null;
  let result = text;
  while ((match = utils.HandlebarsSingleLine.exec(text)) !== null) {
    const [searchValue, variable] = match;

    let replacement: unknown = null;
    switch (variable.trim()) {
      case '$uuid':
        replacement = v4();
        break;
      case '$timestamp':
        replacement = Date.now();
        break;
      case '$randomInt':
        replacement = Math.floor(Math.random() * 1000);
        break;
      default:
        replacement = null;
        break;
    }
    if (replacement) {
      result = result.replace(searchValue, `${replacement}`);
    }
  }
  return result;
}
