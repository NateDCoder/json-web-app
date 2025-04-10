import fs from "fs";
import path from "path";
import { getStats, eloToEPA } from "./util.js";

const apiUrl = "https://ftc-api.firstinspires.org/v2.0/";
const writeJson = (filePath, data) => {
    const dir = path.dirname(filePath);

    // Ensure the directory exists (it will be created if it doesn't)
    fs.mkdirSync(dir, { recursive: true });

    // Now write the file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};
const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf-8"));

// await generateYearData(2019)
await calculateAverageAndSTD(2019, ["19MIQT10", "19MIQT11", "19MIQT12", "19MIQT8", "19MIQT9"]);
// await createTeamData(2019);

async function createTeamData(year) {
    const data = readJson(`${year}/yearData.json`);
    const teamList = data.teams;
    const week1Average = data.gameInfo.week1Average;
    const week1STD = data.gameInfo.week1STD;
    for (let teamNumber of teamList) {
        var teamStartingData = {};
        teamStartingData["wins"] = 0;
        teamStartingData["loss"] = 0;
        teamStartingData["draws"] = 0;
        if (fs.existsSync(`${year - 1}/teams/${teamNumber}.json`)) {
            var lastYearData = readJson(`${year - 1}/${teamNumber}.json`);
            teamStartingData["elo"] = lastYearData.elo;
        } else {
            teamStartingData["elo"] = Math.random() * 2000;
        }
        teamStartingData["stateRank"] = null;
        if (week1Average == null) {
            teamStartingData["totalEPA"] = 0;
        } else {
            teamStartingData["totalEPA"] = eloToEPA(
                teamStartingData["elo"],
                week1Average,
                week1STD
            );
        }

        writeJson(`${year}/teams/${teamNumber}.json`, teamStartingData);
    }
}
async function calculateAverageAndSTD(year, eventCodes) {
    var matchScores = [];
    for (let eventCode of eventCodes) {
        const matches = await callApiRequest(`${apiUrl}${year}/schedule/${eventCode}/qual/hybrid`);
        writeJson("exampe match.json", matches);
        for (let match of matches.schedule) {
            matchScores.push(match.scoreRedFinal - match.scoreRedFoul);
            matchScores.push(match.scoreBlueFinal - match.scoreBlueFoul);
        }
    }
    matchScores.sort((a, b) => a - b);
    var eventStats = getStats(matchScores);
    console.log("EventCode Stats", eventStats);
    let rangeCount = [];
    for (let matchScore of matchScores) {
        let index = Math.floor(matchScore / (eventStats.std/4));
        if (!rangeCount[index]) {
            rangeCount[index] = 1;
        } else {
            rangeCount[index]++;
        }
    }
    rangeCount.map((val, index) => console.log(index + "\t" + val));
    const output = rangeCount.map((val, index) => `${index}\t${val}`).join("\n");

    fs.writeFileSync("output.txt", output);
}

async function generateYearData(year) {
    const yearData = {};
    const teams = await generateListOfTeams(year);
    const events = await generateListOfEvents(year);
    yearData["teams"] = teams;
    yearData["events"] = events;
    yearData["gameInfo"] = { week1Average: null, week1STD: null, averageEPA: null, EPA_STD: null };
    writeJson(`${year}/yearData.json`, yearData);
}

async function generateListOfEvents(year) {
    const allEvents = (await callApiRequest(`${apiUrl}${year}/events`)).events;
    var events = [];
    for (var event of allEvents) {
        if (event.stateprov == "MI" && event.country == "USA") {
            var noDataForEvent =
                (await callApiRequest(`${apiUrl}${year}/teams?eventCode=${event.code}`)).teams
                    .length == 0;
            if (noDataForEvent) continue;
            events.push({ code: event.code, dateStart: event.dateStart });
        }
    }
    events.sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart));
    return events;
}

async function generateListOfTeams(year) {
    const numberOfPages = (await callApiRequest(`${apiUrl}${year}/teams?state=MI`)).pageTotal;

    var teams = [];
    for (let page = 1; page <= numberOfPages; page++) {
        const data = await callApiRequest(`${apiUrl}${year}/teams?state=MI&page=${page}`);
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
