import React, { useState }from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(0);
  return <div>{num}</div>;
}

function Child({a}) {
	return <span>{a}</span>;
}
// 1. call jsx to generate App
// 2. call createRoot to render Container and HostRootFiber
// 3. call render to render App
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
