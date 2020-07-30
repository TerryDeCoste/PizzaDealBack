const db = require('../sql/database');

module.exports = async (req, res, next) => {
    //pull logo and website from database
    const { rows, rowCount } = await db.query(" SELECT logo, website FROM chains ", []);
    if (rowCount > 0){
        return res.status(200).json(rows);
    }
    return res.status(500).json('No Chains found');
};