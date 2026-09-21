/** Read an outer board row while retaining ordinary (possibly absent) cell access. */
export function boardRow<T>(board: readonly T[][], index: number): T[] {
  const row = board[index];
  if (row === undefined) throw new TypeError('Board row is missing.');
  return row;
}
