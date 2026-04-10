/**
 * Spinner utility for wrapping async operations with an ora spinner.
 */

import ora from "ora";

/**
 * Runs an async function with an ora spinner.
 * The spinner stops on completion or failure.
 *
 * @param label - Text to display alongside the spinner.
 * @param fn - Async function to execute while the spinner is active.
 * @returns The resolved value of `fn`.
 * @throws Re-throws any error thrown by `fn` after stopping the spinner.
 */
export async function withSpinner<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
