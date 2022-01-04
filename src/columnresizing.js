/**
 * 该文件实现了表格列宽调整插件
 */
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { cellAround, pointsAtCell, setAttr } from './util'
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
 * @param lastColumnResizable 最后一列是否可调整
 * @returns {{class: string}|null|Plugin<*, *>|ResizeState|DecorationSet<any>|*}
 */
export function columnResizing({
  handleWidth = 5,
  cellMinWidth = 25,
  View = TableView,
  lastColumnResizable = true,
} = {}) {
  return new Plugin({
    key,
    state: {
      init(_, state) {
        // 给表格应用视图对象
        this.spec.props.nodeViews[tableNodeTypes(state.schema).table.name] = (
          node,
          view
        ) => new View(node, cellMinWidth, view)
        // 初始化拖拽状态
        return new ResizeState(-1, false)
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
            lastColumnResizable
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
          return handleDecorations(state, pluginState.activeHandle)
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
  constructor(activeHandle, dragging) {
    // 活动句柄，-1 为没有
    this.activeHandle = activeHandle
    // 是否拖动 false 没有拖动元素 { startX startWidth} 有拖动元素 null 句柄高亮，没有移动
    this.dragging = dragging
  }

  apply(tr) {
    let state = this
    // 插件 metadata 信息
    const action = tr.getMeta(key)
    // 当激活句柄或没有激活句柄时
    if (action && action.setHandle != null) {
      return new ResizeState(action.setHandle, null)
    }
    // 当激活句柄并且拖动时
    if (action && action.setDragging !== undefined) {
      return new ResizeState(state.activeHandle, action.setDragging)
    }
    // 当激活句柄并且文档内容修改时
    if (state.activeHandle > -1 && tr.docChanged) {
      let handle = tr.mapping.map(state.activeHandle, -1)
      if (!pointsAtCell(tr.doc.resolve(handle))) handle = null
      state = new ResizeState(handle, state.dragging)
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
 * @param lastColumnResizable 最后一列是否可调整
 */
function handleMouseMove(
  view,
  event,
  handleWidth,
  cellMinWidth,
  lastColumnResizable
) {
  // 获取当前插件状态
  const pluginState = key.getState(view.state)

  // 句柄拖动
  if (!pluginState.dragging) {
    const target = domCellAround(event.target)
    // 当前单元格 pos 信息
    let cell = -1
    if (target) {
      const { left, right } = target.getBoundingClientRect()
      if (event.clientX - left <= handleWidth) {
        cell = edgeCell(view, event, 'left')
      } else if (right - event.clientX <= handleWidth) {
        cell = edgeCell(view, event, 'right')
      }
    }

    if (cell !== pluginState.activeHandle) {
      // 最后一列不可调整时进行判断阻断
      if (!lastColumnResizable && cell !== -1) {
        const $cell = view.state.doc.resolve(cell)
        const table = $cell.node(-1)
        const map = TableMap.get(table)
        const start = $cell.start(-1)
        const col =
          map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1
        if (col === map.width - 1) {
          return
        }
      }
      // 更新状态
      updateHandle(view, cell)
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
      // 更新列宽
      updateColumnWidth(
        view,
        pluginState.activeHandle,
        draggedWidth(pluginState.dragging, event, cellMinWidth)
      )
      view.dispatch(view.state.tr.setMeta(key, { setDragging: null }))
    }
  }

  function move(event) {
    if (!event.which) return finish(event)
    // 获取当前插件状态
    const pluginState = key.getState(view.state)
    // 当前单元格宽度
    const dragged = draggedWidth(pluginState.dragging, event, cellMinWidth)
    // 设置单元格宽度
    displayColumnWidth(view, pluginState.activeHandle, dragged, cellMinWidth)
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
 * @param view
 * @param event
 * @param side
 * @returns {number|*|number}
 */
function edgeCell(view, event, side) {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!found) return -1
  const { pos } = found
  const $cell = cellAround(view.state.doc.resolve(pos))
  if (!$cell) return -1
  if (side === 'right') return $cell.pos
  const map = TableMap.get($cell.node(-1))
  const start = $cell.start(-1)
  const index = map.map.indexOf($cell.pos - start)
  return index % map.width === 0 ? -1 : start + map.map[index - 1]
}

/**
 * 计算拖动后宽度
 * @param dragging
 * @param event
 * @param cellMinWidth
 * @returns {number}
 */
function draggedWidth(dragging, event, cellMinWidth) {
  const offset = event.clientX - dragging.startX
  return Math.max(cellMinWidth, dragging.startWidth + offset)
}

/**
 * 更新句柄
 * @param view
 * @param value
 */
function updateHandle(view, value) {
  view.dispatch(view.state.tr.setMeta(key, { setHandle: value }))
}

/**
 * 更新列宽
 * @param view
 * @param cell
 * @param width
 */
function updateColumnWidth(view, cell, width) {
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
  for (let row = 0; row < map.height; row++) {
    // 单元格对应列中单元格在 map.map 中 index
    const mapIndex = row * map.width + col
    // 已经处理过跨行单元格
    if (row && map.map[mapIndex] === map.map[mapIndex - map.width]) continue
    // 单元格位置信息
    const pos = map.map[mapIndex]
    const { attrs } = table.nodeAt(pos)
    const index = attrs.colspan === 1 ? 0 : col - map.colCount(pos)
    if (attrs.colwidth && attrs.colwidth[index] === width) continue
    const colwidth = attrs.colwidth
      ? attrs.colwidth.slice()
      : zeroes(attrs.colspan)
    colwidth[index] = width
    // 给单元格设置属性
    tr.setNodeMarkup(start + pos, null, setAttr(attrs, 'colwidth', colwidth))
  }
  if (tr.docChanged) view.dispatch(tr)
}

/**
 * 设置列宽
 * @param view
 * @param cell
 * @param width
 * @param cellMinWidth
 */
function displayColumnWidth(view, cell, width, cellMinWidth) {
  const $cell = view.state.doc.resolve(cell)
  const table = $cell.node(-1)
  const start = $cell.start(-1)
  const col =
    TableMap.get(table).colCount($cell.pos - start) +
    $cell.nodeAfter.attrs.colspan -
    1
  let dom = view.domAtPos($cell.start(-1)).node
  while (dom.nodeName !== 'TABLE') dom = dom.parentNode
  updateColumns(table, dom.firstChild, dom, cellMinWidth, col, width)
}

/**
 * 构造零
 * @param n
 * @returns {*[]}
 */
function zeroes(n) {
  const result = []
  for (let i = 0; i < n; i++) result.push(0)
  return result
}

/**
 * 生成句柄装饰
 * @param state
 * @param cell
 * @returns {DecorationSet<any>}
 */
function handleDecorations(state, cell) {
  const decorations = []
  const $cell = state.doc.resolve(cell)
  const table = $cell.node(-1)
  const map = TableMap.get(table)
  const start = $cell.start(-1)
  // 表格列 index
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan
  for (let row = 0; row < map.height; row++) {
    // 单元格对应列中单元格在 map.map 中 index
    const index = col + row * map.width - 1
    // 1.表格最右侧边框线 2. 不是跨列的单元格
    if (col === map.width || map.map[index] !== map.map[index + 1]) {
      const cellPos = map.map[index]
      const pos = start + cellPos + table.nodeAt(cellPos).nodeSize - 1
      const dom = document.createElement('div')
      dom.className = 'column-resize-handle'
      decorations.push(Decoration.widget(pos, dom))
    }
  }
  // 生成句柄装饰
  return DecorationSet.create(state.doc, decorations)
}
