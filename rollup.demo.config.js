import babel from '@rollup/plugin-babel'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'demo.js',
  output: { format: 'iife', file: 'demo_bundle.js' },
  plugins: [
    commonjs({
      include: '../**',
      sourceMap: false,
    }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
    }),

    nodeResolve({
      mainFields: ['main'],
      browser: true,
    }),
  ],
}
