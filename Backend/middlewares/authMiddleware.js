const { verifyToken } = require('../utils/jwt');
const UserRepository = require('../repositories/UserRepository');

const authenticate = async (req, res, next) => {
    const cookieToken = req.cookies?.accessToken;
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Missing access token',
        });
    }

    try {
        const decoded = verifyToken(token);
        const user = await UserRepository.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'User account is blocked',
            });
        }

        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};

module.exports = {
    authenticate,
};
