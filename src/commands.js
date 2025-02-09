/**
 * 该文件实现了表格相关的 commands
 */
import { TextSelection } from 'prosemirror-state'
import { Fragment } from 'prosemirror-model'
import { Rect, TableMap } from './tablemap'
import { CellSelection } from './cellselection'
import {
  addColSpan,
  cellAround,
  cellWrapping,
  columnIsHeader,
  isInTable,
  moveCellForward,
  removeColSpan,
  selectionCell,
  setAttr,
} from './util'
import { tableNodeTypes } from './schema'

/**
 * 帮助获取表格中选定的矩形（如果有），为方便起见，向对象添加表映射、表节点和表起始偏移量
 * @param state
 * @returns {*}
 */
export function selectedRect(state) {
  const sel = state.selection
  const $pos = selectionCell(state)
  const table = $pos.node(-1)
  const tableStart = $pos.start(-1)
  const map = TableMap.get(table)
  let rect
  if (sel instanceof CellSelection) {
    rect = map.rectBetween(
      sel.$anchorCell.pos - tableStart,
      sel.$headCell.pos - tableStart
    )
  } else rect = map.findCell($pos.pos - tableStart)
  rect.tableStart = tableStart
  rect.map = map
  rect.table = table
  return rect
}

/**
 * 在表中的给定位置添加一列
 * @param tr
 * @param map
 * @param tableStart
 * @param table
 * @param col
 * @returns {*}
 */
export function addColumn(tr, { map, tableStart, table }, col) {
  let refColumn = col > 0 ? -1 : 0
  if (columnIsHeader(map, table, col + refColumn)) {
    refColumn = col === 0 || col === map.width ? null : 0
  }

  for (let row = 0; row < map.height; row++) {
    const index = row * map.width + col
    // If this position falls inside a col-spanning cell
    if (col > 0 && col < map.width && map.map[index - 1] === map.map[index]) {
      const pos = map.map[index]
      const cell = table.nodeAt(pos)
      tr.setNodeMarkup(
        tr.mapping.map(tableStart + pos),
        null,
        addColSpan(cell.attrs, col - map.colCount(pos))
      )
      // Skip ahead if rowspan > 1
      row += cell.attrs.rowspan - 1
    } else {
      const type =
        refColumn == null
          ? tableNodeTypes(table.type.schema).cell
          : table.nodeAt(map.map[index + refColumn]).type
      const pos = map.positionAt(row, col, table)
      tr.insert(tr.mapping.map(tableStart + pos), type.createAndFill())
    }
  }
  return tr
}

/**
 * 在有选择的列之前添加一列
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function addColumnBefore(state, dispatch) {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addColumn(state.tr, rect, rect.left))
  }
  return true
}

/**
 * 在有选择的列之后添加一列
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function addColumnAfter(state, dispatch) {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addColumn(state.tr, rect, rect.right))
  }
  return true
}

/**
 * 删除列
 * @param tr
 * @param map
 * @param table
 * @param tableStart
 * @param col
 */
export function removeColumn(tr, { map, table, tableStart }, col) {
  const mapStart = tr.mapping.maps.length
  for (let row = 0; row < map.height; ) {
    const index = row * map.width + col
    const pos = map.map[index]
    const cell = table.nodeAt(pos)
    // If this is part of a col-spanning cell
    if (
      (col > 0 && map.map[index - 1] === pos) ||
      (col < map.width - 1 && map.map[index + 1] === pos)
    ) {
      tr.setNodeMarkup(
        tr.mapping.slice(mapStart).map(tableStart + pos),
        null,
        removeColSpan(cell.attrs, col - map.colCount(pos))
      )
    } else {
      const start = tr.mapping.slice(mapStart).map(tableStart + pos)
      tr.delete(start, start + cell.nodeSize)
    }
    row += cell.attrs.rowspan
  }
}

/**
 * 从表格中指定位置删除列
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function deleteColumn(state, dispatch) {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    const { tr } = state
    if (rect.left === 0 && rect.right === rect.map.width) return false
    for (let i = rect.right - 1; ; i--) {
      removeColumn(tr, rect, i)
      if (i === rect.left) break
      rect.table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc
      rect.map = TableMap.get(rect.table)
    }
    dispatch(tr)
  }
  return true
}

/**
 * 行是标题
 * @param map
 * @param table
 * @param row
 * @returns {boolean}
 */
