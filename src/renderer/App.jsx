import React from 'react';
import { createRoot } from 'react-dom/client';
function App() {
  return (
    <div>
      <h1>Resolume Arena Application Timer</h1>
    </div>
  );
}
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
