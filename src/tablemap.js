/**
 * 因为使用跨行和跨列的单元格不是很简单，所以这段代码为给定的表节点构建了一个描述性结构。
 * 这些结构以（持久的）表节点作为键进行缓存，因此只有在表的内容发生变化时才需要重新计算它们。
 * 这确实意味着他们必须存储相对于表的位置，而不是相对于文档的位置。
 * 因此，使用它们的代码通常会计算表的起始位置以及传递给该结构或从该结构获得的偏移位置。
 */

let readFromCache
let addToCache
// Prefer using a weak map to cache table maps. Fall back on a
// fixed-size cache if that's not supported.
if (typeof WeakMap !== 'undefined') {
  const cache = new WeakMap()
  readFromCache = (key) => cache.get(key)
  addToCache = (key, value) => {
    cache.set(key, value)
    return value
  }
} else {
  const cache = []
  const cacheSize = 10
  let cachePos = 0
  readFromCache = (key) => {
    for (let i = 0; i < cache.length; i += 2) {
      if (cache[i] === key) return cache[i + 1]
    }
  }
  addToCache = (key, value) => {
    if (cachePos === cacheSize) cachePos = 0
    cache[cachePos++] = key
    return (cache[cachePos++] = value)
  }
}

export class Rect {
  constructor(left, top, right, bottom) {
    this.left = left
    this.top = top
    this.right = right
    this.bottom = bottom
  }
}

// ::- A table map describes the structore of a given table. To avoid
// recomputing them all the time, they are cached per table node. To
// be able to do that, positions saved in the map are relative to the
// start of the table, rather than the start of the document.
export class TableMap {
  constructor(width, height, map, problems) {
    // :: number The width of the table
    this.width = width
    // :: number The table's height
    this.height = height
    // :: [number] A width * height array with the start position of
    // the cell covering that part of the table in each slot
    this.map = map
    // An optional array of problems (cell overlap or non-rectangular
    // shape) for the table, used by the table normalizer.
    this.problems = problems
  }

  // :: (number) → Rect
  // Find the dimensions of the cell at the given position.
  findCell(pos) {
    for (let i = 0; i < this.map.length; i++) {
      const curPos = this.map[i]
      if (curPos !== pos) continue
      const left = i % this.width
      const top = (i / this.width) | 0
      let right = left + 1
      let bottom = top + 1
      for (let j = 1; right < this.width && this.map[i + j] === curPos; j++) {
        right++
      }
      for (
        let j = 1;
        bottom < this.height && this.map[i + this.width * j] === curPos;
        j++
      ) {
        bottom++
      }
      return new Rect(left, top, right, bottom)
    }
    throw new RangeError(`No cell with offset ${pos} found`)
  }

  // :: (number) → number
  // Find the left side of the cell at the given position.
  colCount(pos) {
    for (let i = 0; i < this.map.length; i++) {
      if (this.map[i] === pos) return i % this.width
    }
    throw new RangeError(`No cell with offset ${pos} found`)
  }

  // :: (number, string, number) → ?number
  // Find the next cell in the given direction, starting from the cell
  // at `pos`, if any.
  nextCell(pos, axis, dir) {
    const { left, right, top, bottom } = this.findCell(pos)
    if (axis === 'horiz') {
      if (dir < 0 ? left === 0 : right === this.width) return null
      return this.map[top * this.width + (dir < 0 ? left - 1 : right)]
    }
    if (dir < 0 ? top === 0 : bottom === this.height) return null
    return this.map[left + this.width * (dir < 0 ? top - 1 : bottom)]
  }

  // :: (number, number) → Rect
  // Get the rectangle spanning the two given cells.
  rectBetween(a, b) {
    const {
      left: leftA,
      right: rightA,
      top: topA,
      bottom: bottomA,
    } = this.findCell(a)
    const {
      left: leftB,
      right: rightB,
      top: topB,
      bottom: bottomB,
    } = this.findCell(b)
    return new Rect(
      Math.min(leftA, leftB),
      Math.min(topA, topB),
      Math.max(rightA, rightB),
      Math.max(bottomA, bottomB)
    )
  }

  // :: (Rect) → [number]
  // Return the position of all cells that have the top left corner in
  // the given rectangle.
  cellsInRect(rect) {
    const result = []
    const seen = {}
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const index = row * this.width + col
        const pos = this.map[index]
        if (seen[pos]) continue
        seen[pos] = true
        if (
          (col !== rect.left || !col || this.map[index - 1] !== pos) &&
          (row !== rect.top || !row || this.map[index - this.width] !== pos)
        ) {
          result.push(pos)
        }
      }
    }
    return result
  }

  // :: (number, number, Node) → number
  // Return the position at which the cell at the given row and column
  // starts, or would start, if a cell started there.
  positionAt(row, col, table) {
    for (let i = 0, rowStart = 0; ; i++) {
      const rowEnd = rowStart + table.child(i).nodeSize
      if (i === row) {
        let index = col + row * this.width
        const rowEndIndex = (row + 1) * this.width
        // Skip past cells from previous rows (via rowspan)
        while (index < rowEndIndex && this.map[index] < rowStart) index++
        return index === rowEndIndex ? rowEnd - 1 : this.map[index]
      }
      rowStart = rowEnd
    }
  }

  // :: (Node) → TableMap
  // Find the table map for the given table node.
  static get(table) {
    return readFromCache(table) || addToCache(table, computeMap(table))
  }
}