export function rowIsHeader(map, table, row) {
  const headerCell = tableNodeTypes(table.type.schema).header_cell
  for (let col = 0; col < map.width; col++) {
    if (table.nodeAt(map.map[col + row * map.width]).type !== headerCell) {
      return false
    }
  }
  return true
}

/**
 * 添加行
 * @param tr
 * @param map
 * @param tableStart
 * @param table
 * @param row
 * @returns {*}
 */
export function addRow(tr, { map, tableStart, table }, row) {
  let rowPos = tableStart
  for (let i = 0; i < row; i++) rowPos += table.child(i).nodeSize
  const cells = []
  let refRow = row > 0 ? -1 : 0
  if (rowIsHeader(map, table, row + refRow)) {
    refRow = row === 0 || row === map.height ? null : 0
  }
  for (let col = 0, index = map.width * row; col < map.width; col++, index++) {
    // Covered by a rowspan cell
    if (
      row > 0 &&
      row < map.height &&
      map.map[index] === map.map[index - map.width]
    ) {
      const pos = map.map[index]
      const { attrs } = table.nodeAt(pos)
      tr.setNodeMarkup(
        tableStart + pos,
        null,
        setAttr(attrs, 'rowspan', attrs.rowspan + 1)
      )
      col += attrs.colspan - 1
    } else {
      const type =
        refRow == null
          ? tableNodeTypes(table.type.schema).cell
          : table.nodeAt(map.map[index + refRow * map.width]).type
      cells.push(type.createAndFill())
    }
  }
  tr.insert(rowPos, tableNodeTypes(table.type.schema).row.create(null, cells))
  return tr
}

/**
 * 在选择位置之前添加行
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function addRowBefore(state, dispatch) {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addRow(state.tr, rect, rect.top))
  }
  return true
}

/**
 * 在选择位置之后添加行
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function addRowAfter(state, dispatch) {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addRow(state.tr, rect, rect.bottom))
  }
  return true
}

/**
 * 删除行
 * @param tr
 * @param map
 * @param table
 * @param tableStart
 * @param row
 */
export function removeRow(tr, { map, table, tableStart }, row) {
  let rowPos = 0
  for (let i = 0; i < row; i++) rowPos += table.child(i).nodeSize
  const nextRow = rowPos + table.child(row).nodeSize

  const mapFrom = tr.mapping.maps.length
  tr.delete(rowPos + tableStart, nextRow + tableStart)

  for (let col = 0, index = row * map.width; col < map.width; col++, index++) {
    const pos = map.map[index]
    if (row > 0 && pos === map.map[index - map.width]) {
      // If this cell starts in the row above, simply reduce its rowspan
      const { attrs } = table.nodeAt(pos)
      tr.setNodeMarkup(
        tr.mapping.slice(mapFrom).map(pos + tableStart),
        null,
        setAttr(attrs, 'rowspan', attrs.rowspan - 1)
      )
      col += attrs.colspan - 1
    } else if (row < map.width && pos === map.map[index + map.width]) {
      // Else, if it continues in the row below, it has to be moved down
      const cell = table.nodeAt(pos)
      const copy = cell.type.create(
        setAttr(cell.attrs, 'rowspan', cell.attrs.rowspan - 1),
        cell.content
      )
      const newPos = map.positionAt(row + 1, col, table)
      tr.insert(tr.mapping.slice(mapFrom).map(tableStart + newPos), copy)
      col += cell.attrs.colspan - 1
    }
  }
}

/**
 * 从表格中删除指定的行
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function deleteRow(state, dispatch) {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    const { tr } = state
    if (rect.top === 0 && rect.bottom === rect.map.height) return false
    for (let i = rect.bottom - 1; ; i--) {
      removeRow(tr, rect, i)
      if (i === rect.top) break
      rect.table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc
      rect.map = TableMap.get(rect.table)
    }
    dispatch(tr)
  }
  return true
}

/**
 * 是空单元格
 * @param cell
 * @returns {boolean}
 */
function isEmpty(cell) {
  const c = cell.content
  return (
    c.childCount === 1 &&
    c.firstChild.isTextblock &&
    c.firstChild.childCount === 0
  )
}

/**
 * 单元格重叠矩形
 * @param width
 * @param height
 * @param map
 * @param rect
 * @returns {boolean}
 */
