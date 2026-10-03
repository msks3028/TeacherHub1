jest.mock("../src/config/db", () => ({
  platformSettings: { findUnique: jest.fn(), upsert: jest.fn() },
}));

const prisma = require("../src/config/db");
const { getSettings } = require("../src/controllers/settingsController");

function response() {
  return { json(body) { this.body = body; return this; } };
}

test("GET settings reads the singleton without writing defaults", async () => {
  prisma.platformSettings.findUnique.mockResolvedValue(null);
  const res = response();

  await getSettings({}, res);

  expect(prisma.platformSettings.findUnique).toHaveBeenCalledWith({ where: { id: "singleton" } });
  expect(prisma.platformSettings.upsert).not.toHaveBeenCalled();
  expect(res.body).toEqual({ settings: null });
});
