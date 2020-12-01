//Node utility to upload Deals from a csv file to the db
const fs = require('fs');
const parse = require('csv-parse');
const db = require('../sql/database');
const updateCalc = require('./update_calc');

// Make sure we got a filename on the command line.
if (process.argv.length < 4) {
    console.log('Usage: node ' + process.argv[1] + ' FILENAME FILETYPE');
    process.exit(1);
}
const fileName = process.argv[2];
const fileType = process.argv[3];

const processDeals = async (dealCsv) => {
try {
    // create Array Object representation of csv file
    const csvDeals = dealCsv.map(deal => {
        const itemObjs = [];
        
        for (let i = 0; i < deal.items.split('|').length; i++){
            const item = deal.items.split('|')[i] ? deal.items.split('|')[i] : '';
            const size = deal.sizes.split('|')[i] ? deal.sizes.split('|')[i] : '';
            const count = deal.counts.split('|')[i] ? deal.counts.split('|')[i] : '';
            const option = deal.options.split('|')[i] ? deal.options.split('|')[i] : '';
            const optioncount = deal.optioncounts.split('|')[i] ? deal.optioncounts.split('|')[i] : '';

            itemObjs.push({
                item: {id: 0, name: item },
                option: {id: 0, name: option },
                size: {id: 0, name: size },
                count: count,
                optioncount: optioncount,
            })
        }

        return {
            id: 0,
            name: deal.name,
            price: Number(deal.price),
            store_name: deal.store_name,
            store_id: 0,
            chain_name: deal.chain_name,
            chain_id: 0,
            description: deal.description,
            items: [],
            options: [],
            sizes: [],
            itemcount: [],
            optioncount: [],
            itemObjs: itemObjs,
        }
    });
    
    // Load current data from DB
    //   first, check chains and stores
    const chains = await getDBKeyValueObject('chains', 'name', 'id');
    const stores = await getDBKeyValueObject('stores', 'name', 'id');
    
    //    add chain_id and store_id to db, ensure there is at least one
    csvDeals.forEach(deal => {
        if (!chains[deal.chain_name] && !stores[deal.store_name]){
            throw new Error('Store and Chain not in DB: Chain: ' + deal.chain_name + ' Store: ' + deal.store_name);
        }
        deal.chain_id = chains[deal.chain_name] ? chains[deal.chain_name] : 0;
        deal.store_id = stores[deal.store_name] ? stores[deal.store_name] : 0;
    });

    //    load current items, options, sizes
    const items = await getDBKeyValueObject('items', 'name', 'id');
    const options = await getDBMultiKeyValueObject('options', ['name', 'item_id'], 'id');
    const sizes = await getDBMultiKeyValueObject('sizes', ['name', 'item_id'], 'id');
    const deals = await getDBMultiKeyValueObject('deals', ['name', 'price', 'store_id', 'chain_id', 'description', 'items', 'options', 'sizes', 'itemcount', 'optioncount'], 'id');
    const maxItemID = await getDBMaxID('items');
    const maxOptionID = await getDBMaxID('options');
    const maxSizeID = await getDBMaxID('sizes');
    const maxDealID = await getDBMaxID('deals');
    let currItemID = maxItemID;
    let currOptionID = maxOptionID;
    let currSizeID = maxSizeID;
    let currDealID = maxDealID;

    // Add IDs to csvDeals, create objects for anything that needs to be added to db
    csvDeals.forEach(deal => {
        // find/add items
        deal.itemObjs.forEach(itemObj => {
            //add ids to object
            //  itemID
            if (itemObj.item.name){
                if (!items[itemObj.item.name]){
                    currItemID++;
                    items[itemObj.item.name] = currItemID;
                }
                itemObj.item.id = items[itemObj.item.name];
            } 
            //  optionID
            if (itemObj.option.name){
                if (!options[itemObj.option.name + '|' + itemObj.item.id]){
                    currOptionID++;
                    options[itemObj.option.name + '|' + itemObj.item.id] = currOptionID;
                }
                itemObj.option.id = options[itemObj.option.name + '|' + itemObj.item.id];
            }
            //  sizeID
            if (itemObj.size.name){
                if (!sizes[itemObj.size.name + '|' + itemObj.item.id]){
                    currSizeID++;
                    sizes[itemObj.size.name + '|' + itemObj.item.id] = currSizeID;
                }
                itemObj.size.id = sizes[itemObj.size.name + '|' + itemObj.item.id];
            }

            //add IDs to deal item arrays
            deal.items.push(itemObj.item.id);
            deal.options.push(itemObj.option.id ? itemObj.option.id : 0);
            deal.sizes.push(itemObj.size.id ? itemObj.size.id : 0);
            deal.itemcount.push(itemObj.count ? itemObj.count : 0);
            deal.optioncount.push(itemObj.optioncount ? itemObj.optioncount : 0);
        });

        // find/add deal
        const dealKey = deal.name + '|' + deal.price + '|' + deal.store_id + '|' + deal.chain_id + '|' + deal.description + '|' + deal.items + '|' + deal.options + '|' + deal.sizes + '|' + deal.itemcount + '|' + deal.optioncount;
        if (!deals[dealKey]){
            currDealID++;
            deals[dealKey] = currDealID;
        }
        deal.id = deals[dealKey];
    });

    // Add needed rows to db
    const insertQueries = []
    Object.keys(items).forEach(async (key) => {
        if (items[key] > maxItemID){
            insertQueries.push(" INSERT INTO items (id, name) VALUES (" + items[key] + ", '" + key.replace("'", "''") + "') ");
        }
    });
    Object.keys(options).forEach(async (key) => {
        if (options[key] > maxOptionID){
            const [name, itemId] = key.split('|');
            insertQueries.push(" INSERT INTO options (id, name, item_id) VALUES (" + options[key] + ", '" + name.replace("'", "''") + "', " + itemId + ") ");
        }
    });
    Object.keys(sizes).forEach(async (key) => {
        if (sizes[key] > maxSizeID){
            const [name, itemId] = key.split('|');
            insertQueries.push(" INSERT INTO sizes (id, name, item_id) VALUES (" + sizes[key] + ", '" + name.replace("'", "''") + "', " + itemId + ") ");
        }
    });
    Object.keys(deals).forEach(async (key) => {
        if (deals[key] > maxDealID){
            const [name, price, store_id, chain_id, description, items, options, sizes, itemcount, optioncount] = key.split('|');
            const insertQuery = " INSERT INTO " + 
            " deals (id, name, price, store_id, chain_id, description, items, options, sizes, value, itemcount, optioncount) " + 
            " VALUES (" + deals[key] + ", '" + name.replace("'", "''") + "', " + price + ", " + store_id + ", " + chain_id + ", '" + 
            description.replace("'", "''") + "', " + "array[" + items + "], array[" + options + "], array[" + sizes + "], " + 
            1 + ", array[" + itemcount + "], array[" + optioncount + "]) RETURNING id ";

            insertQueries.push(insertQuery);
        }
    });
    
    let rowsAdded = 0;
    const promises = insertQueries.map(query => new Promise(async(resolve, reject) => {
        try{
            await(await db.query(query, []));
            rowsAdded++;
            resolve();
        } catch (error) {
            reject();
        }
    }));
    
    await Promise.all(promises).catch(err => console.log(err));

    console.log("Process Complete: " + insertQueries.length + " rows added");
} catch (error){
    console.log("Process ERROR", error);
}}

