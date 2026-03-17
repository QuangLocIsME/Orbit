/**
 * Passport Google OAuth 2.0 strategy.
 * Validates Google token and ensures email is from Google profile.
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const UserRepository = require('../repositories/UserRepository');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3000';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('[Passport] Google OAuth is not configured.');
}

passport.use(
    new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID || 'dummy',
            clientSecret: GOOGLE_CLIENT_SECRET || 'dummy',
            callbackURL: `${BASE_URL}/api/auth/google/callback`,
            scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                if (!profile?.id || !profile?.emails?.[0]?.value) {
                    return done(new Error('Google profile missing id or email'), null);
                }

                const googleId = profile.id;
                const email = profile.emails[0].value.toLowerCase().trim();
                const name = profile.displayName || profile.name?.givenName || email.split('@')[0];
                const avatar = profile.photos?.[0]?.value || null;

                let user = await UserRepository.findByGoogleId(googleId);
                if (user) {
                    if (user.isBlocked) {
                        return done(new Error('User account is blocked.'), null);
                    }
                    await UserRepository.updateLastLoginAt(user._id);
                    user = await UserRepository.findById(user._id);
                    return done(null, { user, isNew: false });
                }

                user = await UserRepository.findByEmail(email);
                if (user) {
                    if (user.isBlocked) {
                        return done(new Error('User account is blocked.'), null);
                    }
                    if (user.provider === 'local') {
                        const linkedUser = await UserRepository.linkGoogleAccount(
                            user._id,
                            googleId,
                            avatar
                        );
                        await UserRepository.updateLastLoginAt(linkedUser._id);
                        return done(null, { user: linkedUser, isNew: false });
                    }
                    await UserRepository.updateLastLoginAt(user._id);
                    user = await UserRepository.findById(user._id);
                    return done(null, { user, isNew: false });
                }

                const newUser = await UserRepository.createUser({
                    fullName: name,
                    email,
                    googleId,
                    avatar,
                    provider: 'google',
                    password: null,
                    isVerified: true,
                });

                return done(null, { user: newUser, isNew: true });
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

module.exports = passport;
