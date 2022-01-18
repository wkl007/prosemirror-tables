/**
 * 该文件实现了表格列宽调整插件
 */
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import {
  cellAround,
  generateConvertNumber,
  pointsAtCell,
  setAttr,
} from './util'
import { TableMap } from './tablemap'
import { TableView, updateColumns } from './tableview'
import { tableNodeTypes } from './schema'

/**
 * 表格列宽调整插件 key
 * @type {PluginKey<any, any>}
 */
export const key = new PluginKey('tableColumnResizing')

/**
 * 表格列宽调整插件
 * @param handleWidth 手柄宽度
 * @param cellMinWidth 单元格最小宽度
 * @param View 视图对象
 * @param borderColumnResizable 表格边框是否可调整
 * @param convertUnit 单位转换 px pt
 * @returns {{class: string}|null|Plugin<*, *>|ResizeState|DecorationSet<any>|*}
 */
export function columnResizing({
  handleWidth = 5,
  cellMinWidth = 25,
  View = TableView,
  borderColumnResizable = true,
  convertUnit = 'px',
} = {}) {
  return new Plugin({
    key,
    state: {
      init(_, state) {
        // 给表格应用视图对象
        this.spec.props.nodeViews[tableNodeTypes(state.schema).table.name] = (
          node,
          view
        ) => new View(node, cellMinWidth, view, convertUnit)
        // 初始化拖拽状态
        return new ResizeState(-1, false, convertUnit)
      },
      apply(tr, prev) {
        // 更新状态
        return prev.apply(tr)
      },
    },
    props: {
      attributes(state) {
        // 获取当前插件状态
        const pluginState = key.getState(state)
        // 根据状态给句柄添加样式
        return pluginState.activeHandle > -1 ? { class: 'resize-cursor' } : null
      },
      handleDOMEvents: {
        mousemove(view, event) {
          handleMouseMove(
            view,
            event,
            handleWidth,
            cellMinWidth,
            borderColumnResizable
          )
        },
        mouseleave(view) {
          handleMouseLeave(view)
        },
        mousedown(view, event) {
          handleMouseDown(view, event, cellMinWidth)
        },
      },
      decorations(state) {
        // 获取当前插件状态
        const pluginState = key.getState(state)
        // 生成对应装饰
        if (pluginState.activeHandle > -1) {
          return handleDecorations(state, pluginState)
        }
        return Decoration.empty
      },
      nodeViews: {},
    },
  })
}

/**
 * 调整相关类
 */
class ResizeState {
  constructor(
    activeHandle,
    dragging,
    convertUnit,
    isTableLeftBorder = false,
    isTableRightBorder = false
  ) {
    // 活动句柄，-1 为没有
    this.activeHandle = activeHandle
    // 是否拖动 false 没有拖动元素 { startX startWidth} 有拖动元素 null 句柄高亮，没有移动
    this.dragging = dragging
    // 单位换算
    this.convertUnit = convertUnit
    // 表格左侧边框线
    this.isTableLeftBorder = isTableLeftBorder
    // 表格右侧边框线
    this.isTableRightBorder = isTableRightBorder
  }

  apply(tr) {
    let state = this
    // 插件 metadata 信息
    const action = tr.getMeta(key)
    // 当激活句柄或没有激活句柄时
    if (action && action.setHandle != null) {
      return new ResizeState(
        action.setHandle,
        null,
        state.convertUnit,
        action.isTableLeftBorder,
        action.isTableRightBorder
      )
    }
    // 当激活句柄并且拖动时
    if (action && action.setDragging !== undefined) {
      return new ResizeState(
        state.activeHandle,
        action.setDragging,
        state.convertUnit,
        state.isTableLeftBorder,
        state.isTableRightBorder
      )
    }
    // 当激活句柄并且文档内容修改时
    if (state.activeHandle > -1 && tr.docChanged) {
      let handle = tr.mapping.map(state.activeHandle, -1)
      if (!pointsAtCell(tr.doc.resolve(handle))) handle = null
      state = new ResizeState(
        handle,
        state.dragging,
        state.convertUnit,
        state.isTableLeftBorder,
        state.isTableRightBorder
      )
    }
    return state
  }
}

/**
 * 鼠标移动事件
 * @param view 视图对象
 * @param event 事件
 * @param handleWidth 句柄宽度
 * @param cellMinWidth 单元格最小宽度
 * @param borderColumnResizable 表格边框是否可调整
 */
