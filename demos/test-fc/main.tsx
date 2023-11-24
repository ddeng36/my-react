import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	return (
		<div>
			<Child />
		</div>
	);
}

function Child() {
	return <span>big-react</span>;
}
// 1. call jsx to generate App
// 2. call createRoot to render Container and HostRootFiber
// 3. call render to render App
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
