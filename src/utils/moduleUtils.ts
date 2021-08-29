import path from 'path';
import Module from 'module';
import vm from 'vm';
import { log, fileProvider } from '../io/index.js';
import { isPromise } from './promiseUtils.js';
import { EOL } from 'os';
import { PathLike } from '../models/index.js';


// Use `Module.createRequire` if available (added in Node v12.2.0)
const createRequire = Module.createRequire || function createModuleRequire(fileName) {
  return createModule(fileName as string, 'module.exports = require;').exports;
};

export function resolveModule(request: string, context: string): string | undefined {
  let resolvedPath: string | undefined;
  try {
    try {
      resolvedPath = createRequire(path.resolve(context, 'package.json')).resolve(request);
    } catch (e) {
      resolvedPath = global.require.resolve(request, { paths: [context] });
    }
  } catch (e) {
    log.debug(e);
  }
  return resolvedPath;
}

export function loadModule<T>(request: string, context: string): T | undefined {
  try {
    return createRequire(path.resolve(context, 'package.json'))(request);
  } catch (e) {
    const resolvedPath = resolveModule(request, context);
    if (resolvedPath) {
      return global.require(resolvedPath);
    }
  }
  return undefined;
}

function createModule(filename: string, source?: string | undefined): Module {
  const mod = new Module(filename);
  mod.filename = filename;
  // see https://github.com/nodejs/node/blob/master/lib/internal/modules/cjs/loader.js#L565-L640
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
  mod.paths = (Module as any)._nodeModulePaths(path.dirname(filename));
  if (source) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
    (mod as any)._compile(source, filename);
  }
  return mod;
}

export async function runScript(source: string, options: {
  fileName: PathLike,
  lineOffset: number,
  context: Record<string, unknown>,
  require?: Record<string, unknown>,
}): Promise<Record<string, unknown>> {

  const filename = fileProvider.fsPath(options.fileName);

  const mod = createModule(filename);

  function extendedRequire(id: string) {
    if (options.require && options.require[id]) {
      return options.require[id];
    }
    return mod.require(id);
  }

  const context = vm.createContext({
    ...global,
    Buffer,
    process,
    requireUncached: (id: string) => mod.require(id),
    ...options.context,
  });

  const compiledWrapper = vm.runInContext(Module.wrap(`${EOL}${source}`), context, {
    filename,
    lineOffset: options.lineOffset,
    displayErrors: true,
  });
  compiledWrapper.apply(context, [
    mod.exports,
    extendedRequire,
    mod,
    filename,
    path.dirname(filename),
  ]);

  let result = mod.exports;
  if (isPromise(result)) {
    result = await result;
  } else {
    for (const [key, value] of Object.entries(result)) {
      if (isPromise(value)) {
        result[key] = await value;
      }
    }
  }
  return result;

}