function handleMouseMove(
  view,
  event,
  handleWidth,
  cellMinWidth,
  borderColumnResizable
) {
  // 获取当前插件状态
  const pluginState = key.getState(view.state)

  // 句柄拖动
  if (!pluginState.dragging) {
    const target = domCellAround(event.target)
    // 当前单元格 pos 信息
    let cell = -1
    // 边
    let side = ''
    if (target) {
      const { left, right } = target.getBoundingClientRect()
      if (event.clientX - left <= handleWidth && event.clientX - left > 0) {
        side = 'left'
      } else if (right - event.clientX <= handleWidth) {
        side = 'right'
      }
      if (side) cell = edgeCell(view, event, side)
    }

    if (cell !== pluginState.activeHandle) {
      if (cell !== -1) {
        const $cell = view.state.doc.resolve(cell)
        const table = $cell.node(-1)
        const map = TableMap.get(table)
        const start = $cell.start(-1)
        // 当前列索引
        const col =
          map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1
        // 表格左侧边框线
        const isTableLeftBorder = isTableLeftCell(view, event, side)
        // 表格右侧边框线
        const isTableRightBorder = side === 'right' && col === map.width - 1
        // 表格边框列不可调整进行阻断
        if (
          !borderColumnResizable &&
          (isTableLeftBorder || isTableRightBorder)
        ) {
          return
        }
        // 更新状态
        updateHandle(view, cell, isTableLeftBorder, isTableRightBorder)
      } else {
        // 更新状态
        updateHandle(view, cell)
      }
    }
  }
}

/**
 * 鼠标离开事件
 * @param view
 */
function handleMouseLeave(view) {
  // 获取当前插件状态
  const pluginState = key.getState(view.state)
  // 句柄激活没有拖动时更新状态
  if (pluginState.activeHandle > -1 && !pluginState.dragging) {
    updateHandle(view, -1)
  }
}

/**
 * 鼠标按下事件
 * @param view
 * @param event
 * @param cellMinWidth
 * @returns {boolean}
 */
function handleMouseDown(view, event, cellMinWidth) {
  // 获取当前插件状态
  const pluginState = key.getState(view.state)
  // 句柄没有拖动或者拖动时返回
  if (pluginState.activeHandle === -1 || pluginState.dragging) return false
  // 当前单元格 Node 节点
  const cell = view.state.doc.nodeAt(pluginState.activeHandle)
  // 当前单元格列宽
  const width = currentColWidth(view, pluginState.activeHandle, cell.attrs)
  // 更新状态
  view.dispatch(
    view.state.tr.setMeta(key, {
      setDragging: { startX: event.clientX, startWidth: width },
    })
  )

  function finish(event) {
    // 解除监听事件
    window.removeEventListener('mouseup', finish)
    window.removeEventListener('mousemove', move)
    // 获取当前插件状态
    const pluginState = key.getState(view.state)
    // 拖动中
    if (pluginState.dragging) {
      const { width } = draggedWidth(pluginState, event, cellMinWidth)
      // 更新列宽
      updateColumnWidth(view, pluginState, width)
      view.dispatch(view.state.tr.setMeta(key, { setDragging: null }))
    }
  }

  function move(event) {
    if (!event.which) return finish(event)
    // 获取当前插件状态
    const pluginState = key.getState(view.state)
    // 当前单元格宽度
    const { width, offset } = draggedWidth(pluginState, event, cellMinWidth)
    // 设置单元格宽度
    displayColumnWidth(view, pluginState, width, cellMinWidth, offset)
  }

  // 监听事件
  window.addEventListener('mouseup', finish)
  window.addEventListener('mousemove', move)
  event.preventDefault()
  return true
}

/**
 * 当前列宽
 * @param view
 * @param cellPos
 * @param colspan
 * @param colwidth
 * @returns {number|*}
 */
function currentColWidth(view, cellPos, { colspan, colwidth }) {
  const width = colwidth && colwidth[colwidth.length - 1]
  if (width) return width
  const dom = view.domAtPos(cellPos)
  const node = dom.node.childNodes[dom.offset]
  let domWidth = node.offsetWidth
  let parts = colspan
  if (colwidth) {
    for (let i = 0; i < colspan; i++) {
      if (colwidth[i]) {
        domWidth -= colwidth[i]
        parts--
      }
    }
  }
  return domWidth / parts
}

