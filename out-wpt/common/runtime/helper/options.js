/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/let windowURL = undefined;function getWindowURL() {if (windowURL === undefined) {
    windowURL = new URL(window.location.toString());
  }
  return windowURL;
}

export function optionEnabled(
opt,
searchParams = getWindowURL().searchParams)
{
  const val = searchParams.get(opt);
  return val !== null && val !== '0';
}

export function optionString(
opt,
searchParams = getWindowURL().searchParams)
{
  return searchParams.get(opt) || '';
}

/**
 * The possible options for the tests.
 */








export const kDefaultCTSOptions = {
  worker: false,
  debug: true,
  compatibility: false,
  unrollConstEvalLoops: false,
  powerPreference: ''
};

/**
 * Extra per option info.
 */






/**
 * Type for info for every option. This definition means adding an option
 * will generate a compile time error if no extra info is provided.
 */


/**
 * Options to the CTS.
 */
export const kCTSOptionsInfo = {
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
    { value: 'high-performance', description: 'high-performance' }]

  }
};

/**
 * Converts camel case to snake case.
 * Examples:
 *    fooBar -> foo_bar
 *    parseHTMLFile -> parse_html_file
 */
export function camelCaseToSnakeCase(id) {
  return id.
  replace(/(.)([A-Z][a-z]+)/g, '$1_$2').
  replace(/([a-z0-9])([A-Z])/g, '$1_$2').
  toLowerCase();
}

/**
 * Creates a Options from search parameters.
 */
function getOptionsInfoFromSearchString(
optionsInfos,
searchString)
{
  const searchParams = new URLSearchParams(searchString);
  const optionValues = {};
  for (const [optionName, info] of Object.entries(optionsInfos)) {
    const parser = info.parser || optionEnabled;
    optionValues[optionName] = parser(camelCaseToSnakeCase(optionName), searchParams);
  }
  return optionValues;
}

/**
 * converts foo/bar/src/webgpu/this/that/file.spec.ts to webgpu:this,that,file,*
 */
function convertPathToQuery(path) {
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
function convertPathLikeToQuery(queryOrPath) {
  return queryOrPath.endsWith('.spec.ts') && (
  queryOrPath.includes('/') || queryOrPath.includes('\\')) ?
  convertPathToQuery(queryOrPath) :
  queryOrPath;
}

/**
 * Given a test query string in the form of `suite:foo,bar,moo&opt1=val1&opt2=val2
 * returns the query and the options.
 */
export function parseSearchParamLikeWithOptions(
optionsInfos,
query)



{
  const searchString = query.includes('q=') || query.startsWith('?') ? query : `q=${query}`;
  const queries = new URLSearchParams(searchString).getAll('q').map(convertPathLikeToQuery);
  const options = getOptionsInfoFromSearchString(optionsInfos, searchString);
  return { queries, options };
}

/**
 * Given a test query string in the form of `suite:foo,bar,moo&opt1=val1&opt2=val2
 * returns the query and the common options.
 */
export function parseSearchParamLikeWithCTSOptions(query) {
  return parseSearchParamLikeWithOptions(kCTSOptionsInfo, query);
}