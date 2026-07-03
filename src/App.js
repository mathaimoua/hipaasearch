// This is the top-level "traffic controller" of the whole app. It decides
// which page to show based on the web address (URL), and wraps everything
// in the login-tracking helper so any page can know who's signed in.

// BrowserRouter: turns on address-bar-based navigation for the app.
// Routes / Route: let us say "when the address is X, show component Y".
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Wraps the app so every page can find out who's logged in.
import { AuthProvider } from './context/AuthContext';
// The gatekeeper that blocks a page unless someone is signed in.
import { ProtectedRoute } from './components/ProtectedRoute';
// The two pages we currently have: the sign-in form, and the placeholder
// signed-in view.
import Login from './pages/Login';
import Home from './pages/Home';
// Shared page-wide styling.
import './App.css';

function App() {
  return (
    // Turns on URL-based navigation for everything inside it.
    <BrowserRouter>
      {/* Makes login info available to every page inside it. */}
      <AuthProvider>
        {/* Only one of the Routes below will actually be shown, based on
            the current web address. */}
        <Routes>
          {/* Visiting /login shows the sign-in form, no login required. */}
          <Route path="/login" element={<Login />} />
          {/* Visiting / (the home address) shows Home, but only if signed
              in — ProtectedRoute checks that and redirects to /login if
              not. */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
