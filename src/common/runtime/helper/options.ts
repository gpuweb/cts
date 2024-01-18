let windowURL: URL | undefined = undefined;
function getWindowURL() {
  if (windowURL === undefined) {
    windowURL = new URL(window.location.toString());
  }
  return windowURL;
}

export function optionEnabled(
  opt: string,
  searchParams: URLSearchParams = getWindowURL().searchParams
): boolean {
  const val = searchParams.get(opt);
  return val !== null && val !== '0';
}

export function optionString(
  opt: string,
  searchParams: URLSearchParams = getWindowURL().searchParams
): string {
  return searchParams.get(opt) || '';
}

/**
 * The possible options for the tests.
 */
export interface CTSOptions {
  worker: boolean;
  debug: boolean;
  compatibility: boolean;
  unrollConstEvalLoops: boolean;
  powerPreference?: GPUPowerPreference | '';
}

export const kDefaultCTSOptions: CTSOptions = {
  worker: false,
  debug: true,
  compatibility: false,
  unrollConstEvalLoops: false,
  powerPreference: '',
};

/**
 * Extra per option info.
 */
export interface OptionInfo {
  description: string;
  parser?: (key: string, searchParams?: URLSearchParams) => boolean | string;
  selectValueDescriptions?: { value: string; description: string }[];
}

/**
 * Type for info for every option. This definition means adding an option
 * will generate a compile time error if no extra info is provided.
 */
export type OptionsInfos<Type> = Record<keyof Type, OptionInfo>;

/**
 * Options to the CTS.
 */
export const kCTSOptionsInfo: OptionsInfos<CTSOptions> = {
  worker: { description: 'run in a worker' },
  debug: { description: 'show more info' },
  compatibility: { description: 'run in compatibility mode' },
  unrollConstEvalLoops: { description: 'unroll const eval loops in WGSL' },
  powerPreference: {
    description: 'set default powerPreference for some tests',
    parser: optionString,
    selectValueDescriptions: [
      { value: '', description: 'default' },
      { value: 'low-power', description: 'low-power' },
      { value: 'high-performance', description: 'high-performance' },
    ],
  },
};

/**
 * Converts camel case to snake case.
 * Examples:
 *    fooBar -> foo_bar
 *    parseHTMLFile -> parse_html_file
 */
export function camelCaseToSnakeCase(id: string) {
  return id
    .replace(/(.)([A-Z][a-z]+)/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Creates a Options from search parameters.
 */
function getOptionsInfoFromSearchString<Type extends CTSOptions>(
  optionsInfos: OptionsInfos<Type>,
  searchString: string
): Type {
  const searchParams = new URLSearchParams(searchString);
  const optionValues: Record<string, boolean | string> = {};
  for (const [optionName, info] of Object.entries(optionsInfos)) {
    const parser = info.parser || optionEnabled;
    optionValues[optionName] = parser(camelCaseToSnakeCase(optionName), searchParams);
  }
  return optionValues as unknown as Type;
}

/**
 * converts foo/bar/src/webgpu/this/that/file.spec.ts to webgpu:this,that,file,*
 */
function convertPathToQuery(path: string) {
  // removes .spec.ts and splits by directory separators.
  const parts = path.substring(0, path.length - 8).split(/\/|\\/g);
  // Gets parts only after the last `src`. Example: returns ['webgpu', 'foo', 'bar', 'test']
  // for ['Users', 'me', 'src', 'cts', 'src', 'webgpu', 'foo', 'bar', 'test']
  const partsAfterSrc = parts.slice(parts.lastIndexOf('src') + 1);
  const suite = partsAfterSrc.shift();
  return `${suite}:${partsAfterSrc.join(',')},*`;
}

/**
 * If a query looks like a path (ends in .spec.ts and has directory separators)
 * then convert try to convert it to a query.
 */
function convertPathLikeToQuery(queryOrPath: string) {
  return queryOrPath.endsWith('.spec.ts') &&
    (queryOrPath.includes('/') || queryOrPath.includes('\\'))
    ? convertPathToQuery(queryOrPath)
    : queryOrPath;
}

/**
 * Given a test query string in the form of `suite:foo,bar,moo&opt1=val1&opt2=val2
 * returns the query and the options.
 */
export function parseSearchParamLikeWithOptions<Type extends CTSOptions>(
  optionsInfos: OptionsInfos<Type>,
  query: string
): {
  queries: string[];
  options: Type;
} {
  const searchString = query.includes('q=') || query.startsWith('?') ? query : `q=${query}`;
  const queries = new URLSearchParams(searchString).getAll('q').map(convertPathLikeToQuery);
  const options = getOptionsInfoFromSearchString(optionsInfos, searchString);
  return { queries, options };
}

/**
 * Given a test query string in the form of `suite:foo,bar,moo&opt1=val1&opt2=val2
 * returns the query and the common options.
 */
export function parseSearchParamLikeWithCTSOptions(query: string) {
  return parseSearchParamLikeWithOptions(kCTSOptionsInfo, query);
}
