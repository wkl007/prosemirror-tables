import babel from '@rollup/plugin-babel'

export default {
  input: './src/index.js',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.es.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    // getBabelOutputPlugin({
    //   configFile: path.resolve(__dirname, 'babel.config.js'),
    //   allowAllFormats: true,
    // }),
    babel({ babelHelpers: 'runtime' }),
  ],
  external(id) {
    return !/^[./]/.test(id)
  },
}
