module.exports = {
  "use": ["autoprefixer", "cssnano"],
  "local-plugins": true,
  "autoprefixer": {
      "browsers": "> 5%"
  },
  'postcss-pxtorem':{
    'rootValue': 16,
    'unitPrecision': 5,
    'propList': ['font', 'font-size', 'line-height', 'letter-spacing'],
    'selectorBlackList': [],
    'replace': false,
    'mediaQuery': true,
    'minPixelValue': 0
  },
  'postcss-import': {},
  'postcss-cssnext': {
    'browsers': ['last 2 versions', '> 5%'],
  },
  'cssnano': {
    'safe': true
  },
  'css-mqpacker':{

  }
}