/**
 * 鼠标移动到具体某个单元格
 * @param target
 * @returns {*}
 */
function domCellAround(target) {
  while (target && target.nodeName !== 'TD' && target.nodeName !== 'TH') {
    target = target.classList.contains('ProseMirror') ? null : target.parentNode
  }
  return target
}

/**
 * 边缘单元格
 * @param view 视图对象
 * @param event 鼠标事件
 * @param side 左 右
 * @returns {number|*}
 */
function edgeCell(view, event, side) {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!found) return -1
  const { pos } = found
  // 单元格详细位置信息
  const $cell = cellAround(view.state.doc.resolve(pos))
  if (!$cell) return -1
  if (side === 'right') return $cell.pos
  const map = TableMap.get($cell.node(-1))
  // 单元格开始位置
  const start = $cell.start(-1)
  // 当前单元格在表格 map 数据中的索引
  const index = map.map.indexOf($cell.pos - start)
  // 如果是第一列返回当前单元格 pos 信息 ，否则返回上一个单元格位置信息
  return index % map.width === 0 ? $cell.pos : start + map.map[index - 1]
}

/**
 * 是表格左侧单元格
 * @param view
 * @param event
 * @param side
 * @returns {boolean|number}
 */
function isTableLeftCell(view, event, side) {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!found) return -1
  const { pos } = found
  const $cell = cellAround(view.state.doc.resolve(pos))
  const map = TableMap.get($cell.node(-1))
  const start = $cell.start(-1)
  const index = map.map.indexOf($cell.pos - start)
  return side === 'left' && index % map.width === 0
}

/**
 * 计算拖动后宽度
 * @param pluginState
 * @param event
 * @param cellMinWidth
 * @returns {{offset: number, width: number}}
 */
function draggedWidth(pluginState, event, cellMinWidth) {
  const { dragging, isTableLeftBorder } = pluginState
  const offset = event.clientX - dragging.startX
  let width = Math.max(cellMinWidth, dragging.startWidth + offset)
  if (isTableLeftBorder) {
    width = Math.max(cellMinWidth, dragging.startWidth - offset)
  }
  return { offset, width }
}

/**
 * 更新句柄
 * @param view
 * @param value
 * @param isTableLeftBorder
 * @param isTableRightBorder
 */
function updateHandle(view, value, isTableLeftBorder, isTableRightBorder) {
  view.dispatch(
    view.state.tr.setMeta(key, {
      setHandle: value,
      isTableLeftBorder,
      isTableRightBorder,
    })
  )
}

/**
 * 更新列宽
 * @param view
 * @param pluginState
 * @param colWidth
 */
function updateColumnWidth(view, pluginState, colWidth) {
  const { activeHandle: cell, convertUnit } = pluginState
  // 获取实际宽度
  const width = generateConvertNumber(colWidth, convertUnit)
  // 当前单元格位置信息
  const $cell = view.state.doc.resolve(cell)
  // 表格 Node
  const table = $cell.node(-1)
  // 表格 map 数据
  const map = TableMap.get(table)
  // 开始位置
  const start = $cell.start(-1)
  // 第几列
  const col =
    map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1
  const { tr } = view.state
  // 表格属性
  const tableAttrs = JSON.parse(JSON.stringify(table.attrs))
  // 表格 colwidth 属性
  let { colwidth: tableColWidth } = tableAttrs
  // 调整的下一列列宽列表
  const nextColWidthList = []
  // 最右侧
  const isRightSide = col === map.width - 1
  for (let row = 0; row < map.height; row++) {
    // 单元格对应列中单元格在 map.map 中 index
    const mapIndex = row * map.width + col
    // 跨行单元格跳过后续代码
    if (row && map.map[mapIndex] === map.map[mapIndex - map.width]) continue
    // 单元格 pos 信息
    const pos = map.map[mapIndex]
    // 设置单元格属性
    setTableCellAttr(tr, table, pos, start)

    if (!isRightSide) {
      // 下一个单元格 pos 信息
      const nextPos = map.map[mapIndex + 1]
      // 设置下一个单元格属性
      setTableCellAttr(tr, table, nextPos, start)

      // 保存下一个单元格列宽
      const nextColWidth = generateConvertNumber(
        getColWidth(view, table, nextPos, start),
        convertUnit
      )
      if (nextColWidth) nextColWidthList.push(nextColWidth)
    }
  }

  if (!tableColWidth) {
    tableColWidth = new Array(map.width)
  }
  // 设置当前单元格列宽
  tableColWidth[col] = width
  // 设置下一个单元格列宽
  if (!isRightSide) {
    tableColWidth[col + 1] = Math.min(...nextColWidthList)
  }

  const tableDom = view.domAtPos(start).node.parentElement
  if (tableDom) {
    const { width, marginLeft } = window.getComputedStyle(tableDom)
    // 表格 margin
    const tblInd = generateConvertNumber(
      marginLeft.replace('px', ''),
      convertUnit
    )
    // 表格宽度
    const tblW = generateConvertNumber(width.replace('px', ''), convertUnit)
    const attr = {
      ...tableAttrs,
      colwidth: tableColWidth,
      properties: {
        ...tableAttrs.properties,
        tblInd: {
          attributes: {
            w: tblInd,
            type: 'dxa',
          },
        },
        tblW: {
          attributes: {
            w: tblW,
            type: 'dxa',
          },
        },
      },
    }
    tr.setNodeMarkup(start - 1, null, attr)
  }
  if (tr.docChanged) view.dispatch(tr)
}

