// A small optional helper for measuring how fast the app feels to use
// (things like "how long until the page is ready to interact with"). It's
// not required for the app to work — it's just a tool you can turn on if
// you want to track performance numbers.

// onPerfEntry is a function you can supply (like console.log) that will
// receive each performance measurement as it's collected.
const reportWebVitals = onPerfEntry => {
  // Only do anything if a real function was actually passed in.
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // Load the "web-vitals" measuring tool only when it's actually needed
    // (this keeps the app's initial download smaller for everyone who
    // doesn't use this feature).
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // Each of these measures a different kind of "how fast/smooth did
      // this feel" number, then hands the result to onPerfEntry.
      getCLS(onPerfEntry);  // how much the page unexpectedly shifts around
      getFID(onPerfEntry);  // how long before the page responds to a click
      getFCP(onPerfEntry);  // how long until the first bit of content shows
      getLCP(onPerfEntry);  // how long until the main content shows
      getTTFB(onPerfEntry); // how long the server took to first respond
    });
  }
};

// Make this function available for other files (like index.js) to use.
export default reportWebVitals;
