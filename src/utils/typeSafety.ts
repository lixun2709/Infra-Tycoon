/**
 * TypeSafety Utility Types
 * Enterprise-grade generic utility definitions to enforce compile-time verification,
 * functional error handling, and robust state immutability.
 */

/**
 * DeepReadonly
 * Recursively freezes objects and arrays at compile-time.
 * Critical for ensuring deterministic simulation state snapshots cannot be mutated.
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P]
}

/**
 * DeepPartial
 * Recursively marks all properties of an object or array as optional.
 * Highly useful for delta patching ECS components or partial state synces.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P]
}

/**
 * Prettify
 * Flattens type intersections (e.g. A & B) into a single readable object definition
 * for clearer IDE hover hints and autocomplete lists.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

/**
 * Nullable
 * Represents a type that can also be null or undefined.
 */
export type Nullable<T> = T | null | undefined

/**
 * Result
 * Functional programming pattern representing successful outcomes or structured error results.
 * Enforces explicit branch checks at compile-time instead of runtime exception crashes.
 */
export type Result<T, E = Error> = 
  | { success: true; value: T; error?: never }
  | { success: false; error: E; value?: never }

/**
 * Result Utility Functions
 */
export const success = <T>(value: T): Result<T, never> => ({
  success: true,
  value
})

export const failure = <E = Error>(error: E): Result<never, E> => ({
  success: false,
  error
})

/**
 * isSuccess
 * Type guard for Result success state
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T; error?: never } {
  return result.success
}

/**
 * isFailure
 * Type guard for Result failure state
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E; value?: never } {
  return !result.success
}
