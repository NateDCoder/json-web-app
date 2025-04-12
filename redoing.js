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
// await calculateAverageAndSTD(2019, ["19MIQT10", "19MIQT11", "19MIQT12", "19MIQT8", "19MIQT9"]);
// await createTeamData(2019);
await createEventData(2019);

async function createEventData(year) {
    const data = readJson(`${year}/yearData.json`);
    const events = data.events;

    for (let { code: eventCode } of events) {
        const eventData = {};
        const qualSchedule = await callApiRequest(
            `${apiUrl}${year}/schedule/${eventCode}/qual/hybrid`
        );
        const qualMatches = await callApiRequest(`${apiUrl}${year}/scores/${eventCode}/qual/`);

        const rawEventData = await callApiRequest(`${apiUrl}${year}/events?eventCode=${eventCode}`);
        const eventDetails = rawEventData.events[0];
        const teamsData = await callApiRequest(`${apiUrl}${year}/teams?eventCode=${eventCode}`);
        const teamNumbers = getTeamNumbers(teamsData);

        eventData["teams"] = teamNumbers;
        eventData["name"] = eventDetails.name;

        if (qualSchedule.schedule.length == 0) {
            console.log("Hasn't Started Event", eventCode);
            eventData["completed"] = false;
            eventData["ongoing"] = false;
            eventData["breakdown"] = null;
            continue;
        } else if (qualSchedule.schedule.length !== qualMatches.matchScores.length) {
            console.log("Ongoing Event");
            eventData["completed"] = false;
            eventData["ongoing"] = true;
            eventData["breakdown"] = null;
            continue;
        } else {
            console.log("Completed Event");
            eventData["completed"] = true;
            eventData["ongoing"] = false;
            eventData["breakdown"] = null;
            updateEPA(year, eventCode, qualMatches.matchScores, qualSchedule.schedule);
        }
        writeJson(`${year}/events/${eventCode}/${eventCode}.json`, eventData);
        break;
    }
}

function updateEPA(year, eventCode, matches, schedule) {
    for (let i = 0; i < 1; i++) {
        let match = matches[i];
        let matchTeams = schedule[i].teams;
        let matchName = schedule[i].description;

        const colorData = getColorData(matchTeams);
        const redTeams = colorData.redTeams;
        const blueTeams = colorData.blueTeams;
        const surrogates = colorData.surrogates;

        const pointBreakdown = getPointBreakdown(match.alliances);
        const redData = pointBreakdown.redData;
        const blueData = pointBreakdown.blueData;

        var redTeamsData = getTeamData(year, redTeams);
        var blueTeamsData = getTeamData(year, blueTeams);

        const redEPA = redTeamsData.reduce((sum, obj) => sum + (obj.totalEPA || 0), 0);
        const blueEPA = blueTeamsData.reduce((sum, obj) => sum + (obj.totalEPA || 0), 0);

        const redAutonEPA = redTeamsData.reduce((sum, obj) => sum + (obj.autonEPA || 0), 0);
        const blueAutonEPA = blueTeamsData.reduce((sum, obj) => sum + (obj.autonEPA || 0), 0);

        const redTeleOpEPA = redEPA - redAutonEPA;
        const blueTeleOpEPA = blueEPA - blueAutonEPA;

        const matchData = {};

        if (Math.round(redEPA) > Math.round(blueEPA)) {
            matchData["predictedWinner"] = "Red";
        } else if (Math.round(redEPA) < Math.round(blueEPA)) {
            matchData["predictedWinner"] = "Blue";
        } else {
            matchData["predictedWinner"] = "Tie";
        }
        matchData["redTeams"] = redTeams;
        matchData["blueTeams"] = blueTeams;

        if (redData.redAuto > blueData.blueScore) {
            matchData["actualWinner"] = "Red";
        } else if (redData.redAuto < blueData.blueScore) {
            matchData["actualWinner"] = "Blue";
        } else {
            matchData["actualWinner"] = "Tie";
        }
        matchData["pointBreakdown"] = pointBreakdown;
        matchData["predictedScores"] = {redEPA, redAutonEPA, redTeleOpEPA, blueEPA, blueAutonEPA, blueTeleOpEPA}
        if (!fs.existsSync(`${year}/events/${eventCode}/matches/${matchName}.json`)) {
            writeJson(`${year}/events/${eventCode}/matches/${matchName}.json`, matchData);
            i = 0;
        }

        let redErrorEPA = redData.redScore - redEPA;
        let blueErrorEPA = blueData.blueScore - blueEPA;

        let redAutonErrorEPA = redData.redAuto - redAutonEPA;
        let blueAutonErrorEPA = blueData.blueAuto - blueAutonEPA;     
        
        redTeamsData.forEach((obj) => obj.totalEPA += redErrorEPA / (redTeamsData.length * 3))
        blueTeamsData.forEach((obj) => obj.totalEPA += blueErrorEPA / (blueTeamsData.length * 3))

        redTeamsData.forEach((obj) => obj.autonEPA += redAutonErrorEPA / (redTeamsData.length * 3))
        blueTeamsData.forEach((obj) => obj.autonEPA += blueAutonErrorEPA / (blueTeamsData.length * 3))

        redTeamsData.forEach((obj) => obj.teleOpEPA = obj.totalEPA - obj.autonEPA)
        blueTeamsData.forEach((obj) => obj.teleOpEPA = obj.totalEPA - obj.autonEPA)

        setTeamData(year, redTeamsData)
        setTeamData(year, blueTeamsData)


        // FIXME add wins ties losses using surrogates

    }
}
function setTeamData(year, teamsData) {
    for (let team of teamsData) {
        writeJson(`${year}/teams/${team.teamNumber}.json`);
    }
}
function getTeamData(year, teamNumbers) {
    let teamsData = [];
    for (let teamNumber of teamNumbers) {
        let teamData = readJson(`${year}/teams/${teamNumber}.json`);
        teamsData.push(teamData);
    }
    return teamsData;
}
function getPointBreakdown(alliances) {
    var redScore, redPenaltyFreeScore, redAuto, redTeleOp;

    var blueScore, bluePenaltyFreeScore, blueAuto, blueTeleOp;

    for (let alliance of alliances) {
        let allianceColor = alliance.alliance;
        if (allianceColor == "Red") {
            redScore = alliance.totalPoints;
            redPenaltyFreeScore = redScore - alliance.penaltyPoints;
            redAuto = alliance.autonomousPoints;
            redTeleOp = redPenaltyFreeScore - redAuto;
        } else if (allianceColor == "Blue") {
            blueScore = alliance.totalPoints;
            bluePenaltyFreeScore = blueScore - alliance.penaltyPoints;
            blueAuto = alliance.autonomousPoints;
            blueTeleOp = bluePenaltyFreeScore - blueAuto;
        } else {
            throw new Error("Team is neither blue or red there is an error");
        }
    }
    return {
        redData: { redScore, redPenaltyFreeScore, redAuto, redTeleOp },
        blueData: { blueScore, bluePenaltyFreeScore, blueAuto, blueTeleOp },
    };
}
function getColorData(matchTeams) {
    const redTeams = [];
    const blueTeams = [];

    const surrogates = [];
    for (let team of matchTeams) {
        let teamNumber = team.teamNumber;
        let station = team.station;
        if (team.noShow || team.dq) {
            continue;
        }

        if (team.surrogate) {
            surrogates.push(teamNumber);
        }

        if (station == "Red1" || station == "Red2") {
            redTeams.push(teamNumber);
        } else if (station == "Blue1" || station == "Blue2") {
            blueTeams.push(teamNumber);
        } else {
            throw new Error("Team is neither blue or red there is an error");
        }
    }
    return { redTeams, blueTeams, surrogates };
}

