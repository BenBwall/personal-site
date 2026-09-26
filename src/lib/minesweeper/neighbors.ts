type BoardDimensions = { columns: number; rows: number };

export const neighborsOf = (index: number, { columns, rows }: BoardDimensions): number[] => {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns) {
        neighbors.push(nextRow * columns + nextColumn);
      }
    }
  }

  return neighbors;
};
