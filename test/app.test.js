const request = require("supertest");
const nock = require("nock");
const app = require("../app");
const db = require("../sql/database");

describe("Test the root path", () => {
  test("It should respond with the home page to the GET method", async () => {
    const response = await request(app).get("/");
    expect(response.statusCode).toBe(200);
    expect(response.text.includes('Find My Pizza Deal')).toBe(true);
  });
});

describe("Path: /providers", () => {
  test("It should respond to a POST request", async () => {
    const response = await request(app).post("/providers");
    expect(response.statusCode).toBe(200);
  });
  test("It should have proper headers", async () => {
    const response = await request(app).post("/providers");
    const firstRow = JSON.parse(response.text)[0];
    expect(firstRow.logo).not.toBeFalsy();
    expect(firstRow.website).not.toBeFalsy();
  });
  test("It should include Gino's Pizza as a test", async () => {
    const response = await request(app).post("/providers");
    const rows = JSON.parse(response.text);
    const gino = rows.find(row => row.logo === 'ginospizza.png');
    expect(gino.logo).toBe('ginospizza.png');
    expect(gino.website).toBe('https://ginospizza.ca/');
  });
});

describe("Path: /topdeals", () => {
  test("It should respond to a POST request", async () => {
    const response = await request(app).post("/topdeals");
    expect(response.statusCode).toBe(200);
  });
  test("It should have proper headers", async () => {
    const response = await request(app).post("/topdeals");
    const firstRow = JSON.parse(response.text)[0];
    expect(firstRow.logo).not.toBeFalsy();
    expect(firstRow.website).not.toBeFalsy();
    expect(firstRow.dealname).not.toBeFalsy();
    expect(firstRow.price).not.toBeFalsy();
    expect(firstRow.value).not.toBeFalsy();
    expect(firstRow.distance).not.toBeFalsy();
    expect(firstRow.items).not.toBeFalsy();
  });
});

describe("Path: /search", () => {
  test("It should respond to a POST request", async () => {
    const response = await request(app).post("/search");
    expect(response.statusCode).toBe(200);
  });
  test("It should have proper headers", async () => {
    const response = await request(app).post("/search");
    const firstRow = JSON.parse(response.text)[0];
    expect(firstRow.logo).not.toBeFalsy();
    expect(firstRow.website).not.toBeFalsy();
    expect(firstRow.dealname).not.toBeFalsy();
    expect(firstRow.price).not.toBeFalsy();
    expect(firstRow.value).not.toBeFalsy();
    expect(firstRow.distance).not.toBeFalsy();
    expect(firstRow.items).not.toBeFalsy();
  });
});

describe("Path: /searchbychain", () => {
  test("It should respond to a POST request", async () => {
    const response = await request(app).post("/searchbychain");
    expect(response.statusCode).toBe(200);
  });
  test("It should have proper headers", async () => {
    const response = await request(app).post("/searchbychain");
    const firstChain = JSON.parse(response.text)[0];
    expect(firstChain.name).not.toBeFalsy();
    expect(firstChain.distance).not.toBeFalsy();
    expect(firstChain.store.logo).not.toBeFalsy();
    expect(firstChain.store.website).not.toBeFalsy();
    expect(firstChain.deals[0].dealname).not.toBeFalsy();
    expect(firstChain.deals[0].price).not.toBeFalsy();
    expect(firstChain.deals[0].value).not.toBeFalsy();
    expect(firstChain.deals[0].items).not.toBeFalsy();
  });
  test("It should search by price", async () => {
    const response = await request(app).post("/searchbychain").send({priceLimit: '10.0'});
    const allChains = JSON.parse(response.text);
    expect(allChains.length).toBeGreaterThan(0);
    allChains.forEach(chain => {
      chain.deals.forEach(deal => {
        expect(deal.price).toBeLessThanOrEqual(10.0);
      });
    });
  });
  test("It should search by item", async () => {
    const itemToFind = {
      calcID: 1,
      id: 1,
      name: 'Pizza',
      size: 'X-Large',
      sizeId: 1,
      options: 'topping',
      count: 2,
      optionCount: 3,
    }
    const response = await request(app).post("/searchbychain").send({items: [itemToFind]});

    const allChains = JSON.parse(response.text);
    expect(allChains.length).toBeGreaterThan(0);
    allChains.forEach(chain => {
      chain.deals.forEach(deal => {
        let itemInDeal = false;
        deal.itemObjs.forEach(dealItem => {
          if (Number(dealItem.item.id) === Number(itemToFind.id)
            && Number(dealItem.size.id) === Number(itemToFind.sizeId)
            && dealItem.option.name === itemToFind.options
            && Number(dealItem.optionCount) >= Number(itemToFind.optionCount)
            && Number(dealItem.itemCount) * Number(deal.count) >= Number(itemToFind.count)){
              itemInDeal = true;
            }
        });
        expect(itemInDeal).toBe(true);
      });
    });
  });
});

