import { ok } from 'assert';
import { ProcessorContext } from '../../models/index.js';
import { testFactory } from '../testMethod.js';
import { HttpClient as JetbrainsHttpClient, Variables as JetbrainsVariables } from './http-client.js';
import { IntellijVariables } from './intellijVariables.js';

export class IntellijHttpClient implements JetbrainsHttpClient {
  global: JetbrainsVariables;
  constructor(private readonly context: ProcessorContext) {
    this.global = new IntellijVariables(context.variables, context.httpFile.activeEnvironment);
  }
  test(testName: string, func: () => void): void {
    testFactory(this.context)(testName, func);
  }
  assert(condition: boolean, message?: string) : void {
    ok(condition, message);
  }
  log(text: string): void {
    if (this.context.scriptConsole) {
      this.context.scriptConsole.info(text);
    }
  }
}
