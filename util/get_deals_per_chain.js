const db = require('../sql/database');
const {getMinMaxLatLon, getDistanceBetweenLatLonsInKM} = require('../util/distancecalcs');
const {getMinObjValue, getMaxObjValue} = require('../util/general_util');

const getChainsWithinRadius = async (lat, lon, range, delivery) => {
    //pull stores, chains within radius (box, then radius to have quick calculation)
    const {lats, lons} = getMinMaxLatLon(lat, lon, range);
    let storeQuery = ' SELECT ' + 
    '   s.id   AS store_id ' + 
    ' , s.name AS store_name ' + 
    ' , c.id   AS chain_id' + 
    ' , c.name AS chain_name' + 
    ' , c.logo' + 
    ' , c.website' + 
    ' , s.address' + 
    ' , s.lat' + 
    ' , s.lon' + 
    ' , s.phone ' + 
    ' FROM stores s ' + 
    ' INNER JOIN chains c ON s.chain_id = c.id' + 
    ' WHERE lat BETWEEN $1 AND $2 ' + 
    ' AND lon BETWEEN $3 AND $4';
    if (delivery){
        storeQuery += ' AND delivery = true ';
    }

    const stores = await(await db.query(storeQuery, [lats.min, lats.max, lons.min, lons.max])).rows;

    //add distance to stores, then filter results
    const storeOutput = [];
    stores.forEach(store => {
        const distance = getDistanceBetweenLatLonsInKM(lat, lon, store.lat, store.lon);
        if (distance <= range){
            storeOutput.push({
                ...store,
                distance: distance,    
            })
        }
    });

    //filter to nearest store per chain
    const sortedStores = storeOutput.sort((a, b) => a.distance >= b.distance ? 1 : -1);
    const onePerChain = [];
    const chainList = [];
    sortedStores.forEach(store => {
      if (!chainList.includes(store.chain_id)){
        chainList.push(store.chain_id);
        onePerChain.push(store);
      }
    });

    return onePerChain;
}

