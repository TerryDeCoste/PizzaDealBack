const getMinMaxLatLon = (lat, lon, kmRange) => {
    const outLatLons = {
        lats: { min: -90, max: 90 },
        lons: { min: -180, max: 180 },
    };

    //1 degree of latitude is equal to 111km
    if (lat - ( kmRange / 111.0 ) > outLatLons.lats.min){
        outLatLons.lats.min = lat - ( kmRange / 111.0 );
    }
    if (lat + ( kmRange / 111.0 ) < outLatLons.lats.max){
        outLatLons.lats.max = lat + ( kmRange / 111.0 );
    }

    //1 degree of longitude is equal to 111km at the equator
    if (lon - ( kmRange / 111.0 ) > outLatLons.lons.min){
        outLatLons.lons.min = lon - ( kmRange / 111.0 );
    }
    if (lon + ( kmRange / 111.0 ) < outLatLons.lons.max){
        outLatLons.lons.max = lon + ( kmRange / 111.0 );
    }

    return outLatLons;
}

const getDistanceBetweenLatLonsInKM = (latOne, lonOne, latTwo, lonTwo) => {
    //Below code gathered from https://www.codeproject.com/Articles/12269/Distance-between-locations-using-latitude-and-long  - Feb 01, 2018
    // The Haversine formula according to Dr. Math.
    //     http://mathforum.org/library/drmath/view/51879.html

    //     dlon = lon2 - lon1
    //     dlat = lat2 - lat1
    //     a = (sin(dlat/2))^2 + cos(lat1) * cos(lat2) * (sin(dlon/2))^2
    //     c = 2 * atan2(sqrt(a), sqrt(1-a)) 
    //     d = R * c

    //     Where
    //         * dlon is the change in longitude
    //         * dlat is the change in latitude
    //         * c is the great circle distance in Radians.
    //         * R is the radius of a spherical Earth.
    //         * The locations of the two points in 
    //             spherical coordinates (longitude and 
    //             latitude) are lon1,lat1 and lon2, lat2.
    
    let dDistance = 0;
    let dLat1InRad = latOne * (Math.PI / 180.0);
    let dLong1InRad = lonOne * (Math.PI / 180.0);
    let dLat2InRad = latTwo * (Math.PI / 180.0);
    let dLong2InRad = lonTwo * (Math.PI / 180.0);

    let dLongitude = dLong2InRad - dLong1InRad;
    let dLatitude = dLat2InRad - dLat1InRad;

    // Intermediate result a.
    let a = Math.pow(Math.sin(dLatitude / 2.0), 2.0) +
                Math.cos(dLat1InRad) * Math.cos(dLat2InRad) *
                Math.pow(Math.sin(dLongitude / 2.0), 2.0);

    // Intermediate result c (great circle distance in Radians).
    let c = 2.0 * Math.asin(Math.sqrt(a));

    // Distance.
    // const kEarthRadiusMiles = 3956.0;
    const kEarthRadiusKms = 6376.5;
    dDistance = kEarthRadiusKms * c;

    return dDistance;
}

const ifLatLonsInDistance = (latOne, lonOne, latTwo, lonTwo, kmRange) => {
    //quick square check
    const {lats, lons} = getMinMaxLatLon(latOne, lonOne, kmRange * 1.1);
    if (latTwo < lats.min || latTwo > lats.max
     || lonTwo < lons.min || lonTwo > lons.max){
        return false
    }

    //more precise circle check
    return getDistanceBetweenLatLonsInKM(latOne, lonOne, latTwo, lonTwo) < kmRange;
}

module.exports = {
    getMinMaxLatLon,
    ifLatLonsInDistance, 
    getDistanceBetweenLatLonsInKM,
}