/**
 * 设置列宽
 * @param view
 * @param pluginState
 * @param width
 * @param cellMinWidth
 * @param offset
 */
function displayColumnWidth(view, pluginState, width, cellMinWidth, offset) {
  const {
    activeHandle: cell,
    isTableLeftBorder,
    isTableRightBorder,
    convertUnit,
  } = pluginState
  const $cell = view.state.doc.resolve(cell)
  const table = $cell.node(-1)
  const start = $cell.start(-1)
  const col =
    TableMap.get(table).colCount($cell.pos - start) +
    $cell.nodeAfter.attrs.colspan -
    1
  let dom = view.domAtPos($cell.start(-1)).node
  while (dom.nodeName !== 'TABLE') dom = dom.parentNode
  updateColumns(
    table,
    dom.firstChild,
    dom,
    cellMinWidth,
    convertUnit,
    col,
    width,
    offset,
    isTableLeftBorder,
    isTableRightBorder
  )
}

/**
 * 设置单元格 attr
 * @param tr
 * @param table
 * @param pos
 * @param start
 */
function setTableCellAttr(tr, table, pos, start) {
  const { attrs } = table.nodeAt(pos)
  const { properties } = attrs
  delete properties.tcW
  tr.setNodeMarkup(start + pos, null, setAttr(attrs, 'properties', properties))
}

/**
 * 获取单元格列宽
 * @param view
 * @param table
 * @param pos
 * @param start
 * @returns {number}
 */
function getColWidth(view, table, pos, start) {
  const cellDom = view.domAtPos(start + pos + 1).node.closest('td')
  if (!cellDom) return 0
  const { width } = window.getComputedStyle(cellDom)
  return Number(width.replace('px', ''))
}

/**
 * 生成句柄装饰
 * @param state
 * @param pluginState
 * @returns {DecorationSet<any>}
 */
function handleDecorations(state, pluginState) {
  const { activeHandle: cell, isTableLeftBorder } = pluginState
  const decorations = []
  const $cell = state.doc.resolve(cell)
  const table = $cell.node(-1)
  const map = TableMap.get(table)
  const start = $cell.start(-1)
  // 表格列 index
  let col = map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan
  // 表格最左侧调整 col
  if (isTableLeftBorder) col = map.colCount($cell.pos - start) + 1

  for (let row = 0; row < map.height; row++) {
    // 单元格对应列中单元格在 map.map 中 index
    const index = col + row * map.width - 1
    // 表格最左侧框线
    const isLeftBorder = isTableLeftBorder && col === 1
    // 表格最右侧框线
    const isRightBorder = col === map.width
    // 跨列单元格
    const isCrossColumnCell = map.map[index] === map.map[index + 1]
    if (isLeftBorder || isRightBorder || !isCrossColumnCell) {
      // 单元格在 map.map 中的 pos
      const cellPos = map.map[index]
      // 生成 decoration 的位置信息，在对应单元格 td 内部
      const pos = start + cellPos + table.nodeAt(cellPos).nodeSize - 1
      const dom = document.createElement('div')
      dom.className = isLeftBorder
        ? 'column-resize-handle-left'
        : 'column-resize-handle'
      decorations.push(Decoration.widget(pos, dom))
    }
  }
  // 生成句柄装饰
  return DecorationSet.create(state.doc, decorations)
}
