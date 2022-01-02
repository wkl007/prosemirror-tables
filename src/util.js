/**
 * 该文件实现了处理表格相关的工具辅助函数
 */
import { PluginKey } from 'prosemirror-state'
import { TableMap } from './tablemap'
import { tableNodeTypes } from './schema'

/**
 * 选择单元格 key
 * @type {PluginKey<any, any>}
 */
export const key = new PluginKey('selectingCells')

/**
 * 单元格周围
 * @param $pos
 * @returns {null|*}
 */
export function cellAround($pos) {
  for (let d = $pos.depth - 1; d > 0; d--) {
    if ($pos.node(d).type.spec.tableRole === 'row') {
      return $pos.node(0).resolve($pos.before(d + 1))
    }
  }
  return null
}

/**
 * 单元格包装
 * @param $pos
 * @returns {null|*}
 */
export function cellWrapping($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    // Sometimes the cell can be in the same depth.
    const role = $pos.node(d).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return $pos.node(d)
  }
  return null
}

/**
 * 当前选区是否在表格中
 * @param state
 * @returns {boolean}
 */
export function isInTable(state) {
  const { $head } = state.selection
  for (let d = $head.depth; d > 0; d--) {
    if ($head.node(d).type.spec.tableRole === 'row') return true
  }
  return false
}

/**
 * 选择单元格
 * @param state
 * @returns {*}
 */
export function selectionCell(state) {
  const sel = state.selection
  if (sel.$anchorCell) {
    return sel.$anchorCell.pos > sel.$headCell.pos
      ? sel.$anchorCell
      : sel.$headCell
  }
  if (sel.node && sel.node.type.spec.tableRole === 'cell') {
    return sel.$anchor
  }
  return cellAround(sel.$head) || cellNear(sel.$head)
}

/**
 * 单元格附近
 * @param $pos
 * @returns {*}
 */
function cellNear($pos) {
  for (
    let after = $pos.nodeAfter, { pos } = $pos;
    after;
    after = after.firstChild, pos++
  ) {
    const role = after.type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return $pos.doc.resolve(pos)
  }
  for (
    let before = $pos.nodeBefore, { pos } = $pos;
    before;
    before = before.lastChild, pos--
  ) {
    const role = before.type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') {
      return $pos.doc.resolve(pos - before.nodeSize)
    }
  }
}

/**
 * 点在单元格
 * @param $pos
 * @returns {false|*}
 */
export function pointsAtCell($pos) {
  return $pos.parent.type.spec.tableRole === 'row' && $pos.nodeAfter
}

/**
 * 向前移动单元格
 * @param $pos
 * @returns {*}
 */
export function moveCellForward($pos) {
  return $pos.node(0).resolve($pos.pos + $pos.nodeAfter.nodeSize)
}

/**
 * 在同一个表格中
 * @param $a
 * @param $b
 * @returns {boolean}
 */
export function inSameTable($a, $b) {
  return $a.depth === $b.depth && $a.pos >= $b.start(-1) && $a.pos <= $b.end(-1)
}

/**
 * 查找单元格
 * @param $pos
 * @returns {*}
 */
export function findCell($pos) {
  return TableMap.get($pos.node(-1)).findCell($pos.pos - $pos.start(-1))
}

/**
 * 列数
 * @param $pos
 * @returns {*}
 */
export function colCount($pos) {
  return TableMap.get($pos.node(-1)).colCount($pos.pos - $pos.start(-1))
}

/**
 * 下一个单元格
 * @param $pos
 * @param axis
 * @param dir
 * @returns {null|*}
 */
export function nextCell($pos, axis, dir) {
  const start = $pos.start(-1)
  const map = TableMap.get($pos.node(-1))
  const moved = map.nextCell($pos.pos - start, axis, dir)
  return moved == null ? null : $pos.node(0).resolve(start + moved)
}

/**
 * 设置属性
 * @param attrs
 * @param name
 * @param value
 * @returns {{}}
 */
export function setAttr(attrs, name, value) {
  const result = {}
  for (const prop in attrs) result[prop] = attrs[prop]
  result[name] = value
  return result
}

/**
 * 删除跨列属性
 * @param attrs
 * @param pos
 * @param n
 * @returns {{}}
 */
export function removeColSpan(attrs, pos, n = 1) {
  const result = setAttr(attrs, 'colspan', attrs.colspan - n)
  if (result.colwidth) {
    result.colwidth = result.colwidth.slice()
    result.colwidth.splice(pos, n)
    if (!result.colwidth.some((w) => w > 0)) result.colwidth = null
  }
  return result
}

/**
 * 添加跨列属性
 * @param attrs
 * @param pos
 * @param n
 * @returns {{}}
 */
export function addColSpan(attrs, pos, n = 1) {
  const result = setAttr(attrs, 'colspan', attrs.colspan + n)
  if (result.colwidth) {
    result.colwidth = result.colwidth.slice()
    for (let i = 0; i < n; i++) result.colwidth.splice(pos, 0, 0)
  }
  return result
}

/**
 * 列是标题
 * @param map
 * @param table
 * @param col
 * @returns {boolean}
 */
export function columnIsHeader(map, table, col) {
  const headerCell = tableNodeTypes(table.type.schema).header_cell
  for (let row = 0; row < map.height; row++) {
    if (table.nodeAt(map.map[col + row * map.width]).type !== headerCell) {
      return false
    }
  }
  return true
}
