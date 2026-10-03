const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Pin the algorithm on both sides so a token can never be accepted under a
// different (or "none") algorithm.
const ALGORITHM = "HS256";

function signToken(payload) {
  return jwt.sign({ ...payload, jti: payload.jti || crypto.randomUUID() }, process.env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
