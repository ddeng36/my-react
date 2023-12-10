import { useState, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';

const ctxA = createContext('deafult A');
const ctxB = createContext('default B');

function App() {
	return (
		<ctxA.Provider value={'0'}>
			<Cpn />
			<ctxA.Provider value={'1'}>
				<Cpn />
				<ctxA.Provider value={'2'}>
					<Cpn />
				</ctxA.Provider>
				<Cpn />
			</ctxA.Provider>
			<Cpn />
		</ctxA.Provider>
	);
}

function Cpn() {
	const a = useContext(ctxA);
	const b = useContext(ctxB);
	return (
		<div>
			A: {a} B: {b}
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