function cellsOverlapRectangle({ width, height, map }, rect) {
  let indexTop = rect.top * width + rect.left
  let indexLeft = indexTop
  let indexBottom = (rect.bottom - 1) * width + rect.left
  let indexRight = indexTop + (rect.right - rect.left - 1)
  for (let i = rect.top; i < rect.bottom; i++) {
    if (
      (rect.left > 0 && map[indexLeft] === map[indexLeft - 1]) ||
      (rect.right < width && map[indexRight] === map[indexRight + 1])
    ) {
      return true
    }
    indexLeft += width
    indexRight += width
  }
  for (let i = rect.left; i < rect.right; i++) {
    if (
      (rect.top > 0 && map[indexTop] === map[indexTop - width]) ||
      (rect.bottom < height && map[indexBottom] === map[indexBottom + width])
    ) {
      return true
    }
    indexTop++
    indexBottom++
  }
  return false
}

/**
 * 合并单元格
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function mergeCells(state, dispatch) {
  const sel = state.selection
  if (
    !(sel instanceof CellSelection) ||
    sel.$anchorCell.pos === sel.$headCell.pos
  ) {
    return false
  }
  const rect = selectedRect(state)
  const { map } = rect
  if (cellsOverlapRectangle(map, rect)) return false
  if (dispatch) {
    const { tr } = state
    const seen = {}
    let content = Fragment.empty
    let mergedPos
    let mergedCell
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const cellPos = map.map[row * map.width + col]
        const cell = rect.table.nodeAt(cellPos)
        if (seen[cellPos]) continue
        seen[cellPos] = true
        if (mergedPos == null) {
          mergedPos = cellPos
          mergedCell = cell
        } else {
          if (!isEmpty(cell)) content = content.append(cell.content)
          const mapped = tr.mapping.map(cellPos + rect.tableStart)
          tr.delete(mapped, mapped + cell.nodeSize)
        }
      }
    }
    tr.setNodeMarkup(
      mergedPos + rect.tableStart,
      null,
      setAttr(
        addColSpan(
          mergedCell.attrs,
          mergedCell.attrs.colspan,
          rect.right - rect.left - mergedCell.attrs.colspan
        ),
        'rowspan',
        rect.bottom - rect.top
      )
    )
    if (content.size) {
      const end = mergedPos + 1 + mergedCell.content.size
      const start = isEmpty(mergedCell) ? mergedPos + 1 : end
      tr.replaceWith(start + rect.tableStart, end + rect.tableStart, content)
    }
    tr.setSelection(
      new CellSelection(tr.doc.resolve(mergedPos + rect.tableStart))
    )
    dispatch(tr)
  }
  return true
}

/**
 * 拆分单元格
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function splitCell(state, dispatch) {
  const nodeTypes = tableNodeTypes(state.schema)
  return splitCellWithType(({ node }) => nodeTypes[node.type.spec.tableRole])(
    state,
    dispatch
  )
}

/**
 * 根据类型拆分单元格
 * @param getCellType
 * @returns {(function(*, *): (boolean))|*}
 */
export function splitCellWithType(getCellType) {
  return (state, dispatch) => {
    const sel = state.selection
    let cellNode
    let cellPos
    if (!(sel instanceof CellSelection)) {
      cellNode = cellWrapping(sel.$from)
      if (!cellNode) return false
      cellPos = cellAround(sel.$from).pos
    } else {
      if (sel.$anchorCell.pos !== sel.$headCell.pos) return false
      cellNode = sel.$anchorCell.nodeAfter
      cellPos = sel.$anchorCell.pos
    }
    if (cellNode.attrs.colspan === 1 && cellNode.attrs.rowspan === 1) {
      return false
    }
    if (dispatch) {
      let baseAttrs = cellNode.attrs
      const attrs = []
      const { colwidth } = baseAttrs
      if (baseAttrs.rowspan > 1) baseAttrs = setAttr(baseAttrs, 'rowspan', 1)
      if (baseAttrs.colspan > 1) baseAttrs = setAttr(baseAttrs, 'colspan', 1)
      const rect = selectedRect(state)
      const { tr } = state
      for (let i = 0; i < rect.right - rect.left; i++) {
        attrs.push(
          colwidth
            ? setAttr(
                baseAttrs,
                'colwidth',
                colwidth && colwidth[i] ? [colwidth[i]] : null
              )
            : baseAttrs
        )
      }
      let lastCell
      for (let row = rect.top; row < rect.bottom; row++) {
        let pos = rect.map.positionAt(row, rect.left, rect.table)
        if (row === rect.top) pos += cellNode.nodeSize
        for (let col = rect.left, i = 0; col < rect.right; col++, i++) {
          if (col === rect.left && row === rect.top) continue
          tr.insert(
            (lastCell = tr.mapping.map(pos + rect.tableStart, 1)),
            getCellType({ node: cellNode, row, col }).createAndFill(attrs[i])
          )
        }
      }
      tr.setNodeMarkup(
        cellPos,
        getCellType({ node: cellNode, row: rect.top, col: rect.left }),
        attrs[0]
      )
      if (sel instanceof CellSelection) {
        tr.setSelection(
          new CellSelection(
            tr.doc.resolve(sel.$anchorCell.pos),
            lastCell && tr.doc.resolve(lastCell)
          )
        )
      }
      dispatch(tr)
    }
    return true
  }
}

