const ist = require('ist')
const { EditorState } = require('prosemirror-state')
const { table, tr, c11, c, doc } = require('./build')
const { columnResizing, columnResizingPluginKey } = require('../dist')

const columnResizingPlugin = columnResizing()

describe('ColumnResizing', () => {
  // 无跨行跨列表格 3 * 3
  // |  2   |  7   |  12  |
  // ----------------------
  // |  19  |  24  |  29  |
  // ----------------------
  // |  36  |  41  |  46  |
  const t = doc(
    table(
      tr(/* 2 */ c11, /* 7 */ c11, /* 12 */ c11),
      tr(/* 19 */ c11, /* 24 */ c11, /* 29 */ c11),
      tr(/* 36 */ c11, /* 41 */ c11, /* 46 */ c11)
    )
  )

  // 跨行表格 4 * 3
  // -----------------------------
  // |      |   7  |  12  |  17  |
  //     2  ----------------------
  // |      |  24  |      |  34  |
  // ---------------  29  --------
  // |  41  |  46  |      |  51  |
  // -----------------------------
  const t1 = doc(
    table(
      tr(/* 2 */ c(1, 2), /* 7 */ c11, /* 12 */ c11, /* 17 */ c11),
      tr(/* 24 */ c(1, 1), /* 29 */ c(1, 2), /* 34 */ c11),
      tr(/* 41 */ c11, /* 46 */ c11, /* 51 */ c11)
    )
  )

  // 跨列表格 3 * 4
  // ----------------------
  // |      2      |   7  |
  // ----------------------
  // |  14  |  19  |  24  |
  // ----------------------
  // |  31  |     36      |
  // ----------------------
  // |         43         |
  // ----------------------
  const t2 = doc(
    table(
      tr(/* 2 */ c(2, 1), /* 7 */ c11),
      tr(/* 14 */ c11, /* 19 */ c11, /* 24 */ c11),
      tr(/* 31 */ c11, /* 36 */ c(2, 1)),
      tr(/* 43 */ c(3, 1))
    )
  )

  // 跨行跨列表格 4 * 4
  // -----------------------------
  // |      |   7  |  12  |  17  |
  //     2  ----------------------
  // |      |  24  |             |
  // ---------------      29
  // |      36     |             |
  // -----------------------------
  // |  43  |     48      |  53  |
  // -----------------------------
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
  function updateState(
    state,
    setHandle,
    isTableLeftBorder = false,
    isTableRightBorder = false
  ) {
    return state.apply(
      state.tr.setMeta(columnResizingPluginKey, {
        setHandle,
        isTableLeftBorder,
        isTableRightBorder,
      })
    )
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
    // 表格左侧边框
    const state1 = updateState(state, 2, true, false)
    test(getDecorations(state1), [6, 23, 40])
    // 中间单元格
    const state2 = updateState(state, 2)
    test(getDecorations(state2), [6, 23, 40])
    const state3 = updateState(state, 7)
    test(getDecorations(state3), [11, 28, 45])
    // 表格右侧边框
    const state4 = updateState(state, 12, false, true)
    test(getDecorations(state4), [16, 33, 50])
  })

  it('测试跨行表格', () => {
    const state = initState(t1)
    // 第一行
    // 表格左侧边框
    const state1 = updateState(state, 2, true, false)
    test(getDecorations(state1), [6, 6, 45])
    // 中间单元格
    const state2 = updateState(state, 2)
    test(getDecorations(state2), [6, 6, 45])
    const state3 = updateState(state, 7)
    test(getDecorations(state3), [11, 28, 50])
    const state4 = updateState(state, 12)
    test(getDecorations(state4), [16, 33, 33])
    // 表格右侧边框
    const state5 = updateState(state, 17, false, true)
    test(getDecorations(state5), [21, 38, 55])
    // 第二行
    // 中间单元格
    const state6 = updateState(state, 24)
    test(getDecorations(state6), [11, 28, 50])
    const state7 = updateState(state, 29)
    test(getDecorations(state7), [16, 33, 33])
    // 表格右侧边框
    const state8 = updateState(state, 34, false, true)
    test(getDecorations(state8), [21, 38, 55])
    // 第三行
    // 表格左侧边框
    const state9 = updateState(state, 41, true, false)
    test(getDecorations(state9), [6, 6, 45])
    // 中间单元格
    const state10 = updateState(state, 41)
    test(getDecorations(state10), [6, 6, 45])
    const state11 = updateState(state, 46)
    test(getDecorations(state11), [11, 28, 50])
    // 表格右侧边框
    const state12 = updateState(state, 51, false, true)
    test(getDecorations(state12), [21, 38, 55])
  })

  it('测试跨列表格', () => {
    const state = initState(t2)
    // 第一行
    // 表格左侧边框
    const state1 = updateState(state, 2, true, false)
    test(getDecorations(state1), [6, 18, 35, 47])
    // 中间单元格
    const state2 = updateState(state, 2)
    test(getDecorations(state2), [6, 23])
    // 表格右侧边框
    const state3 = updateState(state, 7, false, true)
    test(getDecorations(state3), [11, 28, 40, 47])

    // 第二行
    // 表格左侧边框
    const state4 = updateState(state, 14, true, false)
    // 中间单元格
    test(getDecorations(state4), [6, 18, 35, 47])
    const state5 = updateState(state, 14)
    test(getDecorations(state5), [18, 35])
    const state6 = updateState(state, 19)
    test(getDecorations(state6), [6, 23])
    // 表格右侧边框
    const state7 = updateState(state, 24, false, true)
    test(getDecorations(state7), [11, 28, 40, 47])

    // 第三行
    // 表格左侧边框
    const state8 = updateState(state, 31, true, false)
    test(getDecorations(state8), [6, 18, 35, 47])
    // 中间单元格
    const state9 = updateState(state, 31)
    test(getDecorations(state9), [18, 35])
    // 表格右侧边框
    const state10 = updateState(state, 36, false, true)
    test(getDecorations(state10), [11, 28, 40, 47])

    // 第四行
    // 表格左侧边框
    const state11 = updateState(state, 43, true, false)
    test(getDecorations(state11), [6, 18, 35, 47])
    // 表格右侧边框
    const state12 = updateState(state, 43, false, true)
    test(getDecorations(state12), [11, 28, 40, 47])
  })

  it('测试跨行跨列表格', () => {
    const state = initState(t3)
    // 第一行
    // 表格左侧边框
    const state1 = updateState(state, 2, true, false)
    test(getDecorations(state1), [6, 6, 40, 47])
    // 中间单元格
    const state2 = updateState(state, 2)
    test(getDecorations(state2), [6, 6, 47])
    const state3 = updateState(state, 7)
    test(getDecorations(state3), [11, 28, 40])
    const state4 = updateState(state, 12)
    test(getDecorations(state4), [16, 52])
    // 表格右侧边框
    const state5 = updateState(state, 17, false, true)
    test(getDecorations(state5), [21, 33, 33, 57])

    // 第二行
    // 中间单元格
    const state6 = updateState(state, 24)
    test(getDecorations(state6), [11, 28, 40])
    // 表格右侧边框
    const state7 = updateState(state, 29, false, true)
    test(getDecorations(state7), [21, 33, 33, 57])

    // 第三行
    // 表格左侧边框
    const state8 = updateState(state, 36, true, false)
    // 中间单元格
    test(getDecorations(state8), [6, 6, 40, 47])
    const state9 = updateState(state, 36)
    test(getDecorations(state9), [11, 28, 40])

    // 第四行
    // 表格左侧边框
    const state10 = updateState(state, 43, true, false)
    test(getDecorations(state10), [6, 6, 40, 47])
    // 中间单元格
    const state11 = updateState(state, 43)
    test(getDecorations(state11), [6, 6, 47])
    const state12 = updateState(state, 48)
    test(getDecorations(state12), [16, 52])
    // 表格右侧边框
    const state13 = updateState(state, 53, false, true)
    test(getDecorations(state13), [21, 33, 33, 57])
  })
})
