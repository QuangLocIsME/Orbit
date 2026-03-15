const UserRepository = require('../repositories/UserRepository');

class ProfileController {
    async getCurrentUser(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const profile = await UserRepository.getProfileById(userId);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            return res.status(200).json({
                success: true,
                data: profile,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load profile',
            });
        }
    }

    async getUserById(req, res) {
        try {
            const publicId = req.params?.publicId;
            if (!publicId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing public id',
                });
            }

            const profile = await UserRepository.getProfileByPublicId(publicId);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            return res.status(200).json({
                success: true,
                data: profile,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load profile',
            });
        }
    }
}

module.exports = new ProfileController();
