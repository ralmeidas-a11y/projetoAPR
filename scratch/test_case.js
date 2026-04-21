
const excelDate = 46127.87050925926;
const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
console.log("Date for 46127:", jsDate.toISOString());
