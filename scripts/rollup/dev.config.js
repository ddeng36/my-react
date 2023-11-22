import typescript from 'rollup-plugin-typescript2';
import path from 'path';
import resolve from '@rollup/plugin-babel';
import babel from '@rollup/plugin-babel';
import generatePackageJson from 'rollup-plugin-generate-package-json';

const tsConfig = { tsConfig: 'tsconfig.json' };

function resolvePkgPath(pkgName, isDist) {
	const pkgPath = path.resolve(__dirname, '../../packages');
	const distPath = path.resolve(__dirname, '../../dist/node_modules');
	if (isDist) {
		return `${distPath}/${pkgName}`;
	}
	return `${pkgPath}/${pkgName}`;
}

export default [
	{
		input: `${resolvePkgPath('react-dom', false)}/index.ts`,
		output: [
			{
				file: `${resolvePkgPath('react-dom', true)}/client.js`,
				name: 'client.js',
				format: 'umd'
			},
			{
				file: `${resolvePkgPath('react-dom', true)}/index.js`,
				name: 'index.js',
				format: 'umd'
			}
		],
		plugins: [
			typescript(tsConfig),
			resolve(),
			generatePackageJson({
				inputFolder: resolvePkgPath('react-dom', false),
				outputFolder: resolvePkgPath('react-dom', true),
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	{
		input: `${resolvePkgPath('react', false)}/index.ts`,
		output: {
			file: `${resolvePkgPath('react', true)}/index.js`,
			name: 'index.js',
			format: 'umd'
		},
		plugins: [
			typescript(tsConfig),
			resolve(),
			generatePackageJson({
				inputFolder: resolvePkgPath('react', false),
				outputFolder: resolvePkgPath('react', true),
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	{
		input: `${resolvePkgPath('react', false)}/src/jsx.ts`,
		output: {
			file: `${resolvePkgPath('react', true)}/jsx-dev-runtime.js`,
			name: 'jsx-dev-runtime.js',
			format: 'umd'
		},
		plugins: [typescript(tsConfig), resolve()]
	}
];
