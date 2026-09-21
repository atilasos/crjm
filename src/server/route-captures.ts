/** Read a required capture after a route pattern has matched. */
export function requiredRouteCapture(match: RegExpMatchArray, index: number): string {
  const value = match[index];
  if (value === undefined) {
    throw new TypeError(`Route pattern is missing required capture ${index}.`);
  }
  return value;
}