const procssChains = async (chainCsv) => {
try {
    //Loop through data and make list of things to look for
    const toFind = {
        chains: [],
    }

    chainCsv.forEach(chain => {
        if (chain.name && !toFind.chains.includes(chain.name)){
            toFind.chains.push(chain.name);
        }
    })
    
    //Get current data: 
    const chains = toFind.chains.length > 0 
        ? await (await db.query(" SELECT name, id FROM chains " + 
            " WHERE name IN ( '" + 
            toFind.chains.map(chain => (chain.replace("'", "''"))).join("', '")
             + "' ) ", [])).rows : null;
    const chainList = chains ? chains.map(chain => chain.name) : [];

    const maxChainID = await (await db.query(" SELECT MAX(id) AS maxid FROM chains ", [])).rows;
    let currentChainID = maxChainID[0]['maxid'] || 0;
    
    //insert missing chains
    let chainsAdded = 0;
    for (let i = 0; i < chainCsv.length; i++){
        const chain = chainCsv[i];
        if (!chainList.includes(chain.name)){
            currentChainID++;
            
            const insertQuery = " INSERT INTO chains (id, name, logo, website) " + 
            " VALUES (" + currentChainID + "," + 
            " '" + chain.name.replace("'", "''") + "'," + 
            " '" + chain.logo.replace("'", "''") + "'," + 
            " '" + chain.website.replace("'", "''") + "') ";

            try {
                await db.query(insertQuery, []);
                chainsAdded++;
            } catch (error) {
                console.log('insert error', error);
            }
        }
    }
    console.log("Process Complete: " + chainsAdded + " chains added.");
} catch (error){
    console.log("Chains ERROR", error);
}}

