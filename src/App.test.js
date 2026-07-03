// An automatic check ("test") that makes sure the app still shows the login
// page when nobody is signed in. Running this file catches it early if a
// future change accidentally breaks the login page.

// render: draws a component in a fake, invisible browser just for testing.
// screen: lets us look at what got drawn and search it for text.
import { render, screen } from '@testing-library/react';
// The whole app, starting from the top.
import App from './App';

// Describe one test: what it checks, and the code that checks it.
test('renders login page when signed out', async () => {
  // Draw the whole app as if a visitor just opened it in a browser.
  render(<App />);
  // Wait for, then look for, text that says "sign in to continue"
  // (case doesn't matter, thanks to /i). If it shows up, we know the login
  // page rendered successfully.
  const heading = await screen.findByText(/sign in to continue/i);
  // Fail the test loudly if that text never appeared.
  expect(heading).toBeInTheDocument();
});
