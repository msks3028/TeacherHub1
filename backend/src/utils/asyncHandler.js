// Wraps an async Express route handler so a rejected promise (any thrown
// error inside an `async function`) is forwarded to next(err) and handled
// by the central error middleware — instead of becoming an "unhandled
// promise rejection", which crashes the entire Node process since Node 15
// and takes down every page on the platform, not just the one request that
// failed.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
