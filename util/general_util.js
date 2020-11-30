//General utilities

const getMinObjValue = (objectArray, field, startingValue = 999999.0) => {
  let finalValue = startingValue;
  if (objectArray.length > 0){
    objectArray.forEach(object => {
      if (object[field]){
        if (object[field] < finalValue){
          finalValue = object[field];
        }
      }
    });
  }

  return finalValue;
}

const getMaxObjValue = (objectArray, field, startingValue = 0.0) => {
  let finalValue = startingValue;
  if (objectArray.length > 0){
    objectArray.forEach(object => {
      if (object[field]){
        if (object[field] > finalValue){
          finalValue = object[field];
        }
      }
    });
  }

  return finalValue;
}


module.exports = {
  getMinObjValue,
  getMaxObjValue, 
}