/**
 * 设置单元格属性
 * @param name
 * @param value
 * @returns {(function(*, *): (boolean))|*}
 */
export function setCellAttr(name, value) {
  return function (state, dispatch) {
    if (!isInTable(state)) return false
    const $cell = selectionCell(state)
    if ($cell.nodeAfter.attrs[name] === value) return false
    if (dispatch) {
      const { tr } = state
      if (state.selection instanceof CellSelection) {
        state.selection.forEachCell((node, pos) => {
          if (node.attrs[name] !== value) {
            tr.setNodeMarkup(pos, null, setAttr(node.attrs, name, value))
          }
        })
      } else {
        tr.setNodeMarkup(
          $cell.pos,
          null,
          setAttr($cell.nodeAfter.attrs, name, value)
        )
      }
      dispatch(tr)
    }
    return true
  }
}

/**
 * 不推荐使用的切换标题
 * @param type
 * @returns {(function(*, *): (boolean))|*}
 */
function deprecatedToggleHeader(type) {
  return function (state, dispatch) {
    if (!isInTable(state)) return false
    if (dispatch) {
      const types = tableNodeTypes(state.schema)
      const rect = selectedRect(state)
      const { tr } = state
      const cells = rect.map.cellsInRect(
        // eslint-disable-next-line no-nested-ternary
        type === 'column'
          ? new Rect(rect.left, 0, rect.right, rect.map.height)
          : type === 'row'
          ? new Rect(0, rect.top, rect.map.width, rect.bottom)
          : rect
      )
      const nodes = cells.map((pos) => rect.table.nodeAt(pos))
      for (
        let i = 0;
        i < cells.length;
        i++ // Remove headers, if any
      ) {
        if (nodes[i].type === types.header_cell) {
          tr.setNodeMarkup(
            rect.tableStart + cells[i],
            types.cell,
            nodes[i].attrs
          )
        }
      }
      if (tr.steps.length === 0) {
        for (
          let i = 0;
          i < cells.length;
          i++ // No headers removed, add instead
        ) {
          tr.setNodeMarkup(
            rect.tableStart + cells[i],
            types.header_cell,
            nodes[i].attrs
          )
        }
      }
      dispatch(tr)
    }
    return true
  }
}

/**
 * 是否按类型启用标头
 * @param type
 * @param rect
 * @param types
 * @returns {boolean}
 */
function isHeaderEnabledByType(type, rect, types) {
  // Get cell positions for first row or first column
  const cellPositions = rect.map.cellsInRect({
    left: 0,
    top: 0,
    right: type === 'row' ? rect.map.width : 1,
    bottom: type === 'column' ? rect.map.height : 1,
  })

  for (let i = 0; i < cellPositions.length; i++) {
    const cell = rect.table.nodeAt(cellPositions[i])
    if (cell && cell.type !== types.header_cell) {
      return false
    }
  }

  return true
}

/**
 * 切换标题
 * @param type
 * @param options
 * @returns {(function(*, *): (boolean))|*|(function(*, *): boolean)}
 */
