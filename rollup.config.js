
export default {
  input: "src/app.js",
  external: ["d3", "lodash"],
  output: [
    {
      name: "app",
      format: "iife",
      globals: {d3: "d3",  lodash: "_"},
      file: "site/build/app.js"
    }
  ]
};