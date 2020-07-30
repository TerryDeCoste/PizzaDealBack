const Axios = require('axios');
const httpAdapter = require("axios/lib/adapters/http");

const axios = Axios.create({
    adapter: httpAdapter,
    // Other options
  });

const geoCode = (location) => {
    return axios({
        "method":"GET",
        "url":"https://trueway-geocoding.p.rapidapi.com/Geocode",
        "headers":{
        "content-type":"application/octet-stream",
        "x-rapidapi-host":"trueway-geocoding.p.rapidapi.com",
        "x-rapidapi-key":"4f4cb76325msh52ac930f98b9fd0p1a1049jsn6d1dbfef25fe",
        "useQueryString":true
        },"params":{
            "language":"en",
            "country":"CA",
            "address":location.searchString,
        }
        })
        .then((response)=>{
            const resdata = response.data.results[0]
            
            location.latitude = resdata.location.lat;
            location.longitude = resdata.location.lng;
            location.city = resdata.locality;
            location.province = resdata.region;

            return location;
        })
        .catch((error)=>{
            console.log(error);
            return null;
        })
}

const reverseGeoCode = (location) => {
    return axios({
        "method":"GET",
        "url":"https://trueway-geocoding.p.rapidapi.com/ReverseGeocode",
        "headers":{
        "content-type":"application/octet-stream",
        "x-rapidapi-host":"trueway-geocoding.p.rapidapi.com",
        "x-rapidapi-key":"4f4cb76325msh52ac930f98b9fd0p1a1049jsn6d1dbfef25fe",
        "useQueryString":true
        },"params":{
            "language":"en",
            "location":"" + location.latitude + "%2C" + location.longitude
        }
        })
        .then((response)=>{
            const resdata = response.data.results[0];
            
            //return transformed response
            location.city = resdata.locality;
            location.province = resdata.region;
            location.searchString = location.city + ", " + location.province;

            return location;
        })
        .catch((error)=>{
            console.log(error);
            return null;
        })
}

module.exports = (req, res, next) => {
    //default test data
    const {searchType, searchString, searchLat, searchLon} = req.body;
    
    const location = {
        city: '',
        province: '',
        searchString: '',
        latitude: 0.0,
        longitude: 0.0,
    }

    if (searchType == 'text'){
        location.searchString = searchString;
        
        geoCode(location).then(loc => {
            return res.status(200).json(loc);
        })
    } else if (searchType == 'latlon'){
        location.latitude = searchLat;
        location.longitude = searchLon;
        
        reverseGeoCode(location).then(loc => {
            return res.status(200).json(loc);
        })
    }
};


