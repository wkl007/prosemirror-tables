// This file defines a plugin that handles the drawing of cell
// selections and the basic user interactions for creating and working
// with such selections. It also makes sure that, after each
// transaction, the shapes of tables are normalized to be rectangular
// and not contain overlapping cells.

import {Plugin} from "prosemirror-state"

import {handleTripleClick, handleKeyDown, handlePaste, handleMouseDown} from "./input"
import {key, cellAround, inSameTable} from "./util"
import {drawCellSelection, normalizeSelection} from "./cellselection"
import {fixTables} from "./fixtables"

// :: () → Plugin
//
// Creates a [plugin](http://prosemirror.net/docs/ref/#state.Plugin)
// that, when added to an editor, enables cell-selection, handles
// cell-based copy/paste, and makes sure tables stay well-formed (each
// row has the same width, and cells don't overlap).
//
// You should probably put this plugin near the end of your array of
// plugins, since it handles mouse and arrow key events in tables
// rather broadly, and other plugins, like the gap cursor or the
// column-width dragging plugin, might want to get a turn first to
// perform more specific behavior.
export function tableEditing() {
  return new Plugin({
    key,

    // This piece of state is used to remember when a mouse-drag
    // cell-selection is happening, so that it can continue even as
    // transactions (which might move its anchor cell) come in.
    state: {
      init() { return null },
      apply(tr, cur) {
        let set = tr.getMeta(key)
        if (set != null) return set == -1 ? null : set
        if (cur == null || !tr.docChanged) return cur
        let {deleted, pos} = tr.mapping.mapResult(cur)
        return deleted ? null : pos
      }
    },

    props: {
      decorations: drawCellSelection,

      handleDOMEvents: {
        mousedown: handleMouseDown
      },

      createSelectionBetween(view) {
        if (key.getState(view.state) != null) return view.state.selection
      },

      handleTripleClick,

      handleKeyDown,

      handlePaste
    },

    appendTransaction(_, oldState, state) {
      return normalizeSelection(state, fixTables(state, oldState))
    }
  })
}

export {fixTables, handlePaste, cellAround, inSameTable}
export {tableNodes} from "./schema"
export {CellSelection} from "./cellselection"
export {TableMap} from "./tablemap"
export {addColumn, addColumnBefore, addColumnAfter, deleteColumn, addRow, addRowBefore, addRowAfter, deleteRow, mergeCells, splitCell,
        setCellAttr, toggleHeaderRow, toggleHeaderColumn, toggleHeaderCell, goToNextCell, deleteTable} from "./commands"
export {columnResizing} from "./columnresizing"
export {pastedCells as __pastedCells, insertCells as __insertCells, clipCells as __clipCells} from "./copypaste"
