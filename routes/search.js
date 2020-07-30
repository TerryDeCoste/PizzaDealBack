const getDeals = require('../util/get_deals');

module.exports = async (req, res, next) => {
    //extract search criteria
    const location = req.body.location || { latitude: 42.959622, longitude: -81.228499 };
    const storeRange = req.body.storeRange || 25;
    const priceLimit = req.body.priceLimit || 'all';
    const deliveryRequired = req.body.deliveryRequired || 'no';
    const orderBy = req.body.orderBy || 'value';
    const items = req.body.items || [];
    
    //store filter
    const deliveryReq = deliveryRequired === 'yes';
    
    //deal filters
    const dealFilterText = [];
    if (priceLimit != 'all' && Number(priceLimit)){
        dealFilterText.push('price <= ' + Number(priceLimit));
    }
    if (items.length > 0){
        const itemIDs = [];
        items.forEach(item => {
            if (!itemIDs.includes(item.id)){
                itemIDs.push(item.id);
            }

        });
        itemIDs.forEach(item => {
            dealFilterText.push(item + " = ANY(items)")
        });
    }

    //get deals
    const deals = await getDeals(location.latitude, location.longitude, storeRange, dealFilterText, '', 0, deliveryReq);

    //create output information, checking for proper item counts
    let outputDeals = [];
    deals.forEach(deal => {
        let good = true;
        //check to make sure items match item filters
        deal.itemObjs.forEach(dealItem => {
            const filterItem = items.find(fltr => fltr.id === Number(dealItem.id));
            if (filterItem){
                //check count
                if (filterItem.count > dealItem.itemCount){
                    good = false; 
                }
                //check option count
                if (filterItem.optionCount > 0){
                    if (filterItem.options != dealItem.option.name
                        || filterItem.optionCount > dealItem.optionCount){
                        good = false;
                    }
                }
                //check sizes
                const okSizes = [filterItem.size];
                if (filterItem.size.toLowerCase() == "small"){
                    okSizes.push("Medium");
                    okSizes.push("Large");
                    okSizes.push("X-Large");
                } else if (filterItem.size.toLowerCase() == "medium"){
                    okSizes.push("Large");
                    okSizes.push("X-Large");
                } else if (filterItem.size.toLowerCase() == "large"){
                    okSizes.push("X-Large");
                }
                if (!okSizes.includes(dealItem.size.name)){
                    good = false;
                }
            }
        });

        if (good){
            outputDeals.push(deal);
        }
    })

    if (outputDeals.length > 0){
        //order output
        if (orderBy === 'distance'){
            outputDeals = outputDeals.sort((a,b) => a.distance >= b.distance ? 1 : -1);
        } else if (orderBy === 'price'){
            outputDeals = outputDeals.sort((a,b) => a.price >= b.price ? 1 : -1);
        } else if (orderBy === 'value'){
            outputDeals = outputDeals.sort((a,b) => a.value <= b.value ? 1 : -1);
        }
    }
     

    //output sorted data
    return res.status(200).json(outputDeals);
};