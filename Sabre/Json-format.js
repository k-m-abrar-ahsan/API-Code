require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const BEARER_TOKEN = process.env.GDS_AUTH_TOKEN;
const PCC = process.env.GDS_PCC;
const BASE_URL = 'https://api.cert.platform.sabre.com/';

function parseFlightData(sabreResponse) {
  const simplifiedFlights = [];
  const responseData = sabreResponse?.groupedItineraryResponse;

  // ✅ THIS IS THE SAFETY CHECK THAT PREVENTS THE CRASH
  // If the response is missing any of these critical arrays, exit gracefully.
  if (!responseData || !responseData.legDescs || !responseData.scheduleDescs || !responseData.itineraryGroups) {
    console.log("Sabre's response was successful but did not contain the necessary flight data structures.");
    return simplifiedFlights;
  }

  const legDescs = responseData.legDescs.reduce(
    (acc, curr) => ({ ...acc, [curr.id]: curr }),
    {}
  );
  const scheduleDescs = responseData.scheduleDescs.reduce(
    (acc, curr) => ({ ...acc, [curr.id]: curr }),
    {}
  );

  if (responseData.itineraryGroups.length === 0) {
    console.log("No itineraries found in the response.");
    return simplifiedFlights;
  }

  responseData.itineraryGroups[0]?.itineraries?.forEach(itinerary => {
    try {
      const legRef = itinerary.legs[0]?.ref;
      const leg = legDescs[legRef];
      if (!leg) return;

      const scheduleRef = leg.schedules[0]?.ref;
      const flightSegment = scheduleDescs[scheduleRef];
      if (!flightSegment) return;

      const airlineCode = flightSegment.carrier?.operating || "N/A";
      const flightNumber = flightSegment.carrier?.marketingFlightNumber || "N/A";
      const cabinCode =
        itinerary.pricingInformation?.[0]?.fare?.passengerInfoList?.[0]?.passengerInfo?.fareComponents?.[0]?.segments?.[0]?.segment?.cabinCode || 'N/A';
      const totalPrice =
        itinerary.pricingInformation?.[0]?.fare?.totalFare?.totalPrice || 0;
      const currency =
        itinerary.pricingInformation?.[0]?.fare?.totalFare?.currency || 'USD';

      simplifiedFlights.push({
        airline: airlineCode,
        flightNumber,
        seatClass: cabinCode,
        price: `${totalPrice} ${currency}`,
      });
    } catch (e) {
      console.warn("Could not parse one of the itineraries, skipping.");
    }
  });

  return simplifiedFlights;
}

async function searchFlights() {
  if (!BEARER_TOKEN || !PCC) {
    console.error("Error: GDS_AUTH_TOKEN and GDS_PCC must be set in your .env file.");
    return;
  }

  const origin = "DAC";
  const destination = "LHR";
  const departureDate = "2025-11-20T09:00:00"; // Using a valid future date

  console.log(`Searching for flights from ${origin} to ${destination} on ${departureDate}...`);

  const searchPayload = { "OTA_AirLowFareSearchRQ": { "Version": "6.8.0", "POS": { "Source": [{ "PseudoCityCode": PCC, "RequestorID": { "Type": "1", "ID": "1", "CompanyName": { "Code": "TN" } } }] }, "OriginDestinationInformation": [{ "DepartureDateTime": departureDate, "OriginLocation": { "LocationCode": origin }, "DestinationLocation": { "LocationCode": destination } }], "TravelerInfoSummary": { "AirTravelerAvail": [{ "PassengerTypeQuantity": [{ "Code": "ADT", "Quantity": 1 }] }] }, "TPA_Extensions": { "IntelliSellTransaction": { "RequestType": { "Name": "50ITINS" } } } }, "mode": "live" };

  try {
    const response = await axios.post(
      `${BASE_URL}v5/offers/shop`,
      searchPayload,
      { headers: { 'Content-Type': 'application/json', 'Authorization': BEARER_TOKEN }, timeout: 30000 }
    );

    const flightResults = parseFlightData(response.data);
    
    if (flightResults.length > 0) {
      const jsonData = JSON.stringify(flightResults, null, 2);
      fs.writeFileSync('flights.json', jsonData);
      console.log("\n✅ Success! Flight data has been saved to flights.json");
    } else {
      console.log("\nNo flight options could be parsed from the response.");
    }

  } catch (error) {
    console.error("\n❌ API Call Failed! ❌");
    console.error("=======================");
    if (error.response) {
      console.error("Error Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
  }
}

searchFlights();
