//Node utility to upload Deals from a csv file
const fs = require('fs');
const parse = require('csv-parse');
const db = require('../sql/database');

// Make sure we got a filename on the command line.
if (process.argv.length < 4) {
    console.log('Usage: node ' + process.argv[1] + ' FILENAME FILETYPE');
    process.exit(1);
}
const fileName = process.argv[2];
const fileType = process.argv[3];

const processDeals = async (dealCsv) => {
try {
    //Loop through data and make list of things to look for
    const toFind = {
        chains: [],
        stores: [],
        items: [],
        sizes: [],
        sizeStrings: [],
        options: [],
        optionStrings: [],
    }

    dealCsv.forEach(deal => {
        if (deal.chain_name && !toFind.chains.includes(deal.chain_name)){
            toFind.chains.push(deal.chain_name);
        }
        if (deal.store_name &&!toFind.stores.includes(deal.store_name)){
            toFind.stores.push(deal.store_name);
        }
        //parse items
        const itemNames = deal.items.split('|');
        for (let i = 0; i < itemNames.length; i++){
            //add item names
            if (itemNames[i] && !toFind.items.includes(itemNames[i])){
                toFind.items.push(itemNames[i]);
            }
            
            //add size
            const sizeString = deal.sizes.split('|')[i] ? deal.sizes.split('|')[i] : null;
            if (sizeString &&!toFind.sizeStrings.includes(sizeString)){
                toFind.sizeStrings.push(sizeString);
            }
            const size = {
                itemName: itemNames[i],
                sizeName: sizeString,
            }
            let sizeExist = false;
            toFind.sizes.forEach(existSize => {
                if (existSize.itemName === size.itemName
                    && existSize.sizeName === size.sizeName){
                    sizeExist = true;
                }
            })
            if (!sizeExist && size.sizeName){
                toFind.sizes.push(size);
            }
            
            //add options
            const optionString = deal.options.split('|')[i] ? deal.options.split('|')[i] : null;
            if (optionString &&!toFind.optionStrings.includes(optionString)){
                toFind.optionStrings.push(optionString);
            }
            const option = {
                itemName: itemNames[i],
                optionName: optionString,
            }
            let optionExist = false;
            toFind.options.forEach(existOption => {
                if (existOption.itemName === option.itemName
                    && existOption.optionName === option.optionName){
                        optionExist = true;
                }
            })
            if (!optionExist && option.optionName){
                toFind.options.push(option);
            }
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
    
    // if chains or stores are missing, throw error
    toFind.chains.forEach(chain => {
        let exist = false;
        chains.forEach(foundChain => {
            if (chain === foundChain.name){
                exist = true;
            }
        });
        if (!exist){
            throw new Error("Missing Chain: " + chain);
        }
    })
    toFind.stores.forEach(store => {
        let exist = false;
        stores.forEach(foundStore => {
            if (store === foundStore.name){
                exist = true;
            }
        });
        if (!exist){
            throw new Error("Missing Store: " + store);
        }
    })

    // find Item IDs, add if missing
    let items = toFind.items.length > 0 
        ? await (await db.query(" SELECT name, id FROM items " + 
            " WHERE name IN ( '" + 
            toFind.items.map(item => (item.replace("'", "''"))).join("', '")
             + "' ) ", [])).rows : null;
    const foundItems = items.map(item => (item.name));
    
    const itemsToAdd = toFind.items.filter(item => (!foundItems.includes(item)));
    if (itemsToAdd.length > 0){
        //get max item ID, then insert new rows
        let itemID = Number(await (await db.query(" SELECT MAX(id) AS max FROM items ", [])).rows[0]['max'] || 0);
        
        itemsToAdd.forEach(async (item) => {
            itemID++;
            await db.query(" INSERT INTO items (id, name) VALUES ($1, $2) ", [itemID, item]);
        })
    }
    
    //get updated items
    items = await (await db.query(" SELECT name, id FROM items " + 
            " WHERE name IN ( '" + 
            toFind.items.map(item => (item.replace("'", "''"))).join("', '")
             + "' ) ", [])).rows || null;

    //find / update sizes
    let sizes = toFind.sizeStrings.length > 0 
        ? await (await db.query(" SELECT name, id, item_id FROM sizes " + 
            " WHERE name IN ( '" + 
            toFind.sizeStrings.map(item => (item.replace("'", "''"))).join("', '")
             + "' ) ", [])).rows : null;
    
    const sizesToAdd = [];
    toFind.sizes.forEach(size => {
        let sizeExist = false;
        let sizeItemId = items.find(item => item.name === size.itemName) ? Number(items.find(item => item.name === size.itemName).id || -1) : -1;
        sizes.forEach(foundSize => {
            if (foundSize.name === size.sizeName
                && Number(foundSize.item_id) === sizeItemId){
                sizeExist = true;
            }
        });
        if (!sizeExist){
            sizesToAdd.push({
                name: size.sizeName,
                item_id: sizeItemId,
            });
        }
    })
    if (sizesToAdd.length > 0){
        //get max item ID, then insert new rows
        let sizeID = Number(await (await db.query(" SELECT MAX(id) AS max FROM sizes ", [])).rows[0]['max'] || 0);
        
        sizesToAdd.forEach(async (size) => {
            sizeID++;
            await db.query(" INSERT INTO sizes (id, name, item_id) VALUES ($1, $2, $3) ", [sizeID, size.name, size.item_id]);
        })
    }
    
    //get updated sizes
    sizes = await (await db.query(" SELECT name, id, item_id FROM sizes " + 
            " WHERE name IN ( '" + 
            toFind.sizeStrings.map(item => (item.replace("'", "''"))).join("', '")
             + "' ) ", [])).rows || null;


    //find / update options
    let options = toFind.optionStrings.length > 0 
        ? await (await db.query(" SELECT name, id, item_id FROM options " + 
            " WHERE name IN ( '" + 
            toFind.optionStrings.map(item => (item.replace("'", "''"))).join("', '")
             + "' ) ", [])).rows : null;
    
    const optionsToAdd = [];
    toFind.options.forEach(option => {
        let optionExist = false;
        let optionItemId = Number(items.find(item => item.name === option.itemName).id || 0);
        options.forEach(foundOption => {
            if (foundOption.name === option.optionName
                && Number(foundOption.item_id) === optionItemId){
                optionExist = true;
            }
        });
        if (!optionExist){
            optionsToAdd.push({
                name: option.optionName,
                item_id: optionItemId,
            });
        }
    })
    if (optionsToAdd.length > 0){
        //get max item ID, then insert new rows
        let optionID = Number(await (await db.query(" SELECT MAX(id) AS max FROM options ", [])).rows[0]['max'] || 0);
        
        optionsToAdd.forEach(async (option) => {
            optionID++;
            await db.query(" INSERT INTO options (id, name, item_id) VALUES ($1, $2, $3) ", [optionID, option.name, option.item_id]);
        })
    }
    
    //get updated options
    options = await (await db.query(" SELECT name, id, item_id FROM options " + 
        " WHERE name IN ( '" + 
        toFind.optionStrings.map(item => (item.replace("'", "''"))).join("', '")
        + "' ) ", [])).rows || null;

    let dealID = Number(await (await db.query(" SELECT MAX(id) AS max FROM deals ", [])).rows[0]['max'] || 0);
    //for each deal record: as a for loop to ensure runs as sync
    for (let i = 0; i < dealCsv.length; i++){
        const deal = dealCsv[i];
        try {
            //verify chain or store
            const chainID = chains ? Number(chains.find(chain => chain.name === deal.chain_name).id || 0) : 0;
            const storeID = stores ? Number(stores.find(store => store.name === deal.store_name).id || 0) : 0;

            //split up items
            const countList = deal.counts.split('|');
            const itemList = deal.items.split('|');
            const sizeList = deal.sizes.split('|');
            const optionList = deal.options.split('|');
            const optionCountList = deal.optioncounts.split('|');

            const itemObjs = [];
            for (let i = 0; i < itemList.length; i++){
                const newItem = {
                    count: Number(countList[i] || 0),
                    itemName: itemList[i],
                    itemId: 0,
                    sizeName: sizeList[i] || null,
                    sizeId: 0,
                    optionName: optionList[i] || null,
                    optionId: 0,
                    optionCount: Number(optionCountList[i] || 0),
                }
                if (newItem.itemName){
                    newItem.itemId = Number(items.find(item => (item.name === newItem.itemName)).id || 0);
                }
                if (newItem.sizeName){
                    newItem.sizeId = Number(sizes.find(size => (size.name === newItem.sizeName)).id || 0);
                }
                if (newItem.optionName){
                    newItem.optionId = Number(options.find(option => (option.name === newItem.optionName)).id || 0);
                }

                itemObjs.push(newItem);
            }
            //create item arrays
            const itemIDs = [];
            const sizeIDs = [];
            const optionIDs = [];
            const itemCount = [];
            const optionCount = [];

            itemObjs.forEach(itemObj => {
                itemIDs.push(itemObj.itemId);
                sizeIDs.push(itemObj.sizeId);
                optionIDs.push(itemObj.optionId);
                itemCount.push (itemObj.count);
                optionCount.push(itemObj.optionCount);
            })

            // console.log("Checking for deal", dealID, deal.name, Number(deal.price), storeID, chainID, deal.description, itemIDs, optionIDs, sizeIDs);

            //check for existing deal
            const existQuery = " SELECT id FROM deals WHERE " + 
                " name = '" + deal.name.replace("'", "''") + "' AND " + 
                " price = " + Number(deal.price) + " AND " + 
                " store_id = " + storeID + " AND " + 
                " chain_id = " + chainID + " AND " + 
                " description = '" + deal.description.replace("'", "''") + "' AND " + 
                " items = '{" + itemIDs.join(',') + "}' AND " + 
                " options = '{" + optionIDs.join(',') + "}' AND " + 
                " sizes = '{" + sizeIDs.join(',') + "}' AND " + 
                " itemcount = '{" + itemCount.join(',') + "}' AND " + 
                " optioncount = '{" + optionCount.join(',') + "}' ";

            const {rows, rowCount} = await db.query(existQuery, []);
            const existDeal = rowCount > 0;
            
            //create and upload deals
            if(!existDeal){
                dealID++;
                const insertQuery = " INSERT INTO deals " + 
                    " (id, name, price, store_id, chain_id, description, items, options, sizes, itemcount, optioncount) " + 
                    " VALUES (" + dealID + 
                    ", '" + deal.name.replace("'", "''") + 
                    "', " + Number(deal.price) + 
                    ", " + storeID + 
                    ", " + chainID + 
                    ", '" + deal.description.replace("'", "''") + 
                    "', '{" + itemIDs.join(',') + "}" + 
                    "', '{" + optionIDs.join(',') + "}" + 
                    "', '{" + sizeIDs.join(',') + "}" + 
                    "', '{" + itemCount.join(',') + "}" + 
                    "', '{" + optionCount.join(',') + "}') ";

                try{
                    await db.query(insertQuery, []);
                    console.log("Inserted", deal.name);
                } catch (error) {
                    console.log("Insert Error", error);
                }
            }
        } catch (err) {
            console.log("dealAdd Error", err);
        }
    }
    console.log("FOREACH EXIT");
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
    for (let i = 0; i < chainCsv.length; i++){
        const chain = chainCsv[i];
        if (!chainList.includes(chain.name)){
            currentChainID++;
            
            const insertQuery = " INSERT INTO chains (id, name, logo, website) " + 
            " VALUES (" + currentChainID + "," + 
            " '" + chain.name + "'," + 
            " '" + chain.logo + "'," + 
            " '" + chain.website + "') ";

            try {
                await db.query(insertQuery, []);
            } catch (error) {
                console.log('insert error', error);
            }
        }
    }
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
            " '" + store.name + "'," + 
            " " + chainId + "," + 
            " '" + store.address + "'," + 
            " " + store.lat + "," + 
            " " + store.lon + "," + 
            " " + store.phone + "," + 
            " " + store.delivery + " ) ";

            await db.query(insertQuery, []);
        }
    }
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


