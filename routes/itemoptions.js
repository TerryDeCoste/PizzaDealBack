const db = require('../sql/database');

module.exports = async (req, res, next) => {
    //get all items
    let {rows, rowCount} = await db.query(" SELECT id, name, avg_price FROM items ", []);
    const itemRows = rows;
    if (rowCount > 0){
        //get all sizes and options
        const sizes = await(await db.query(" SELECT id, name, avg_price, item_id FROM sizes ", [])).rows;
        const options = await(await db.query(" SELECT id, name, avg_price, item_id FROM options ", [])).rows;

        //transform data to items
        const items = itemRows.map(row => {
            let sizesFilter = sizes.filter(size => size.item_id === row.id).map(size => ({
                id: Number(size.id),
                size: size.name,
                display: size.name,
                avgprice: size.avg_price,
            }));
            //set default if no sizes
            if (sizesFilter.length == 0){
                sizesFilter = [{
                    id: 0,
                    size: '------',
                    display: '------',
                    avgprice: 0.00,
                }]
            }
            let optionsFilter = options.filter(option => option.item_id === row.id).map(option => ({
                option: option.name,
                display: option.name,
                avgprice: option.avg_price,
            }));
            if (optionsFilter.length == 0){
                optionsFilter = [{
                    option: 0,
                    display: '------',
                    avgprice: 0.00,
                }]
            }
            
            return {
                id: Number(row.id),
                name: row.name,
                avg_price: row.avg_price,
                sizes: sizesFilter,
                options: optionsFilter,
            }
        })

        return res.status(200).json({
            items: items,
        });
    }
    return res.status(500).json('No Items Found');
};