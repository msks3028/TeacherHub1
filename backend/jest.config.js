module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
  verbose: true,
};
