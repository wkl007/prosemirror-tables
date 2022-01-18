import { EditorView } from 'prosemirror-view'
import { EditorState } from 'prosemirror-state'
import { DOMParser, Schema } from 'prosemirror-model'
import { schema as baseSchema } from 'prosemirror-schema-basic'
import { keymap } from 'prosemirror-keymap'
import { buildMenuItems, exampleSetup } from 'prosemirror-example-setup'
import { Dropdown, MenuItem } from 'prosemirror-menu'

import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  fixTables,
  goToNextCell,
  mergeCells,
  setCellAttr,
  splitCell,
  tableEditing,
  tableNodes,
  toggleHeaderCell,
  toggleHeaderColumn,
  toggleHeaderRow,
} from '../src'

const schema = new Schema({
  nodes: baseSchema.spec.nodes.append(
    tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {
        background: {
          default: null,
          getFromDOM(dom) {
            return dom.style.backgroundColor || null
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs.style = `${attrs.style || ''}background-color: ${value};`
            }
          },
        },
      },
    })
  ),
  marks: baseSchema.spec.marks,
})

const menu = buildMenuItems(schema).fullMenu

function item(label, cmd) {
  return new MenuItem({ label, select: cmd, run: cmd })
}

const tableMenu = [
  item('Insert column before', addColumnBefore),
  item('Insert column after', addColumnAfter),
  item('Delete column', deleteColumn),
  item('Insert row before', addRowBefore),
  item('Insert row after', addRowAfter),
  item('Delete row', deleteRow),
  item('Delete table', deleteTable),
  item('Merge cells', mergeCells),
  item('Split cell', splitCell),
  item('Toggle header column', toggleHeaderColumn),
  item('Toggle header row', toggleHeaderRow),
  item('Toggle header cells', toggleHeaderCell),
  item('Make cell green', setCellAttr('background', '#dfd')),
  item('Make cell not-green', setCellAttr('background', null)),
]
menu.splice(2, 0, [new Dropdown(tableMenu, { label: 'Table' })])

const doc = DOMParser.fromSchema(schema).parse(
  document.querySelector('#content')
)
let state = EditorState.create({
  doc,
  plugins: [
    columnResizing({
      // convertUnit: 'pt',
    }),
    tableEditing(),
    keymap({
      Tab: goToNextCell(1),
      'Shift-Tab': goToNextCell(-1),
    }),
  ].concat(exampleSetup({ schema, menuContent: menu })),
})
const fix = fixTables(state)
if (fix) state = state.apply(fix.setMeta('addToHistory', false))

window.view = new EditorView(document.querySelector('#editor'), {
  state,
  handleClickOn: (view, pos, node) => {
    if (node.type.name === 'table') {
      console.log(pos, node)
    }
  },
})

document.execCommand('enableObjectResizing', false, false)
document.execCommand('enableInlineTableEditing', false, false)