// Compute a table map.
function computeMap(table) {
  if (table.type.spec.tableRole !== 'table') {
    throw new RangeError(`Not a table node: ${table.type.name}`)
  }
  const width = findWidth(table)
  const height = table.childCount
  const map = []
  let mapPos = 0
  let problems = null
  const colWidths = []
  // eslint-disable-next-line no-plusplus
  for (let i = 0, e = width * height; i < e; i++) map[i] = 0

  for (let row = 0, pos = 0; row < height; row++) {
    const rowNode = table.child(row)
    pos++
    for (let i = 0; ; i++) {
      while (mapPos < map.length && map[mapPos] !== 0) mapPos++
      if (i === rowNode.childCount) break
      const cellNode = rowNode.child(i)
      const { colspan, rowspan, colwidth } = cellNode.attrs
      for (let h = 0; h < rowspan; h++) {
        if (h + row >= height) {
          ;(problems || (problems = [])).push({
            type: 'overlong_rowspan',
            pos,
            n: rowspan - h,
          })
          break
        }
        const start = mapPos + h * width
        for (let w = 0; w < colspan; w++) {
          if (map[start + w] === 0) map[start + w] = pos
          else {
            ;(problems || (problems = [])).push({
              type: 'collision',
              row,
              pos,
              n: colspan - w,
            })
          }
          const colW = colwidth && colwidth[w]
          if (colW) {
            const widthIndex = ((start + w) % width) * 2
            const prev = colWidths[widthIndex]
            if (
              prev == null ||
              (prev !== colW && colWidths[widthIndex + 1] === 1)
            ) {
              colWidths[widthIndex] = colW
              colWidths[widthIndex + 1] = 1
            } else if (prev === colW) {
              colWidths[widthIndex + 1]++
            }
          }
        }
      }
      mapPos += colspan
      pos += cellNode.nodeSize
    }
    const expectedPos = (row + 1) * width
    let missing = 0
    while (mapPos < expectedPos) if (map[mapPos++] === 0) missing++
    if (missing) {
      ;(problems || (problems = [])).push({ type: 'missing', row, n: missing })
    }
    pos++
  }

  const tableMap = new TableMap(width, height, map, problems)
  let badWidths = false

  // For columns that have defined widths, but whose widths disagree
  // between rows, fix up the cells whose width doesn't match the
  // computed one.
  for (let i = 0; !badWidths && i < colWidths.length; i += 2) {
    if (colWidths[i] != null && colWidths[i + 1] < height) badWidths = true
  }
  if (badWidths) findBadColWidths(tableMap, colWidths, table)

  return tableMap
}

function findWidth(table) {
  let width = -1
  let hasRowSpan = false
  for (let row = 0; row < table.childCount; row++) {
    const rowNode = table.child(row)
    let rowWidth = 0
    if (hasRowSpan) {
      for (let j = 0; j < row; j++) {
        const prevRow = table.child(j)
        for (let i = 0; i < prevRow.childCount; i++) {
          const cell = prevRow.child(i)
          if (j + cell.attrs.rowspan > row) rowWidth += cell.attrs.colspan
        }
      }
    }
    for (let i = 0; i < rowNode.childCount; i++) {
      const cell = rowNode.child(i)
      rowWidth += cell.attrs.colspan
      if (cell.attrs.rowspan > 1) hasRowSpan = true
    }
    if (width === -1) width = rowWidth
    else if (width !== rowWidth) width = Math.max(width, rowWidth)
  }
  return width
}

function findBadColWidths(map, colWidths, table) {
  if (!map.problems) map.problems = []
  for (let i = 0, seen = {}; i < map.map.length; i++) {
    const pos = map.map[i]
    if (seen[pos]) continue
    seen[pos] = true
    const node = table.nodeAt(pos)
    let updated = null
    for (let j = 0; j < node.attrs.colspan; j++) {
      const col = (i + j) % map.width
      const colWidth = colWidths[col * 2]
      if (
        colWidth != null &&
        (!node.attrs.colwidth || node.attrs.colwidth[j] !== colWidth)
      ) {
        ;(updated || (updated = freshColWidth(node.attrs)))[j] = colWidth
      }
    }
    if (updated) {
      map.problems.unshift({
        type: 'colwidth mismatch',
        pos,
        colwidth: updated,
      })
    }
  }
}

function freshColWidth(attrs) {
  if (attrs.colwidth) return attrs.colwidth.slice()
  const result = []
  for (let i = 0; i < attrs.colspan; i++) result.push(0)
  return result
}
