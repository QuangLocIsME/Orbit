const mongoose = require('mongoose');

beforeAll(async () => {
  jest.spyOn(mongoose, 'connect').mockResolvedValue(true);
  jest.spyOn(mongoose, 'disconnect').mockResolvedValue(true);
});

afterAll(async () => {
  jest.restoreAllMocks();
});
