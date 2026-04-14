const { verifyToken } = require('../utils/jwt');
const UserRepository = require('../repositories/UserRepository');

const authenticate = async (req, res, next) => {
    const cookieToken = req.cookies?.accessToken;
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    console.log('[Auth] Cookie token present:', !!cookieToken);
    console.log('[Auth] Header token present:', !!headerToken);

    if (!token) {
        console.log('[Auth] No token provided');
        return res.status(401).json({
            success: false,
            message: 'Missing access token',
        });
    }

    try {
        const decoded = verifyToken(token);
        console.log('[Auth] Token decoded, user id:', decoded.id);
        
        const user = await UserRepository.findById(decoded.id);

        if (!user) {
            console.log('[Auth] User not found for id:', decoded.id);
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
        console.log('[Auth] Authentication successful, user:', decoded.id);
        return next();
    } catch (error) {
        console.log('[Auth] Token verification failed:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};

module.exports = {
    authenticate,
};
