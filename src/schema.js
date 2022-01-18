/**
 * 用于创建支持表的模式的助手
 */

/**
 * 获取单元格 attrs
 * @param dom 单元格 DOM
 * @param extraAttrs 属性
 * @returns {{colspan: number, rowspan: number}}
 */
function getCellAttrs(dom, extraAttrs) {
  const colspan = Number(dom.getAttribute('colspan') || 1)
  const result = {
    colspan,
    rowspan: Number(dom.getAttribute('rowspan') || 1),
  }
  for (const prop in extraAttrs) {
    const getter = extraAttrs[prop].getFromDOM
    const value = getter && getter(dom)
    if (value != null) result[prop] = value
  }
  return result
}

/**
 * 设置单元格 attrs
 * @param node 单元格 Node
 * @param extraAttrs 属性
 * @returns {{}} attrs
 */
function setCellAttrs(node, extraAttrs) {
  const attrs = {}
  if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan
  if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan
  for (const prop in extraAttrs) {
    const setter = extraAttrs[prop].setDOMAttr
    if (setter) setter(node.attrs[prop], attrs)
  }
  return attrs
}

// :: (Object) → Object
//
// This function creates a set of [node
// specs](http://prosemirror.net/docs/ref/#model.SchemaSpec.nodes) for
// `table`, `table_row`, and `table_cell` nodes types as used by this
// module. The result can then be added to the set of nodes when
// creating a a schema.
//
//   options::- The following options are understood:
//
//     tableGroup:: ?string
//     A group name (something like `"block"`) to add to the table
//     node type.
//
//     cellContent:: string
//     The content expression for table cells.
//
//     cellAttributes:: ?Object
//     Additional attributes to add to cells. Maps attribute names to
//     objects with the following properties:
//
//       default:: any
//       The attribute's default value.
//
//       getFromDOM:: ?(dom.Node) → any
//       A function to read the attribute's value from a DOM node.
//
//       setDOMAttr:: ?(value: any, attrs: Object)
//       A function to add the attribute's value to an attribute
//       object that's used to render the cell's DOM.
/**
 * 表格 Node
 * @param options
 */
export function tableNodes(options) {
  const extraAttrs = options.cellAttributes || {}
  const tableAttrs = {
    colwidth: { default: [] },
    properties: { default: {} },
    id: { default: null },
  }
  const cellAttrs = {
    colspan: { default: 1 },
    rowspan: { default: 1 },
    colwidth: { default: null },
    properties: { default: {} },
  }
  for (const prop in extraAttrs) {
    cellAttrs[prop] = { default: extraAttrs[prop].default }
  }

  return {
    table: {
      content: 'table_row+',
      attrs: tableAttrs,
      tableRole: 'table',
      isolating: true,
      group: options.tableGroup,
      parseDOM: [{ tag: 'table' }],
      toDOM() {
        return ['table', ['tbody', 0]]
      },
    },
    table_row: {
      content: '(table_cell | table_header)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM() {
        return ['tr', 0]
      },
    },
    table_cell: {
      content: options.cellContent,
      attrs: cellAttrs,
      tableRole: 'cell',
      isolating: true,
      parseDOM: [
        { tag: 'td', getAttrs: (dom) => getCellAttrs(dom, extraAttrs) },
      ],
      toDOM(node) {
        return ['td', setCellAttrs(node, extraAttrs), 0]
      },
    },
    table_header: {
      content: options.cellContent,
      attrs: cellAttrs,
      tableRole: 'header_cell',
      isolating: true,
      parseDOM: [
        { tag: 'th', getAttrs: (dom) => getCellAttrs(dom, extraAttrs) },
      ],
      toDOM(node) {
        return ['th', setCellAttrs(node, extraAttrs), 0]
      },
    },
  }
}

/**
 * 表格 Node 类型
 * @param schema
 * @returns {any}
 */
export function tableNodeTypes(schema) {
  let result = schema.cached.tableNodeTypes
  if (!result) {
    // eslint-disable-next-line no-multi-assign
    result = schema.cached.tableNodeTypes = {}
    for (const name in schema.nodes) {
      const type = schema.nodes[name]
      const role = type.spec.tableRole
      if (role) result[role] = type
    }
  }
  return result
}
