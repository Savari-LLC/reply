/**
 * Turns a thrown Convex error into a message worth showing a person: Convex
 * prefixes server errors with "Uncaught Error:" and appends a stack trace.
 */
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Uncaught (Error: )?/, "").replace(/ at .*$/s, "")
    : "Something went wrong. Please try again.";
}