module.exports = async (lat = 42.922551, lon = -81.19804, range = 25, delivery = false, priceLimit = 'all', items = []) => {
    let step = "START";
    try{
        //get stores
        const chains = await getChainsWithinRadius(lat, lon, range, delivery);
        
        //for each chain, find the best and cheapest deals
        step = "Prepping Deal Query";

        //check for price limit
        const priceLimitHtml = priceLimit != 'all' ? 'WHERE price <= ' + priceLimit : '';

        //pull best value and best price for each chain
        //  Simple Deal Query (no items)
        const dealQuery = items.length > 0 ? 
        //  More complex Deal Query (with items, pull everything and then calculate)
            ' SELECT  ' +
            ' 	id, name, price, store_id, chain_id, description, ' +
            ' 	items, options, sizes, value, itemcount, optioncount ' +
            ' FROM deals  ' +
            ' WHERE chain_id IN ( ' + chains.map(chain => chain.chain_id).join(',') + ' ) ' + 
            '    OR store_id IN ( ' + chains.map(chain => chain.store_id).join(',') + ' ) ' : 
            //  Simple Deal Query (no items)
            ' SELECT  ' +
            ' 	id, name, price, store_id, chain_id, description, ' +
            ' 	items, options, sizes, value, itemcount, optioncount ' +
            ' FROM deals  ' +
            ' WHERE id IN ( ' +
            ' 	SELECT * FROM ( ' +
            ' 		SELECT DISTINCT ON (chain_id) id FROM deals ' +
                    priceLimitHtml + 
            ' 		ORDER BY chain_id, value DESC, id ' +
            ' 	) vl ' +
            ' 	UNION ' +
            ' 	SELECT * FROM ( ' +
            ' 		SELECT DISTINCT ON (chain_id) id FROM deals ' +
                    priceLimitHtml + 
            ' 		ORDER BY chain_id, price, id ' +
            ' 	) pr ' +
            ' ) ';
        
        step = "Running Deal Query: " + dealQuery;
        const dealResults = await(await db.query(dealQuery, [])).rows;
        if (dealResults.length == 0){
            //quick exit if no results
            return [];
        }

        step = "Parsing Deal Response";
        //pull items and options to add to deals
        const itemIDs = [];
        const optionIDs = [];
        const sizeIDs = [];
        dealResults.forEach(deal => {
            deal.items.forEach(item => {
                if (!itemIDs.includes(item)){
                    itemIDs.push(item);
                }
            });
            deal.options.forEach(option => {
                if (option && !optionIDs.includes(option)){
                    optionIDs.push(option);
                }
            });
            deal.sizes.forEach(size => {
                if (size && !sizeIDs.includes(size)){
                    sizeIDs.push(size);
                }
            });
        });
        step = "Getting Item Names";
        let itemNames = [];
        if (itemIDs.length > 0){
            itemNames = await(await db.query(" SELECT " + 
            " id, name FROM items WHERE id IN ( " + itemIDs.join(",") + " )", [])).rows;
        }
        step = "Getting Option Names";
        let optionNames = [];
        if (optionIDs.length > 0){
            optionNames = await(await db.query(" SELECT " + 
            " id, name FROM options WHERE id IN ( " + optionIDs.join(",") + " )", [])).rows;
        }
        step = "Getting Size Names";
        let sizeNames = [];
        if (sizeIDs.length > 0){
            sizeNames = await(await db.query(" SELECT " + 
            " id, name FROM sizes WHERE id IN ( " + sizeIDs.join(",") + " )", [])).rows;
        }

        step = "Mapping Deal Results";
        let chainOutput = chains.map(chain => {
            const dealsForThisChain = dealResults.filter(d => d.chain_id == chain.chain_id);
            return {
                name: chain.chain_name,
                distance: chain.distance || 1.0,
                bestprice: getMinObjValue(dealsForThisChain, 'price'),
                bestvalue: getMaxObjValue(dealsForThisChain, 'value'),
                store: { 
                    logo: chain.logo || "pizza.png", 
                    website: chain.website || "#", 
                },
                deals: dealsForThisChain.map(deal => {
                    const items = [];
                    const itemObjs = [];
                    for (let ii = 0; ii < deal.items.length; ii++){
                        const item = itemNames.find(itemNm => Number(itemNm.id) === Number(deal.items[ii]));
                        const itemCount = Number(deal.itemcount[ii]) || 0;
                        const size = sizeNames.find(sizeNm => Number(sizeNm.id) === Number(deal.sizes[ii]));
                        let sizeName = "";
                        if (size){
                            sizeName = size.name + " ";
                        }
                        const option = optionNames.find(optionNm => Number(optionNm.id) === Number(deal.options[ii]));
                        const optionCount = Number(deal.optioncount[ii]) || 0;
        
                        //create item text string
                        let itemText = "";
                        if (itemCount > 0 && item){
                            itemText += itemCount + " " + sizeName + item.name;
                            if (itemCount > 1){
                                itemText += "s"
                            }
                        }
                        if (optionCount > 0 && option){
                            itemText += " with " + optionCount + " " + option.name;
                            if (optionCount > 1){
                                itemText += "s"
                            }
                        }
        
                        if (itemCount + optionCount > 0){
                            items.push(itemText);
                            itemObjs.push({
                                id: item.id,
                                item: item,
                                itemCount: itemCount,
                                size: size, 
                                option: option,
                                optionCount:optionCount,
                                itemText: itemText,
                            })
                        }
                    }

                    return {
                        id: deal.id,
                        dealname: deal.name || "Deal Name",
                        price: deal.price || 0.0,
                        value: deal.value || 1.0,
                        count: 1,
                        items: items,
                        itemObjs: itemObjs,
                    }
                })
            }
        }).filter(c => c.deals.length > 0);

        //Additional calculation and filtering for item search
        step = "Item Filtering";
        if (items.length > 0){
            //console.log('looking for items', items);
            chainOutput = chainOutput.map(chain => {
                //filter deals to ones that contain the item(s) required
                chain.deals = chain.deals.filter(deal => {
                    let hasAllItems = true;
                    items.forEach(itemNeeded => {
                        let hasItem = false;
                        deal.itemObjs.forEach(dealItem => {
                            if (Number(itemNeeded.id) === Number(dealItem.item.id)
                                && (!itemNeeded.sizeId || Number(itemNeeded.sizeId) === Number(dealItem.size.id))
                                && (!itemNeeded.options || itemNeeded.options === dealItem.option.name)
                                && (!itemNeeded.optionCount || Number(itemNeeded.optionCount) <= Number(dealItem.optionCount))){
                                hasItem = true;
                            }
                        });
                        if (!hasItem){
                            hasAllItems = false;
                        }
                    });
                    return hasAllItems;
                });
    
                //calculate how many of each deal would be needed to get the item counts needed
                chain.deals.forEach(deal => {
                    items.forEach(itemNeeded => {
                        deal.itemObjs.forEach(dealItem => {
                            if (Number(itemNeeded.id) === Number(dealItem.item.id)){
                                if (Number(itemNeeded.count) > Number(dealItem.itemCount) * Number(deal.count)){
                                    deal.count = Math.ceil(Number(itemNeeded.count) / Number(dealItem.itemCount));
                                }
                            }
                        });
                    });
                });
                
                //if there is a price limit, filter based on total price
                if (priceLimit != 'all'){
                    chain.deals = chain.deals.filter(deal => {
                        return Number(deal.price) * deal.count <= Number(priceLimit);
                    });
                }
                

                //find best value and best price
                const bestValue = {id: 0, value: 0}
                const bestPrice = {id: 0, price: 9999999}
                chain.deals.forEach(deal => {
                    if (Number(deal.value) > bestValue.value){
                        bestValue.value = Number(deal.value);
                        bestValue.id = deal.id;
                    }
    
                    if (Number(deal.count) * Number(deal.price) < bestPrice.price){
                        bestPrice.price = Number(deal.count) * Number(deal.price);
                        bestPrice.id = deal.id;
                    }
                });
    
                //filter deals to bestValue and bestPrice
                chain.deals = chain.deals.filter(deal => deal.id === bestValue.id || deal.id === bestPrice.id);
                chain.bestprice = bestPrice.price;
                chain.bestvalue = bestValue.value;
                
                return chain;
            });
            chainOutput = chainOutput.filter(chain => chain.deals.length > 0);
        }
        
        return chainOutput;
    } catch (error){
        console.log("Get Deals Error", error);
        console.log("Get Deals Step", step);
        return [];
    }
    
};