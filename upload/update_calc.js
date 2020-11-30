// Utility to update the value calculations in the db
const db = require('../sql/database');

module.exports = async () => {
    // Pull all of the current deals, sizes, and options
    const allDeals = await(await db.query(' SELECT id, price, items, options, sizes, itemcount, optioncount FROM deals ', [])).rows;
    
    // Loop through deals, gathering total price, and item and option counts.
    const items = {};
    let grandTotal = 0;
    allDeals.forEach(deal => {
        const dealPrice = Number(deal.price);
        grandTotal += dealPrice;
        let itemTotalCount = 0;
        deal.itemcount.forEach(count => {
            itemTotalCount += count;
        })

        for (let i = 0; i < deal.items.length; i++){
            const itemString = deal.items[i] + '|' + deal.sizes[i] + '|' + deal.options[i] + '|' + deal.optioncount[i];
            if (items[itemString]){
                items[itemString].multPrice += dealPrice * (Number(deal.itemcount[i]) / itemTotalCount);
                items[itemString].multCount += Number(deal.itemcount[i]);
            } else {
                items[itemString] = {
                    id: deal.items[i],
                    size: deal.sizes[i],
                    option: deal.options[i],
                    optioncount: deal.optioncount[i],
                    multPrice: dealPrice * (Number(deal.itemcount[i]) / itemTotalCount),
                    multCount: Number(deal.itemcount[i]),
                }
            }
        }
    });

    // Divide total price across sizes and options based on counts and Multi-totals
    const itemComboPrices = {};
    Object.keys(items).forEach(itemCombo => {
        itemComboPrices[itemCombo] = (items[itemCombo].multPrice / items[itemCombo].multCount);
    });
    

    // Calculate value for each deal
    // find min/max calcPricePct to determine 1 star and 5 star
    let minCalcPricePct = 100;
    let maxCalcPricePct = 0;
    let dealValues = [];
    allDeals.forEach(deal => {
        let calcPrice = 0;
        for (let i = 0; i < deal.items.length; i++){
            const itemString = deal.items[i] + '|' + deal.sizes[i] + '|' + deal.options[i] + '|' + deal.optioncount[i];
            if (itemComboPrices[itemString]){
                calcPrice += itemComboPrices[itemString] * Number(deal.itemcount[i]);
            }
        }

        const calcPricePct = Number(deal.price) / calcPrice;
        if (calcPricePct < minCalcPricePct){
            minCalcPricePct = calcPricePct;
        }
        if (calcPricePct > maxCalcPricePct){
            maxCalcPricePct = calcPricePct;
        }
        
        dealValues.push({
            id: deal.id,
            price: Number(deal.price),
            calcPrice: calcPrice,
            calcPricePct: calcPricePct,
        });
    });

    // Calculate value between 1 and 5
    const rangeCalcPricePct = maxCalcPricePct - minCalcPricePct;
    dealValues = dealValues.map(deal => {
        const calcPriceRangePct = (deal.calcPricePct - minCalcPricePct) / rangeCalcPricePct;
        deal['value'] = (calcPriceRangePct * -4.0) + 5.0; //pct * negative range plus maximum to invert the percentage

        return deal;
    });
    
    // update the deals value in the db
    dealValues.forEach(async deal => {
        console.log('updating deal ' + deal.id + ' with value ' + deal.value);
        const updateQuery = ' UPDATE deals SET value = ' + deal.value + ' WHERE id = ' + deal.id + '; SELECT value FROM deals WHERE id = ' + deal.id;
        const updateDeals = await(await db.query(updateQuery, [])).rows;
    });
    console.log("Update Exit - DB CLose");
    db.close();

    return 'Database Calculations updated successfully.';
}
