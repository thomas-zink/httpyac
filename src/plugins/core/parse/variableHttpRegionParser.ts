import * as models from '../../../models';
import * as utils from '../../../utils';
import { HookCancel, HookInterceptor, HookTriggerContext } from 'hookpoint';

const VariableHookId = 'variable';

export async function parseVariable(
  getLineReader: models.getHttpLineGenerator,
  { httpRegion }: models.ParserContext
): Promise<models.HttpRegionParserResult> {
  const lineReader = getLineReader();
  const next = lineReader.next();
  if (!next.done) {
    const textLine = next.value.textLine;

    const match = /^\s*@(?<key>[^\s=]*)\s*(?<operator>=\s*)"?(?<value>.*)"?\s*$/u.exec(textLine);

    if (match && match.groups && match.groups.key && match.groups.value) {
      const key = match.groups.key;
      const value = match.groups.value;
      if (!httpRegion.hooks.execute.hasHook(VariableHookId)) {
        httpRegion.hooks.execute.addInterceptor(new VariableInterceptor());
      }
      httpRegion.hooks.execute.addHook(VariableHookId, context => {
        context.options.replaceVariables = true;
        utils.setVariableInContext(
          {
            [key]: value,
          },
          context
        );
        return true;
      });

      return {
        nextParserLine: next.value.line,
        symbols: [
          {
            name: match.groups.key,
            description: match.groups.value,
            kind: models.HttpSymbolKind.variable,
            startLine: next.value.line,
            startOffset: 0,
            endLine: next.value.line,
            endOffset: next.value.textLine.length,
            children: [
              {
                name: match.groups.key,
                description: 'key',
                kind: models.HttpSymbolKind.key,
                startLine: next.value.line,
                startOffset: next.value.textLine.indexOf(match.groups.key),
                endLine: next.value.line,
                endOffset: next.value.textLine.indexOf(match.groups.key) + match.groups.key.length,
              },
              {
                name: match.groups.value,
                description: 'value',
                kind: models.HttpSymbolKind.value,
                startLine: next.value.line,
                startOffset: next.value.textLine.indexOf(match.groups.value),
                endLine: next.value.line,
                endOffset: next.value.textLine.indexOf(match.groups.value) + match.groups.value.length,
              },
            ],
          },
        ],
      };
    }
  }
  return false;
}

class VariableInterceptor implements HookInterceptor<[models.ProcessorContext], boolean> {
  id = 'variable';

  async beforeTrigger(hookContext: HookTriggerContext<[models.ProcessorContext], true>) {
    const context = hookContext.args[0];
    if (hookContext.hookItem?.id !== VariableHookId) {
      if (context.options.replaceVariables) {
        await this.replaceAllVariables(context);
        delete context.options.replaceVariables;
      }
    }
    return true;
  }

  private async replaceAllVariables(context: models.ProcessorContext): Promise<boolean> {
    for (const [key, value] of Object.entries(context.variables)) {
      const result = await utils.replaceVariables(value, models.VariableType.variable, context);
      if (result !== HookCancel) {
        context.variables[key] = result;
      }
    }
    return true;
  }
}
