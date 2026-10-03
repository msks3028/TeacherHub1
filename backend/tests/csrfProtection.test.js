const { csrfProtection } = require("../src/middleware/csrf");

function request({ method = "POST", origin, referer, token, fetchSite, authorization } = {}) {
  return {
    method,
    cookies: token ? { token } : {},
    get(name) {
      return ({ origin, referer, "sec-fetch-site": fetchSite, authorization })[name.toLowerCase()];
    },
  };
}

function invoke(req) {
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let continued = false;
  csrfProtection(req, res, () => { continued = true; });
  return { res, continued };
}

describe("CSRF origin checks", () => {
  const previous = process.env.CLIENT_URL;
  beforeEach(() => { process.env.CLIENT_URL = "https://teacherhub.example"; });
  afterAll(() => { if (previous === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = previous; });

  test("rejects a foreign origin", () => {
    const { res, continued } = invoke(request({ origin: "https://attacker.example" }));
    expect(continued).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test("rejects cookie-authenticated writes without same-origin evidence", () => {
    const { res, continued } = invoke(request({ token: "session" }));
    expect(continued).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test("allows same-origin cookie writes and bearer-only API clients", () => {
    expect(invoke(request({ origin: "https://teacherhub.example", token: "session" })).continued).toBe(true);
    expect(invoke(request({ authorization: "Bearer token" })).continued).toBe(true);
  });
});
