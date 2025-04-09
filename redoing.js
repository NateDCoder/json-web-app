import fs from "fs";
import path from "path"


const apiUrl = "https://ftc-api.firstinspires.org/v2.0/"; // Replace with the actual endpoint
const writeJson = (filePath, data) => {
  const dir = path.dirname(filePath);  // Get the directory path from the file path

  // Ensure the directory exists (it will be created if it doesn't)
  fs.mkdirSync(dir, { recursive: true });

  // Now write the file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

await generateYearData(2019)

async function generateYearData(year) {
  const yearData = {};
  const teams = await generateListOfTeams(year);
  const events = await generateListOfEvents(year);
  yearData["teams"] = teams;
  yearData["events"] = events;
  yearData["gameInfo"] = { week1Average: null, week1STD: null };
  writeJson(`${year}/yearData.json`, yearData);
}

async function generateListOfEvents(year) {
  const allEvents = (await callApiRequest(`${apiUrl}${year}/events`)).events;
  var events = [];
  for (var event of allEvents) {
    if (event.stateprov == "MI" && event.country == "USA") {
      var noDataForEvent = (await callApiRequest(`${apiUrl}${year}/teams?eventCode=${event.code}`)).teams.length==0;
      if (noDataForEvent) continue;
      events.push({ code: event.code, dateStart: event.dateStart });
    }
  }
  events.sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart));
  return events;
}

async function generateListOfTeams(year) {
  const numberOfPages = (
    await callApiRequest(`${apiUrl}${year}/teams?state=MI`)
  ).pageTotal;

  var teams = [];
  for (let page = 1; page <= numberOfPages; page++) {
    const data = await callApiRequest(
      `${apiUrl}${year}/teams?state=MI&page=${page}`
    );
    for (let team of data.teams) {
      teams.push(team.teamNumber);
    }
    console.log(`Page ${page}`);
  }
  return teams;
}

async function callApiRequest(apiURL) {
  try {
    const response = await fetch(apiURL, {
      method: "GET",
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Response Status:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json(); // parse and return directly
    return data;
  } catch (error) {
    console.error("Error fetching the API:", error);
    return null;
  }
}
