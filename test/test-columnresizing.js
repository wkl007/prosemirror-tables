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

  // 获取 decorations pos 信息
  function getDecorations(state) {
    return columnResizingPlugin.props
      .decorations(state)
      .find()
      .map((i) => i.from)
  }

  // 测试函数
  function test(a, b) {
    ist(a.join(', '), b.join(', '))
  }

  it('测试无跨行跨列表格', () => {
    const state = initState(t)
    const newState = updateState(state, 2)
    test(getDecorations(newState), [6, 23, 40])
  })

  it('测试跨行表格', () => {
    const state = initState(t1)
    // 第一行
    const state1 = updateState(state, 2)
    test(getDecorations(state1), [6, 6, 45])
    const state2 = updateState(state, 7)
    test(getDecorations(state2), [11, 28, 50])
    const state3 = updateState(state, 12)
    test(getDecorations(state3), [16, 33, 33])
    const state4 = updateState(state, 17)
    test(getDecorations(state4), [21, 38, 55])
    // 第二行
    const state5 = updateState(state, 24)
    test(getDecorations(state5), [11, 28, 50])
    const state6 = updateState(state, 29)
    test(getDecorations(state6), [16, 33, 33])
    const state7 = updateState(state, 34)
    test(getDecorations(state7), [21, 38, 55])
    // 第三行
    const state8 = updateState(state, 41)
    test(getDecorations(state8), [6, 6, 45])
    const state9 = updateState(state, 46)
    test(getDecorations(state9), [11, 28, 50])
    const state10 = updateState(state, 51)
    test(getDecorations(state10), [21, 38, 55])
  })

  it('测试跨列表格', () => {
    const state = initState(t2)
    // 第一行
    const state1 = updateState(state, 2)
    test(getDecorations(state1), [6, 23])
    const state2 = updateState(state, 7)
    test(getDecorations(state2), [11, 28, 40, 47])
    // 第二行
    const state3 = updateState(state, 14)
    test(getDecorations(state3), [18, 35])
    const state4 = updateState(state, 19)
    test(getDecorations(state4), [6, 23])
    const state5 = updateState(state, 24)
    test(getDecorations(state5), [11, 28, 40, 47])
    // 第三行
    const state6 = updateState(state, 31)
    test(getDecorations(state6), [18, 35])
    const state7 = updateState(state, 36)
    test(getDecorations(state7), [11, 28, 40, 47])
    // 第四行
    const state8 = updateState(state, 43)
    test(getDecorations(state8), [11, 28, 40, 47])
  })

  it('测试跨行跨列表格', () => {
    const state = initState(t3)
    // 第一行
    const state1 = updateState(state, 2)
    test(getDecorations(state1), [6, 6, 47])
    const state2 = updateState(state, 7)
    test(getDecorations(state2), [11, 28, 40])
    const state3 = updateState(state, 12)
    test(getDecorations(state3), [16, 52])
    const state4 = updateState(state, 17)
    test(getDecorations(state4), [21, 33, 33, 57])
    // 第二行
    const state5 = updateState(state, 24)
    test(getDecorations(state5), [11, 28, 40])
    const state6 = updateState(state, 29)
    test(getDecorations(state6), [21, 33, 33, 57])
    // 第三行
    const state7 = updateState(state, 36)
    test(getDecorations(state7), [11, 28, 40])
    // 第四行
    const state8 = updateState(state, 43)
    test(getDecorations(state8), [6, 6, 47])
    const state9 = updateState(state, 48)
    test(getDecorations(state9), [16, 52])
    const state10 = updateState(state, 53)
    test(getDecorations(state10), [21, 33, 33, 57])
  })
})
