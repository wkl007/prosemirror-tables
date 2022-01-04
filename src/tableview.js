/**
 * 此文件主要实现了 TableView 跟 更新表格列宽 方法
 */

export class TableView {
  constructor(node, cellMinWidth) {
    // 表格 Node 信息
    this.node = node
    // 单元格最小宽度
    this.cellMinWidth = cellMinWidth
    // 表格最外层 div 标签
    this.dom = document.createElement('div')
    // 表格外层 div 类名
    this.dom.className = 'tableWrapper'
    // 表格 DOM
    this.table = this.dom.appendChild(document.createElement('table'))
    // 表格 colgroup 标签
    this.colgroup = this.table.appendChild(document.createElement('colgroup'))
    // 更新表格列宽
    updateColumns(node, this.colgroup, this.table, cellMinWidth)
    // 表格 tbody 标签
    this.contentDOM = this.table.appendChild(document.createElement('tbody'))
  }

  // 表格更新
  update(node) {
    if (node.type !== this.node.type) return false
    this.node = node
    // 更新表格列宽
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth)
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
 * @param overrideCol 覆盖列
 * @param overrideValue 覆盖值
 */
export function updateColumns(
  node,
  colgroup,
  table,
  cellMinWidth,
  overrideCol,
  overrideValue
) {
  // 表格宽度
  let totalWidth = 0
  // 表格 colwidth 最后一个值不为 0 为 true，为 0 为 false
  let fixedWidth = true
  // colgroup 标签下第一个 DOM
  let nextDOM = colgroup.firstChild
  // 表格中第一行
  const row = node.firstChild
  // 遍历第一行中每一个单元格
  for (let i = 0, col = 0; i < row.childCount; i++) {
    // 第一行中的 colspan 3 colwidth [100, 0, 0]
    const { colspan, colwidth } = row.child(i).attrs
    // 遍历 colspan 跨列
    for (let j = 0; j < colspan; j++, col++) {
      // 调整列宽后的宽度值
      const hasWidth =
        overrideCol === col ? overrideValue : colwidth && colwidth[j]
      // 单元格宽度
      const cssWidth = hasWidth ? `${hasWidth}px` : ''
      // 表格宽度
      totalWidth += hasWidth || cellMinWidth
      if (!hasWidth) fixedWidth = false
      if (!nextDOM) {
        // colgroup 标签下没有 col 标签的话创建并赋值
        colgroup.appendChild(document.createElement('col')).style.width =
          cssWidth
      } else {
        // 有 col 的话赋值
        if (nextDOM.style.width !== cssWidth) nextDOM.style.width = cssWidth
        // 下一个 col 标签
        nextDOM = nextDOM.nextSibling
      }
    }
  }

  // 为 true 则设置表格宽度，否则设置最小宽度
  if (fixedWidth) {
    table.style.width = `${totalWidth}px`
    table.style.minWidth = ''
  } else {
    table.style.width = ''
    table.style.minWidth = `${totalWidth}px`
  }
}
