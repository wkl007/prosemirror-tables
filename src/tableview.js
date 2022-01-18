/**
 * 此文件主要实现了 TableView 跟 更新表格列宽 方法
 */
import { DOMSerializer } from 'prosemirror-model'
import { generateConvertNumber } from './util'

export class TableView {
  constructor(node, cellMinWidth, view, convertUnit) {
    // 表格 Node 信息
    this.node = node
    // 单元格最小宽度
    this.cellMinWidth = cellMinWidth
    // 单位转换
    this.convertUnit = convertUnit
    // 表格最外层 div 标签
    this.dom = document.createElement('div')
    // 表格外层 div 类名
    this.dom.className = 'table-wrapper'
    if (node.attrs.id) this.dom.dataset.id = node.attrs.id
    // 表格 DOM
    const nodeDOM = DOMSerializer.fromSchema(view.state.schema).serializeNode(
      node
    )
    this.table = nodeDOM
    // 表格 colgroup 标签
    this.colgroup =
      nodeDOM.querySelector('colgroup') ||
      this.table.insertBefore(
        document.createElement('colgroup'),
        this.table.childNodes[0]
      )
    // 更新表格列宽
    updateColumns(node, this.colgroup, this.table, cellMinWidth, convertUnit)
    // 表格 tbody 标签
    this.contentDOM = nodeDOM.querySelector('tbody')
    this.dom.appendChild(this.table)
  }

  // 表格更新
  update(node) {
    if (node.type !== this.node.type) return false
    this.node = node
    // 更新表格列宽
    updateColumns(
      node,
      this.colgroup,
      this.table,
      this.cellMinWidth,
      this.convertUnit
    )
    return true
  }

  // TODO 表格 dom 突变或内部选区变化时调用，暂不知道作用
  ignoreMutation(record) {
    return (
      record.type === 'attributes' &&
      (record.target === this.table || this.colgroup.contains(record.target))
    )
  }
}

/**
 * 更新表格列宽
 * @param node 表格 Node
 * @param colgroup 表格 colgroup 标签
 * @param table 表格 DOM
 * @param cellMinWidth 单元格最小宽度
 * @param convertUnit 单位转换函数
 * @param overrideCol 覆盖列
 * @param overrideValue 覆盖值
 * @param offset 偏移量
 * @param isTableLeftBorder 表格左侧边框线
 * @param isTableRightBorder 表格右侧边框线
 */
export function updateColumns(
  node,
  colgroup,
  table,
  cellMinWidth,
  convertUnit,
  overrideCol,
  overrideValue,
  offset = 0,
  isTableLeftBorder = false,
  isTableRightBorder = false
) {
  if (overrideValue <= cellMinWidth) return
  // colgroup 标签下第一个 DOM
  let nextDOM = colgroup.firstChild
  // 表格中第一行
  const row = node.firstChild
  const { colwidth, properties } = node.attrs
  const cssWidths = []

  // 表格宽度
  let defaultTableWidth = '100%'
  const tableWidthVariable =
    getComputedStyle(table).getPropertyValue('--table-width')
  if (tableWidthVariable) defaultTableWidth = 'var(--table-width)'

  // 遍历第一行中每一个单元格
  for (let i = 0, col = 0; i < row.childCount; i++) {
    // 第一行中单元格的 colspan
    const { colspan } = row.child(i).attrs
    // 遍历 colspan 跨列
    for (let j = 0; j < colspan; j++, col++) {
      // 调整列宽后的宽度值
      let hasWidth =
        colwidth &&
        colwidth[col] &&
        generateConvertNumber(colwidth[col], convertUnit, true)
      // 修改对应单元格的列宽
      if (overrideCol === col) hasWidth = overrideValue

      // 修改对应单元格下一个的列宽
      if (overrideCol + 1 === col && hasWidth && !isTableLeftBorder) {
        hasWidth -= offset
        if (hasWidth <= cellMinWidth) return
      }
      // 单元格宽度
      const cssWidth = hasWidth ? `${hasWidth}px` : ''
      cssWidths.push(cssWidth)
    }
  }

  for (let i = 0; i < cssWidths.length; i++) {
    const cssWidth = cssWidths[i]
    if (!nextDOM) {
      // colgroup 标签下没有 col 标签的话创建并赋值
      colgroup.appendChild(document.createElement('col')).style.width = cssWidth
    } else {
      // 有 col 的话赋值
      if (nextDOM.style.width !== cssWidth) {
        nextDOM.style.width = cssWidth
        nextDOM.setAttribute('width', cssWidth)
      }
      // 下一个 col 标签
      nextDOM = nextDOM.nextSibling
    }
  }

  // 表格最左侧拖拽
  if (isTableLeftBorder) {
    let tableWidth = `calc(${defaultTableWidth} - ${offset}px)`
    if (properties.tblW && properties.tblW.attributes.type === 'dxa') {
      const { w } = properties.tblW.attributes
      const width = generateConvertNumber(w, convertUnit, true)
      tableWidth = `calc(${width}px - ${offset}px)`
    }
    table.style.width = tableWidth
    let preMarginLeft = 0
    if (properties.tblInd) {
      const { w } = properties.tblInd.attributes
      const width = generateConvertNumber(w, convertUnit, true)
      preMarginLeft = Number(width)
    }
    table.style.marginLeft = `${preMarginLeft + offset}px`
  } else if (isTableRightBorder) {
    let tableWidth = `calc(${defaultTableWidth} + ${offset}px)`
    if (properties.tblW && properties.tblW.attributes.type === 'dxa') {
      const { w } = properties.tblW.attributes
      const width = generateConvertNumber(w, convertUnit, true)
      tableWidth = `calc(${width}px + ${offset}px)`
    }
    table.style.width = tableWidth
  } else {
    let tableWidth = `calc(${defaultTableWidth})`
    if (properties.tblW && properties.tblW.attributes.type === 'dxa') {
      const { w } = properties.tblW.attributes
      const width = generateConvertNumber(w, convertUnit, true)
      tableWidth = `${width}px`
    }
    table.style.width = tableWidth
    let preMarginLeft = 0
    if (properties.tblInd) {
      const { w } = properties.tblInd.attributes
      const width = generateConvertNumber(w, convertUnit, true)
      preMarginLeft = `${Number(width)}px`
    }
    table.style.marginLeft = preMarginLeft
  }
}
