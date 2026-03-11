const webpack = require("@nativescript/webpack");
const { DefinePlugin } = require("webpack");

module.exports = (env) => {
	webpack.init(env);
	webpack.chainWebpack((config) => {
		config.plugin("directus-build-config").use(DefinePlugin, [{
			__DIRECTUS_URL__: JSON.stringify(process.env.DIRECTUS_URL || ""),
			__DIRECTUS_TOKEN__: JSON.stringify(process.env.DIRECTUS_TOKEN || ""),
		}]);
	});

	// Learn how to customize:
	// https://docs.nativescript.org/webpack

	return webpack.resolveConfig();
};
