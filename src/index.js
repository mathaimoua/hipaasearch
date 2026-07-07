// This is the very first file that runs when the app starts. Its only job
// is to find the empty <div id="root"> in public/index.html and tell React
// to draw ("render") our App component inside it.

// React itself.
import React from 'react';
// The piece of React that knows how to draw things into a real web page
// (as opposed to, say, a phone app).
import ReactDOM from 'react-dom/client';
// Our shared base styling (colors, fonts) from index.css.
import './index.css';
// The main App component, which decides which page to show.
import App from './App';

// Find the empty <div id="root"></div> in the HTML page and prepare it as
// the place where our app will live.
const root = ReactDOM.createRoot(document.getElementById('root'));
// Actually draw the app inside that div.
root.render(
  // StrictMode is a helper that isn't visible to visitors — it just runs
  // some extra checks during development to catch mistakes early.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
