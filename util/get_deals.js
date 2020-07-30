const db = require('../sql/database');
const {getMinMaxLatLon, getDistanceBetweenLatLonsInKM} = require('../util/distancecalcs');

const getStoresWithinRadius = async (lat, lon, range, delivery) => {
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
    })

    return storeOutput.sort((a, b) => a.distance >= b.distance ? 1 : -1);
}

module.exports = async (lat = 42.922551, lon = -81.19804, range = 25, dealCriteria = [], orderby = '', limit = 0, delivery = false) => {
    let step = "START";
    try{
        //get stores
        const stores = await getStoresWithinRadius(lat, lon, range, delivery);
        
        step = "Parsing Stores";
        //get store and chain IDs
        const chainIDs = [];
        const storeIDs = [];
        stores.forEach(store => {
            if (!chainIDs.includes(store.chain_id)){
                chainIDs.push(store.chain_id);
            }
            if (!storeIDs.includes(store.store_id)){
                storeIDs.push(store.store_id);
            }
        })
        
        step = "Generating Deal Criteria";
        if (chainIDs.length > 0 && storeIDs.length > 0){
            dealCriteria.unshift("(store_id IN ( " + storeIDs.join(',') + " ) " + 
                            " OR chain_id IN ( " + chainIDs.join(',') + " ))");
        } else if (storeIDs.length > 0){
            dealCriteria.unshift("store_id IN ( " + storeIDs.join(',') + " )");
        } else if (chainIDs.length > 0){
            dealCriteria.unshift("chain_id IN ( " + chainIDs.join(',') + " )");
        }
        
        step = "Prepping Deal Query";
        //pull top 10 deals in area based on value
        let dealQuery = "SELECT " + 
            " id, name, price, store_id, chain_id, description, " + 
            " items, options, sizes, value, itemcount, optioncount " + 
            " FROM deals " + 
            " WHERE " + dealCriteria.join(" AND ");
        if (orderby != ''){
            dealQuery += ' ORDER BY ' + orderby;
        }
        if (limit > 0){
            dealQuery += ' LIMIT ' + limit;
        }

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
        const dealOutput = dealResults.map(deal => {
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
            let store = {};
            if (deal.store_id && deal.store_id != 0){
                store = stores.find(str => Number(str.store_id) === Number(deal.store_id));
            } else {
                store = stores.find(str => Number(str.chain_id) === Number(deal.chain_id));
            }
            if (!store){
                store = {};
            }

            return {
                logo: store.logo || "pizza.png",
                website: store.website || "#",
                dealname: deal.name || "Deal Name",
                description: deal.description || "",
                price: deal.price || 0.0,
                value: deal.value || 1.0,
                distance: store.distance || 1.0,
                items: items,
                itemObjs: itemObjs,
            }
        })

        return dealOutput;
    } catch (error){
        console.log("Get Deals Error", error);
        console.log("Get Deals Step", step);
        return [];
    }
    
};