describe("Path: /location", () => {
  test("It should respond to a text POST request with proper headers", async () => {
    const mockResponse = { results: [
        {
        address: 'London, ON, Canada',
        country: 'Canada',
        region: 'Ontario',
        area: 'Middlesex County',
        locality: 'London',
        location: { lat: 42.98494, lng: -81.245297 },
        location_type: 'approximate',
        type: 'locality'
        }
      ] 
    }
    nock('https://trueway-geocoding.p.rapidapi.com')
      .persist()
      .get('/Geocode?language=en&country=CA&address=London,+ON')
      .reply(200, mockResponse);
    

    const response = await request(app).post("/location").send({
      searchType: 'text',
      searchString: 'London, ON',
    });
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.text);
    expect(data.city).not.toBeFalsy();
    expect(data.province).not.toBeFalsy();
    expect(data.latitude).not.toBeFalsy();
    expect(data.longitude).not.toBeFalsy();
  });
  test("It should respond to a latlon POST request with proper headers", async () => {
    const mockResponse = { results: [
      {
      address: '980 Green Valley Rd, London, ON N6N 1E3, Canada',
      postal_code: 'N6N 1E3',
      country: 'Canada',
      region: 'Ontario',
      area: 'Middlesex County',
      locality: 'London',
      neighborhood: 'Westminster',
      street: 'Green Valley Road',
      house: '980',
      location: { lat: 42.922551, lng: -81.19804 },
      location_type: 'exact',
      type: 'street_address'
      },
      {
      address: '980 Green Valley Rd, London, ON N6N 1E3, Canada',
      postal_code: 'N6N 1E3',
      country: 'Canada',
      region: 'Ontario',
      area: 'Middlesex County',
      locality: 'London',
      neighborhood: 'Westminster',
      street: 'Green Valley Road',
      house: '980',
      location: { lat: 42.922551, lng: -81.19804 },
      location_type: 'exact',
      type: 'poi'
      },
      {
      address: '982 Green Valley Rd, London, ON N6N 1E3, Canada',
      postal_code: 'N6N 1E3',
      country: 'Canada',
      region: 'Ontario',
      area: 'Middlesex County',
      locality: 'London',
      neighborhood: 'Westminster',
      street: 'Green Valley Road',
      house: '982',
      location: { lat: 42.921466, lng: -81.197734 },
      location_type: 'approximate',
      type: 'street_address'
      },
      {
      address: '955-1063 Green Valley Rd, London, ON N6N 1E3, Canada',
      postal_code: 'N6N 1E3',
      country: 'Canada',
      region: 'Ontario',
      area: 'Middlesex County',
      locality: 'London',
      neighborhood: 'Westminster',
      street: 'Green Valley Road',
      house: '955-1063',
      location: { lat: 42.92141, lng: -81.198246 },
      location_type: 'centroid',
      type: 'route'
      },
      {
      address: 'London, ON N6N 1E3, Canada',
      postal_code: 'N6N 1E3',
      country: 'Canada',
      region: 'Ontario',
      area: 'Middlesex County',
      locality: 'London',
      neighborhood: 'Westminster',
      location: { lat: 42.922676, lng: -81.198873 },
      location_type: 'approximate',
      type: 'postal_code'
      }
    ] 
    }
    nock('https://trueway-geocoding.p.rapidapi.com')
      .persist()
      .get('/ReverseGeocode?language=en&location=42.922551%252C-81.19804')
      .reply(200, mockResponse);

    const response = await request(app).post("/location").send({
      searchType: 'latlon',
      searchLat: 42.922551,
      searchLon: -81.19804,
    });
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.text);
    expect(data.city).not.toBeFalsy();
    expect(data.province).not.toBeFalsy();
    expect(data.latitude).not.toBeFalsy();
    expect(data.longitude).not.toBeFalsy();
  });
});

describe("Path: /itemoptions", () => {
  test("It should respond to a POST request", async () => {
    const response = await request(app).post("/itemoptions");
    expect(response.statusCode).toBe(200);
  });
  test("It should have proper headers", async () => {
    const response = await request(app).post("/itemoptions");
    const firstRow = JSON.parse(response.text).items[0];
    expect(firstRow.id).not.toBeFalsy();
    expect(firstRow.name).not.toBeFalsy();
    expect(firstRow.sizes).not.toBeFalsy();
    expect(firstRow.options).not.toBeFalsy();
  });
  test("It should have the Pizza item", async () => {
    const response = await request(app).post("/itemoptions");
    const rows = JSON.parse(response.text).items;
    const pizza = rows.find(row => row.name === 'Pizza');
    expect(pizza.id).toBe(1);
    expect(pizza.name).toBe('Pizza');
    const medium = pizza.sizes.find(size => size.size === "Medium");
    expect(medium.size).toBe('Medium');
    const toppings = pizza.options.find(option => option.option === 'topping');
    expect(toppings.option).toBe('topping');
  });
  test("It should have the Size and Option defaults when the item has none", async () => {
    const response = await request(app).post("/itemoptions");
    const rows = JSON.parse(response.text).items;
    const dip = rows.find(row => row.name === 'Dip');
    const sizeDefault = dip.sizes.find(size => size.size === "------");
    expect(sizeDefault.id).toBe(0);
    const optionDefault = dip.options.find(option => option.display === '------');
    expect(optionDefault.option).toBe(0);
  });
});

afterAll(async () => {
  db.close();
});