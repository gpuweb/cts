import { ResolveType, ZipKeysWithValues } from './types.js';

export type valueof<K> = K[keyof K];

export function keysOf<T extends string>(obj: { [k in T]: unknown }): readonly T[] {
  return (Object.keys(obj) as unknown[]) as T[];
}

export function numericKeysOf<T>(obj: object): readonly T[] {
  return (Object.keys(obj).map(n => Number(n)) as unknown[]) as T[];
}

/**
 * @returns a new Record from @p objects, using the string returned by Object.toString() as the keys
 * and the objects as the values.
 */
export function objectsToRecord<T extends Object>(objects: readonly T[]): Record<string, T> {
  const record = {};
  return objects.reduce((obj, type) => {
    return {
      ...obj,
      [type.toString()]: type,
    };
  }, record);
}

/**
 * Creates an info lookup object from a more nicely-formatted table. See below for examples.
 *
 * Note: Using `as const` on the arguments to this function is necessary to infer the correct type.
 */
export function makeTable<
  Members extends readonly string[],
  Defaults extends readonly unknown[],
  Table extends { readonly [k: string]: readonly unknown[] }
>(
  members: Members,
  defaults: Defaults,
  table: Table
): {
  readonly [k in keyof Table]: ResolveType<ZipKeysWithValues<Members, Table[k], Defaults>>;
} {
  const result: { [k: string]: { [m: string]: unknown } } = {};
  for (const [k, v] of Object.entries<readonly unknown[]>(table)) {
    const item: { [m: string]: unknown } = {};
    for (let i = 0; i < members.length; ++i) {
      item[members[i]] = v[i] ?? defaults[i];
    }
    result[k] = item;
  }
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return result as any;
}

/**
 * Creates an info lookup object from a more nicely-formatted table.
 *
 * Note: Using `as const` on the arguments to this function is necessary to infer the correct type.
 *
 * Example:
 *
 * ```
 * const t = makeTableWithDefaults(
 *   'c',                    // defaultName
 *   ['a', 'default', 'd'],  // members
 *   ['a', 'b', 'c', 'd'],   // dataMembers
 *   [123, 456, 789, 1011],  // defaults
 *   {                       // table
 *     foo: [1, 2, 3, 4],
 *     bar: [5,  ,  , 8],
 *     moo: [ , 9,10,  ],
 *   }
 * );
 *
 * // t = {
 * //   foo: { a:   1, default:   3, d:    4 },
 * //   bar: { a:   5, default: 789, d:    8 },
 * //   moo: { a: 123, default:  10, d: 1011 },
 * // };
 * ```
 *
 * @param defaultName the name of the column in the table that will be assigned to the 'default' property of each entry.
 * @param members the names of properties you want in the generated lookup table. This must be a subset of the columns of the tables except for the name 'default' which is looked from the previous argument.
 * @param dataMembers the names of the columns of the name
 * @param defaults the default value by column for any element in a row of the table that is undefined
 * @param table named table rows.
 */
export function makeTableWithDefaults<
  Members extends readonly string[],
  DataMembers extends readonly string[],
  Defaults extends readonly unknown[],
  Table extends { readonly [k: string]: readonly unknown[] }
>(
  defaultName: string,
  members: Members,
  dataMembers: DataMembers,
  defaults: Defaults,
  table: Table
): {
  readonly [k in keyof Table]: ResolveType<ZipKeysWithValues<Members, Table[k], Defaults>>;
} {
  const result: { [k: string]: { [m: string]: unknown } } = {};
  const keyToIndex = new Map<string, number>(
    members.map(name => [name, dataMembers.indexOf(name === 'default' ? defaultName : name)])
  );
  for (const [k, v] of Object.entries<readonly unknown[]>(table)) {
    const item: { [m: string]: unknown } = {};
    for (const member of members) {
      const ndx = keyToIndex.get(member)!;
      item[member] = v[ndx] ?? defaults[ndx];
    }
    result[k] = item;
  }
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return result as any;
}
