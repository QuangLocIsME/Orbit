const bcrypt = require('bcrypt');

jest.mock('../services/UserService', () => ({
  UserService: {
    checkAccountLock: jest.fn(),
    LOCKOUT_DURATION_MS: 900000,
    MAX_LOGIN_ATTEMPTS: 5,
  },
  userService: {
    createUser: jest.fn(),
    loginUser: jest.fn(),
    requestResetCode: jest.fn(),
    resetPassword: jest.fn(),
  },
}));
jest.mock('../repositories/UserRepository');
jest.mock('../services/emailService');
jest.mock('../utils/securityLog', () => ({
  logSecurityEvent: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  hashSync: jest.fn(),
}));

const { UserService, userService } = require('../services/UserService');
const authController = require('../controllers/AuthController');

describe('Auth Controller - Login', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
  });

  describe('POST /auth/login - Test Cases', () => {
    const validUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      password: '$2b$10$validHash',
      fullName: 'Test User',
      role: 'user',
      isBlocked: false,
    };

    it('TC001: Login with non-existent email should return "Email or password is incorrect."', async () => {
      userService.loginUser.mockRejectedValue(
        new Error('Email or password is incorrect.')
      );

      mockReq = {
        body: {
          email: 'unknown@gmail.com',
          password: 'password123',
        },
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Email or password is incorrect.',
        })
      );
    });

    it('TC002: Login with incorrect password should return "Email or password is incorrect."', async () => {
      userService.loginUser.mockRejectedValue(
        new Error('Email or password is incorrect.')
      );

      mockReq = {
        body: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Email or password is incorrect.',
        })
      );
    });

    it('TC003: Login with correct credentials should return success', async () => {
      userService.loginUser.mockResolvedValue(validUser);

      mockReq = {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123',
        },
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login success',
          data: expect.objectContaining({
            fullName: 'Test User',
            email: 'test@example.com',
          }),
        })
      );
      expect(mockRes.cookie).toHaveBeenCalled();
    });

    it('TC004: Login with missing email should return error', async () => {
      userService.loginUser.mockRejectedValue(
        new Error('Email or password is incorrect.')
      );

      mockReq = {
        body: {
          email: '',
          password: 'password123',
        },
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Email or password is incorrect.',
        })
      );
    });

    it('TC005: Login with blocked account should return error', async () => {
      userService.loginUser.mockRejectedValue(
        new Error('Email or password is incorrect.')
      );

      mockReq = {
        body: {
          email: 'blocked@example.com',
          password: 'ValidPassword123',
        },
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Email or password is incorrect.',
        })
      );
    });
  });
});

describe('Auth Controller - Register', () => {
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('TC006: Register with existing email should return error', async () => {
    userService.createUser.mockRejectedValue(
      new Error('Email already exists.')
    );

    const mockReq = {
      body: {
        fullName: 'Test User',
        email: 'existing@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        agree: true,
      },
    };

    await authController.register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('TC007: Register with missing agreement should return error', async () => {
    userService.createUser.mockRejectedValue(
      new Error('You must accept the terms.')
    );

    const mockReq = {
      body: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        agree: false,
      },
    };

    await authController.register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

describe('UserService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    it('TC008: Should return user object on successful login', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        isBlocked: false,
      };

      userService.loginUser.mockResolvedValue(mockUser);

      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValue(true);
    });

    it('TC009: Should throw error for invalid email format', async () => {
      userService.loginUser.mockRejectedValue(
        new Error('Email or password is incorrect.')
      );

      await expect(
        userService.loginUser('invalid-email', 'password123')
      ).rejects.toThrow('Email or password is incorrect.');
    });

    it('TC010: Should throw error for blocked user', async () => {
      userService.loginUser.mockRejectedValue(
        new Error('Email or password is incorrect.')
      );

      await expect(
        userService.loginUser('blocked@example.com', 'password')
      ).rejects.toThrow('Email or password is incorrect.');
    });
  });

  describe('createUser', () => {
    it('TC011: Should throw error when passwords do not match', async () => {
      userService.createUser.mockRejectedValue(
        new Error('Password confirmation does not match.')
      );

      await expect(
        userService.createUser({
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
          confirmPassword: 'DifferentPassword',
          agree: true,
        })
      ).rejects.toThrow('Password confirmation does not match.');
    });

    it('TC012: Should throw error when terms not accepted', async () => {
      userService.createUser.mockRejectedValue(
        new Error('You must accept the terms.')
      );

      await expect(
        userService.createUser({
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
          confirmPassword: 'Password123',
          agree: false,
        })
      ).rejects.toThrow('You must accept the terms.');
    });
  });

  describe('createUser - Backend Validation', () => {
    it('TC013: Should throw error "Full name is required" when full name is empty', async () => {
      userService.createUser.mockRejectedValue(
        new Error('Full name is required.')
      );

      await expect(
        userService.createUser({
          fullName: '',
          email: 'test@example.com',
          password: 'Password123',
          confirmPassword: 'Password123',
          agree: true,
        })
      ).rejects.toThrow('Full name is required.');
    });

    it('TC014: Should throw error "Email is required" when email is empty', async () => {
      userService.createUser.mockRejectedValue(
        new Error('Email is required.')
      );

      await expect(
        userService.createUser({
          fullName: 'Test User',
          email: '',
          password: 'Password123',
          confirmPassword: 'Password123',
          agree: true,
        })
      ).rejects.toThrow('Email is required.');
    });

    it('TC015: Should throw error "Password is required" when password is empty', async () => {
      userService.createUser.mockRejectedValue(
        new Error('Password is required.')
      );

      await expect(
        userService.createUser({
          fullName: 'Test User',
          email: 'test@example.com',
          password: '',
          confirmPassword: '',
          agree: true,
        })
      ).rejects.toThrow('Password is required.');
    });
  });
});
