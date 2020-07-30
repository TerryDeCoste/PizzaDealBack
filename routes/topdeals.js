const getDeals = require('../util/get_deals');

module.exports = async (req, res, next) => {
    //set variables to default if needed.
    const lat = req.body.lat || 42.922551;
    const lon = req.body.lon || -81.19804;
    const range = req.body.range || 25;
    
    const dealOutput = await getDeals(lat, lon, range, [], 'value DESC', 10);
    
    if (dealOutput.length > 0){
        return res.status(200).json(dealOutput);  
    }
    return res.status(500).json([]);
};