const processStores = async (storeCsv) => {
try {
    //Loop through data and make list of things to look for
    const toFind = {
        chains: [],
        stores: [],
    }

    storeCsv.forEach(store => {
        if (store.chain_name && !toFind.chains.includes(store.chain_name)){
            toFind.chains.push(store.chain_name);
        }
    })
    
    //Get current data: 
    const chains = toFind.chains.length > 0 
        ? await (await db.query(" SELECT name, id FROM chains " + 
            " WHERE name IN ( '" + 
            toFind.chains.map(chain => (chain.replace("'", "''"))).join("', '")
                + "' ) ", [])).rows : null;
    const stores = toFind.stores.length > 0 
        ? await (await db.query(" SELECT name, id FROM stores " + 
            " WHERE name IN ( '" + 
            toFind.stores.map(store => (store.replace("'", "''"))).join("', '")
            + "' ) ", [])).rows : null;
    const chainList = chains ? chains.map(chain => chain.name) : [];
    const storeList = stores ? stores.map(store => store.name) : [];

    //if missing chains, throw error
    if (toFind.chains.length > chainList.length){
        throw new Error("Missing chains");
    }

    //get max storeID
    const maxStoreID = await (await db.query(" SELECT MAX(id) AS maxid FROM stores ", [])).rows;
    let currentStoreID = maxStoreID[0]['maxid'] || 0;

    //insert missing stores
    let storesAdded = 0;
    for (let i = 0; i < storeCsv.length; i++) {
        const store = storeCsv[i];
        if (!storeList.includes(store.name)){
            //get chain id
            let chainId = 0;
            chains.forEach(chain => {
                if (chain.name == store.chain_name){
                    chainId = chain.id;
                }
            });

            currentStoreID++;

            const insertQuery = " INSERT INTO stores " + 
            "(id, name, chain_id, address, lat, lon, phone, delivery) " + 
            "VALUES (" + currentStoreID + "," + 
            " '" + store.name.replace("'", "''") + "'," + 
            " " + chainId + "," + 
            " '" + store.address.replace("'", "''") + "'," + 
            " " + store.lat + "," + 
            " " + store.lon + "," + 
            " " + store.phone + "," + 
            " " + store.delivery + " ) ";

            await db.query(insertQuery, []);
            storesAdded++;
        }
    }
    console.log("Process complete: " + storesAdded + " stores added");
} catch (error){
    console.log("Stores ERROR", error);
}}


//load csv file
fs.readFile(fileName, 'utf8', (err, data) => {
    if (err) { throw err; }
    parse(data, { columns: true, }, async (error, output) => {
        if (error) { throw error; }
        
        if (fileType == "deals"){
            await processDeals(output);
            await updateCalc();
        } else if (fileType == "chains"){
            await procssChains(output);
        } else if (fileType == "stores"){
            await processStores(output);
        } else {
            throw new Error("FILETYPE not found");
        }
        console.log("Parse Exit - DB CLose");
        db.close();
    });
});

const getDBKeyValueObject = async (table, keyColumn, valueColumn) => {
    const results = await (await db.query(" SELECT " + keyColumn + ", " + valueColumn + " FROM " + table + " ", [])).rows;
    const keyValueObject = {};
    if (results){
        results.forEach(record => {
            keyValueObject[record[keyColumn]] = record[valueColumn];
        });
    }

    return keyValueObject;
}
const getDBMultiKeyValueObject = async (table, keyColumns, valueColumn, delimiter = '|') => {
    const results = await (await db.query(" SELECT " + keyColumns.join(', ') + ", " + valueColumn + " FROM " + table + " ", [])).rows;
    const keyValueObject = {};
    if (results){
        results.forEach(record => {
            const keyStringArray = keyColumns.map(colName => record[colName]);
            keyValueObject[keyStringArray.join(delimiter)] = record[valueColumn];
        });
    }

    return keyValueObject;
}
const getDBMaxID = async (table, idColumn = 'id') => {
    const maxID = await (await db.query(" SELECT MAX(" + idColumn + ") as max FROM " + table + " ", [])).rows;
    return maxID[0].max ? Number(maxID[0].max) : 0;
}
