import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import replace from '@rollup/plugin-replace';
import { getPckPath } from '../rollup/utils';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		replace({
			__DEV__: true,
			preventAssignment: true
		})
	],
	resolve: {
		alias: [
			{
				find: 'react',
				replacement: getPckPath('react')
			},
			{
				find: 'react-dom',
				replacement: getPckPath('react-dom')
			},
			{
				find: 'hostConfig',
				replacement: path.resolve(
					getPckPath('react-dom'),
					'./src/hostConfig.ts'
				)
			}
		]
	}
});
