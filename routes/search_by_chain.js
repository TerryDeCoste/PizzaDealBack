const getDeals = require('../util/get_deals_per_chain');

module.exports = async (req, res, next) => {
    //extract search criteria
    const location = req.body.location || { latitude: 42.959622, longitude: -81.228499 };
    const storeRange = req.body.storeRange || 25;
    const priceLimit = req.body.priceLimit || 'all';
    const deliveryRequired = req.body.deliveryRequired || 'no';
    const orderBy = req.body.orderBy || 'price';
    const items = req.body.items || [];
    
    //store filter
    const deliveryReq = deliveryRequired === 'yes';
    
    //get deals
    let outputDeals = await getDeals(location.latitude, location.longitude, storeRange, deliveryReq, priceLimit, items);
    
    if (outputDeals.length > 0){
        //order output
        if (orderBy === 'distance'){
            outputDeals = outputDeals.sort((a,b) => a.distance >= b.distance ? 1 : -1);
        } else if (orderBy === 'value'){
            outputDeals = outputDeals.sort((a,b) => a.bestvalue <= b.bestvalue ? 1 : -1);
        } else {
            outputDeals = outputDeals.sort((a,b) => a.bestprice >= b.bestprice ? 1 : -1);
        }
    }
     

    //output sorted data
    return res.status(200).json(outputDeals);
};