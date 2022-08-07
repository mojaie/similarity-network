
export default {
  input: "src/app.js",
  external: ["d3", "lodash", "pako"],
  output: [
    {
      name: "app",
      format: "iife",
      globals: {d3: "d3",  lodash: "_", pako: "pako"},
      file: "site/build/app.js"
    }
  ]
};