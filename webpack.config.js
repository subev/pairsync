const nodeExternals = require("webpack-node-externals");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: {
    client: "./client.ts",
    server: "./server.ts",
  },
  output: {
    filename: "[name].js",
    path: __dirname + "/webpack-output/",
  },
  target: "node",
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js", ".node"],
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader" },
      {
        test: /.node$/,
        loader: "node-loader",
      },
    ],
  },
  externals: [nodeExternals()],
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
  ],
};