function getTeamNumbers(teamsData) {
    let teamNumbers = [];
    for (let team of teamsData.teams) {
        teamNumbers.push(team.teamNumber);
    }
    return teamNumbers;
}

async function createTeamData(year) {
    const data = readJson(`${year}/yearData.json`);
    const teamList = data.teams;
    const week1Average = data.gameInfo.week1Average;
    const week1STD = data.gameInfo.week1STD;

    const week1AverageAuto = data.gameInfo.week1AverageAuto;
    const week1STDAuto = data.gameInfo.week1STDAuto;
    for (let teamNumber of teamList) {
        var teamStartingData = {};

        teamStartingData["teamNumber"] = teamNumber;

        teamStartingData["wins"] = 0;
        teamStartingData["loss"] = 0;
        teamStartingData["draws"] = 0;
        if (fs.existsSync(`${year - 1}/teams/${teamNumber}.json`)) {
            var lastYearData = readJson(`${year - 1}/${teamNumber}.json`);
            teamStartingData["elo"] = lastYearData.elo;
        } else {
            teamStartingData["elo"] = 1500;
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

        if (week1AverageAuto == null) {
            teamStartingData["autonEPA"] = 0;
        } else {
            teamStartingData["autonEPA"] = eloToEPA(
                teamStartingData["elo"],
                week1AverageAuto,
                week1STDAuto
            );
        }

        teamStartingData["teleOpEPA"] = teamStartingData["totalEPA"] - teamStartingData["autonEPA"];

        teamStartingData["totalEPAOverTime"] = [teamStartingData["totalEPA"]];
        teamStartingData["teleOpEPAOverTime"] = [teamStartingData["teleOpEPA"]];
        teamStartingData["autonEPAOverTime"] = [teamStartingData["autonEPA"]];
        writeJson(`${year}/teams/${teamNumber}.json`, teamStartingData);
    }
}

async function calculateAverageAndSTD(year, eventCodes) {
    var matchScores = [];
    var autoScores = [];
    for (let eventCode of eventCodes) {
        const matches = await callApiRequest(`${apiUrl}${year}/schedule/${eventCode}/qual/hybrid`);
        writeJson("exampe match.json", matches);
        for (let match of matches.schedule) {
            matchScores.push(match.scoreRedFinal - match.scoreRedFoul);
            matchScores.push(match.scoreBlueFinal - match.scoreBlueFoul);

            autoScores.push(match.scoreRedAuto);
            autoScores.push(match.scoreBlueAuto);
        }
    }
    matchScores.sort((a, b) => a - b);
    var eventStats = getStats(matchScores);
    console.log("EventCode Stats", eventStats);
    console.log("Auto Stats", getStats(autoScores));
    let rangeCount = [];
    for (let matchScore of matchScores) {
        let index = Math.floor(matchScore / (eventStats.std / 4));
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
    yearData["gameInfo"] = {
        week1Average: null,
        week1STD: null,
        averageEPA: null,
        week1AverageAuto: null,
        week1STDAuto: null,
        EPA_STD: null,
    };
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