export function toggleHeader(type, options) {
  options = options || { useDeprecatedLogic: false }

  if (options.useDeprecatedLogic) return deprecatedToggleHeader(type)

  return function (state, dispatch) {
    if (!isInTable(state)) return false
    if (dispatch) {
      const types = tableNodeTypes(state.schema)
      const rect = selectedRect(state)
      const { tr } = state

      const isHeaderRowEnabled = isHeaderEnabledByType('row', rect, types)
      const isHeaderColumnEnabled = isHeaderEnabledByType('column', rect, types)

      const isHeaderEnabled =
        // eslint-disable-next-line no-nested-ternary
        type === 'column'
          ? isHeaderRowEnabled
          : type === 'row'
          ? isHeaderColumnEnabled
          : false

      const selectionStartsAt = isHeaderEnabled ? 1 : 0

      const cellsRect =
        // eslint-disable-next-line no-nested-ternary
        type === 'column'
          ? new Rect(0, selectionStartsAt, 1, rect.map.height)
          : type === 'row'
          ? new Rect(selectionStartsAt, 0, rect.map.width, 1)
          : rect

      const newType =
        // eslint-disable-next-line no-nested-ternary
        type === 'column'
          ? isHeaderColumnEnabled
            ? types.cell
            : types.header_cell
          : // eslint-disable-next-line no-nested-ternary
          type === 'row'
          ? isHeaderRowEnabled
            ? types.cell
            : types.header_cell
          : types.cell

      rect.map.cellsInRect(cellsRect).forEach((relativeCellPos) => {
        const cellPos = relativeCellPos + rect.tableStart
        const cell = tr.doc.nodeAt(cellPos)

        if (cell) {
          tr.setNodeMarkup(cellPos, newType, cell.attrs)
        }
      })

      dispatch(tr)
    }
    return true
  }
}

/**
 * 切换标题行
 * @type {(function(*, *): boolean)|*}
 */
export const toggleHeaderRow = toggleHeader('row', { useDeprecatedLogic: true })

/**
 * 切换标题列
 * @type {(function(*, *): boolean)|*}
 */
export const toggleHeaderColumn = toggleHeader('column', {
  useDeprecatedLogic: true,
})

/**
 * 切换标题单元格
 * @type {(function(*, *): boolean)|*}
 */
export const toggleHeaderCell = toggleHeader('cell', {
  useDeprecatedLogic: true,
})

/**
 * 查找下一个单元格
 * @param $cell
 * @param dir
 * @returns {number|*}
 */
function findNextCell($cell, dir) {
  if (dir < 0) {
    const before = $cell.nodeBefore
    if (before) return $cell.pos - before.nodeSize
    for (
      let row = $cell.index(-1) - 1, rowEnd = $cell.before();
      row >= 0;
      row--
    ) {
      const rowNode = $cell.node(-1).child(row)
      if (rowNode.childCount) return rowEnd - 1 - rowNode.lastChild.nodeSize
      rowEnd -= rowNode.nodeSize
    }
  } else {
    if ($cell.index() < $cell.parent.childCount - 1) {
      return $cell.pos + $cell.nodeAfter.nodeSize
    }
    const table = $cell.node(-1)
    for (
      let row = $cell.indexAfter(-1), rowStart = $cell.after();
      row < table.childCount;
      row++
    ) {
      const rowNode = table.child(row)
      if (rowNode.childCount) return rowStart + 1
      rowStart += rowNode.nodeSize
    }
  }
}

/**
 * 转到下一个单元格
 * @param direction
 * @returns {(function(*, *): (boolean|undefined))|*}
 */
export function goToNextCell(direction) {
  return function (state, dispatch) {
    if (!isInTable(state)) return false
    const cell = findNextCell(selectionCell(state), direction)
    if (cell == null) return
    if (dispatch) {
      const $cell = state.doc.resolve(cell)
      dispatch(
        state.tr
          .setSelection(TextSelection.between($cell, moveCellForward($cell)))
          .scrollIntoView()
      )
    }
    return true
  }
}

/**
 * 删除表格
 * @param state
 * @param dispatch
 * @returns {boolean}
 */
export function deleteTable(state, dispatch) {
  const $pos = state.selection.$anchor
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.spec.tableRole === 'table') {
      if (dispatch) {
        dispatch(
          state.tr.delete($pos.before(d), $pos.after(d)).scrollIntoView()
        )
      }
      return true
    }
  }
  return false
}
