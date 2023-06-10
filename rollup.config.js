
export default {
  input: "src/app.js",
  external: ["d3", "pako"],
  output: [
    {
      name: "app",
      format: "iife",
      globals: {d3: "d3", pako: "pako"},
      file: "docs/build/app.js"
    }
  ]
};