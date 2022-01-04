const jsdom = require('jsdom')
const ist = require('ist')
const { EditorState } = require('prosemirror-state')
const { table, tr, c11, c, doc } = require('./build')
const { columnResizing, columnResizingPluginKey } = require('../dist')

const { JSDOM } = jsdom
global.document = new JSDOM().window.document

const columnResizingPlugin = columnResizing()

describe('ColumnResizing', () => {
  // 无跨行跨列表格
  const t = doc(
    table(
      tr(/* 2 */ c11, /* 7 */ c11, /* 12 */ c11),
      tr(/* 19 */ c11, /* 24 */ c11, /* 29 */ c11),
      tr(/* 36 */ c11, /* 41 */ c11, /* 46 */ c11)
    )
  )

  // 跨行表格
  const t1 = doc(
    table(
      tr(/* 2 */ c(1, 2), /* 7 */ c11, /* 12 */ c11, /* 17 */ c11),
      tr(/* 24 */ c(1, 1), /* 29 */ c(1, 2), /* 34 */ c11),
      tr(/* 41 */ c11, /* 46 */ c11, /* 51 */ c11)
    )
  )

  // 跨列表格
  const t2 = doc(
    table(
      tr(/* 2 */ c(2, 1), /* 7 */ c11),
      tr(/* 14 */ c11, /* 19 */ c11, /* 24 */ c11),
      tr(/* 31 */ c11, /* 36 */ c(2, 1)),
      tr(/* 43 */ c(3, 1))
    )
  )

  // 跨行跨列表格
  const t3 = doc(
    table(
      tr(/* 2 */ c(1, 2), /* 7 */ c11, /* 12 */ c11, /* 17 */ c11),
      tr(/* 24 */ c(1, 1), /* 29 */ c(2, 2)),
      tr(/* 36 */ c(2, 1)),
      tr(/* 43 */ c11, /* 48 */ c(2, 1), /* 53 */ c11)
    )
  )

  // 初始化 state
  function initState(doc) {
    return EditorState.create({
      doc,
      plugins: [columnResizingPlugin],
    })
  }

  // 更新 state
  function updateState(state, setHandle) {
    return state.apply(state.tr.setMeta(columnResizingPluginKey, { setHandle }))
  }

  // 获取 decorations
  function getDecorations(state) {
    return columnResizingPlugin.props.decorations(state).find()
  }

  it('测试无跨行跨列表格', () => {
    const state = initState(t)
    const newState = updateState(state, 2)
    ist(getDecorations(newState).length, 3)
  })

  it('测试跨行表格', () => {
    const state = initState(t1)
    // 第一行
    const state1 = updateState(state, 2)
    ist(getDecorations(state1).length, 3)
    const state2 = updateState(state, 7)
    ist(getDecorations(state2).length, 3)
    const state3 = updateState(state, 12)
    ist(getDecorations(state3).length, 3)
    const state4 = updateState(state, 17)
    ist(getDecorations(state4).length, 3)
    // 第二行
    const state5 = updateState(state, 24)
    ist(getDecorations(state5).length, 3)
    const state6 = updateState(state, 29)
    ist(getDecorations(state6).length, 3)
    const state7 = updateState(state, 34)
    ist(getDecorations(state7).length, 3)
    // 第三行
    const state8 = updateState(state, 41)
    ist(getDecorations(state8).length, 3)
    const state9 = updateState(state, 46)
    ist(getDecorations(state9).length, 3)
    const state10 = updateState(state, 51)
    ist(getDecorations(state10).length, 3)
  })

  it('测试跨列表格', () => {
    const state = initState(t2)
    // 第一行
    const state1 = updateState(state, 2)
    ist(getDecorations(state1).length, 2)
    const state2 = updateState(state, 7)
    ist(getDecorations(state2).length, 4)
    // 第二行
    const state3 = updateState(state, 14)
    ist(getDecorations(state3).length, 2)
    const state4 = updateState(state, 19)
    ist(getDecorations(state4).length, 2)
    const state5 = updateState(state, 24)
    ist(getDecorations(state5).length, 4)
    // 第三行
    const state6 = updateState(state, 31)
    ist(getDecorations(state6).length, 2)
    const state7 = updateState(state, 36)
    ist(getDecorations(state7).length, 4)
    // 第四行
    const state8 = updateState(state, 43)
    ist(getDecorations(state8).length, 4)
  })

  it('测试跨行跨列表格', () => {
    const state = initState(t3)
    // 第一行
    const state1 = updateState(state, 2)
    ist(getDecorations(state1).length, 3)
    const state2 = updateState(state, 7)
    ist(getDecorations(state2).length, 3)
    const state3 = updateState(state, 12)
    ist(getDecorations(state3).length, 2)
    const state4 = updateState(state, 17)
    ist(getDecorations(state4).length, 4)
    // 第二行
    const state5 = updateState(state, 24)
    ist(getDecorations(state5).length, 3)
    const state6 = updateState(state, 29)
    ist(getDecorations(state6).length, 4)
    // 第三行
    const state7 = updateState(state, 36)
    ist(getDecorations(state7).length, 3)
    // 第四行
    const state8 = updateState(state, 43)
    ist(getDecorations(state8).length, 3)
    const state9 = updateState(state, 48)
    ist(getDecorations(state9).length, 2)
    const state10 = updateState(state, 53)
    ist(getDecorations(state10).length, 4)
  })
})
