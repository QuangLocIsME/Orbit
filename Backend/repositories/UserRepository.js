const User = require('../models/User');
class UserRepository {
    async findbyEmail(email) {
        return await User.findOne({ email });
}
    async createUser(user) {
    const newUser = new User(user);
    return await newUser.save();
}


}
module.exports = new UserRepository();