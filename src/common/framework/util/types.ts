/** Forces a type to resolve its type definitions, to make it readable/debuggable. */
export type ResolveType<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: ResolveType<O[K]> }
    : never
  : T;

/**
 * Computes the intersection of a set of types, given the union of those types.
 *
 * From: https://stackoverflow.com/a/56375136
 */
export type UnionToIntersection<U> =
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** "Type asserts" that `X` is a subtype of `Y`. */
type Cast<X, Y> = X extends Y ? X : never;

type TupleHeadOr<T, Default> = T extends readonly [infer H, ...(readonly unknown[])] ? H : Default;
type TupleTailOr<T, Default> = T extends readonly [unknown, ...infer Tail] ? Tail : Default;
type TypeOr<T, Default> = T extends undefined ? Default : T;

/**
 * Zips a key tuple type and a value tuple type together into an object.
 *
 * As of this writing, VSCode bundles an older version of TypeScript which cannot support this.
 * Use "TypeScript: Select TypeScript Version..." in the command palette to switch.
 *
 * @template K Keys of the resulting object.
 * @template V Values of the resulting object. If an item is `undefined` or past the end, it defaults.
 * @template D Default values. If an item is past the end, it defaults to `undefined`.
 */
export type ZipKeysWithValues<
  K extends readonly string[],
  V extends readonly unknown[], // Values
  D extends readonly unknown[] = readonly []
> =
  //
  K extends readonly [infer KHead, ...infer KTail]
    ? {
        readonly [k in Cast<KHead, string>]: TypeOr<
          TupleHeadOr<V, undefined>,
          TupleHeadOr<D, undefined>
        >;
      } &
        ZipKeysWithValues<Cast<KTail, readonly string[]>, TupleTailOr<V, []>, TupleTailOr<D, []>>
    : {}; // K exhausted
