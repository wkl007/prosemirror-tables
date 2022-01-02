import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'

export default {
  input: 'example/demo.js',
  output: {
    file: 'example/demo_bundle.js',
    format: 'iife',
  },
  plugins: [
    commonjs(),
    nodeResolve(),
    serve({
      open: true,
      port: 8080,
      openPage: '/example/index.html',
    }),
    livereload(),
  ],
}
