import fs from "fs";
import path from "path";
import { getStats, eloToEPA, epaToUnitlessEPA } from "./util.js";
const token = btoa(`nathandgamer:B493F5FF-7FC9-43F8-9EB9-FE7E3042AC87`);

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
// await createEventData(2019);
// await createStateRanks(2019);

// await generateYearData(2021)
// await calculateAverageAndSTD(2021, ["USMICHM1", "USMICLM1", "USMICLS"]);
// await createTeamData(2021);
// await createEventData(2021);
// await createStateRanks(2021);

// await generateYearData(2022)
// await calculateAverageAndSTD(2022, ["USMIDHS1", "USMIOCM1", "USMISCM1"]);
// await createTeamData(2022);
// await createEventData(2022);
// await createStateRanks(2022);

// await generateYearData(2023)
// await calculateAverageAndSTD(2023, ["USMISCM1", "USMISCM2", "USMIDHS"]);
// await createTeamData(2023);
// await createEventData(2023);
// await createStateRanks(2023);

async function createStateRanks(year) {
    const data = readJson(`${year}/yearData.json`);
    const teams = data.teams;

    const teamsData = getTeamData(year, teams);

    const EPAs = [];
    const autonEPAs = [];
    const endgameEPAs = [];
    const teleOpEPAs = [];

    for (let team of teamsData) {
        if (team.totalEPAOverTime.length > 1) {
            EPAs.push({ teamNumber: team.teamNumber, totalEPA: team.totalEPA });
            autonEPAs.push({ teamNumber: team.teamNumber, autonEPA: team.autonEPA });
            endgameEPAs.push({ teamNumber: team.teamNumber, endgameEPA: team.endgameEPA });
            teleOpEPAs.push({ teamNumber: team.teamNumber, teleOpEPA: team.teleOpEPA });
        }
    }
    EPAs.sort((a, b) => b.totalEPA - a.totalEPA);
    autonEPAs.sort((a, b) => b.autonEPA - a.autonEPA);
    endgameEPAs.sort((a, b) => b.endgameEPA - a.endgameEPA);
    teleOpEPAs.sort((a, b) => b.teleOpEPA - a.teleOpEPA);

    for (let i = 0; i < EPAs.length; i++) {
        const teamData = readJson(`${year}/teams/${EPAs[i].teamNumber}.json`);
        teamData["EPA Rank"] = i + 1;
        setTeamData(year, [teamData]);
    }

    for (let i = 0; i < autonEPAs.length; i++) {
        const teamData = readJson(`${year}/teams/${autonEPAs[i].teamNumber}.json`);
        teamData["Auto EPA Rank"] = i + 1;
        setTeamData(year, [teamData]);
    }

    for (let i = 0; i < teleOpEPAs.length; i++) {
        const teamData = readJson(`${year}/teams/${teleOpEPAs[i].teamNumber}.json`);
        teamData["TeleOp EPA Rank"] = i + 1;
        setTeamData(year, [teamData]);
    }

    for (let i = 0; i < endgameEPAs.length; i++) {
        const teamData = readJson(`${year}/teams/${endgameEPAs[i].teamNumber}.json`);
        teamData["Endgame EPA Rank"] = i + 1;
        setTeamData(year, [teamData]);
    }

    // const indexInEPAs = EPAs.findIndex((team) => team.teamNumber === 10735);
    // const indexInAutonEPAs = autonEPAs.findIndex((team) => team.teamNumber === 10735);

    // console.log(
    //     `Team 10735 is ranked #${indexInEPAs + 1} by totalEPA and are in the ${(
    //         indexInEPAs / EPAs.length
    //     ).toFixed(5)} percentile`
    // );
    // console.log(
    //     `Team 10735 is ranked #${indexInAutonEPAs + 1} by autonEPA and are in the ${(
    //         indexInAutonEPAs / EPAs.length
    //     ).toFixed(5)} percentile`
    // );
    // console.log("Total Teams Competing", EPAs.length);
}

async function createEventData(year) {
    const data = readJson(`${year}/yearData.json`);
    const events = data.events;

    for (let { code: eventCode } of events) {
        const eventData = {};
        const qualSchedule = await callApiRequest(
            `${apiUrl}${year}/schedule/${eventCode}/qual/hybrid`
        );
        const qualMatches = await callApiRequest(`${apiUrl}${year}/scores/${eventCode}/qual/`);

        const playoffSchedule = await callApiRequest(
            `${apiUrl}${year}/schedule/${eventCode}/playoff/hybrid`
        );

        const playoffMatches = await callApiRequest(
            `${apiUrl}${year}/scores/${eventCode}/playoff/`
        );

        const rawEventData = await callApiRequest(`${apiUrl}${year}/events?eventCode=${eventCode}`);
        const eventDetails = rawEventData.events[0];

        if (eventDetails.venue == "Remote Event") continue;
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
            console.log("Completed Event", eventCode);
            eventData["completed"] = true;
            eventData["ongoing"] = false;
            eventData["breakdown"] = null;
            updateEPA(year, eventCode, qualMatches.matchScores, qualSchedule.schedule, teamNumbers);
            updateEPA(
                year,
                eventCode,
                playoffMatches.matchScores,
                playoffSchedule.schedule,
                teamNumbers,
                0,
                false
            );
        }
        writeJson(`${year}/events/${eventCode}/${eventCode}.json`, eventData);
    }
}

function updateEPA(year, eventCode, matches, schedule, teamNumbers, epaMultiplier, iterate) {
    if (epaMultiplier == null) {
        epaMultiplier = 1 / 3;
    }
    if (iterate == null) {
        iterate = true;
    }
    const yearData = readJson(`${year}/yearData.json`);
    for (let i = 0; i < matches.length; i++) {
        let match = matches[i];
        let matchTeams = schedule[i].teams;
        let matchName = schedule[i].description;

        const colorData = getColorData(matchTeams);
        const redTeams = colorData.redTeams;
        const blueTeams = colorData.blueTeams;
        const surrogates = colorData.surrogates;

        const pointBreakdown = getPointBreakdown(year, match.alliances);
        const redData = pointBreakdown.redData;
        const blueData = pointBreakdown.blueData;

        var redTeamsData = getTeamData(year, redTeams);
        var blueTeamsData = getTeamData(year, blueTeams);

        const redEPA = redTeamsData.reduce((sum, obj) => sum + (obj.totalEPA || 0), 0);
        const blueEPA = blueTeamsData.reduce((sum, obj) => sum + (obj.totalEPA || 0), 0);

        const redAutonEPA = redTeamsData.reduce((sum, obj) => sum + (obj.autonEPA || 0), 0);
        const blueAutonEPA = blueTeamsData.reduce((sum, obj) => sum + (obj.autonEPA || 0), 0);

        const redEndgameEPA = redTeamsData.reduce((sum, obj) => sum + (obj.endgameEPA || 0), 0);
        const blueEndgameEPA = blueTeamsData.reduce((sum, obj) => sum + (obj.endgameEPA || 0), 0);

        const redTeleOpEPA = redEPA - redAutonEPA - redEndgameEPA;
        const blueTeleOpEPA = blueEPA - blueAutonEPA - blueEndgameEPA;

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

        if (redData.redScore > blueData.blueScore) {
            matchData["actualWinner"] = "Red";
        } else if (redData.redScore < blueData.blueScore) {
            matchData["actualWinner"] = "Blue";
        } else {
            matchData["actualWinner"] = "Tie";
        }
        matchData["pointBreakdown"] = pointBreakdown;
        matchData["predictedScores"] = {
            redEPA,
            redAutonEPA,
            redTeleOpEPA,
            redEndgameEPA,
            blueEPA,
            blueAutonEPA,
            blueTeleOpEPA,
            blueEndgameEPA,
        };

        let redErrorEPA = redData.redPenaltyFreeScore - redEPA;
        let blueErrorEPA = blueData.bluePenaltyFreeScore - blueEPA;

        let redAutonErrorEPA = redData.redAuto - redAutonEPA;
        let blueAutonErrorEPA = blueData.blueAuto - blueAutonEPA;

        let redEndGameErrorEPA = redData.redEndgame - redEndgameEPA;
        let blueEndGameErrorEPA = blueData.blueEndgame - blueEndgameEPA;

        redTeamsData.forEach(
            (obj) => (obj.totalEPA += (redErrorEPA / redTeamsData.length) * epaMultiplier)
        );
        blueTeamsData.forEach(
            (obj) => (obj.totalEPA += (blueErrorEPA / blueTeamsData.length) * epaMultiplier)
        );

        redTeamsData.forEach(
            (obj) => (obj.endgameEPA += (redEndGameErrorEPA / redTeamsData.length) * epaMultiplier)
        );
        blueTeamsData.forEach(
            (obj) =>
                (obj.endgameEPA += (blueEndGameErrorEPA / blueTeamsData.length) * epaMultiplier)
        );

        redTeamsData.forEach(
            (obj) => (obj.autonEPA += (redAutonErrorEPA / redTeamsData.length) * epaMultiplier)
        );
        blueTeamsData.forEach(
            (obj) => (obj.autonEPA += (blueAutonErrorEPA / blueTeamsData.length) * epaMultiplier)
        );

        redTeamsData.forEach((obj) => (obj.teleOpEPA = obj.totalEPA - obj.autonEPA));
        blueTeamsData.forEach((obj) => (obj.teleOpEPA = obj.totalEPA - obj.autonEPA));

        redTeamsData.forEach(
            (obj) =>
                (obj.unitlessEPA = epaToUnitlessEPA(
                    obj.totalEPA,
                    yearData.gameInfo.averageEPA || yearData.gameInfo.week1Average,
                    yearData.gameInfo.EPA_STD || yearData.gameInfo.week1STD
                ))
        );
        blueTeamsData.forEach(
            (obj) =>
                (obj.unitlessEPA = epaToUnitlessEPA(
                    obj.totalEPA,
                    yearData.gameInfo.averageEPA || yearData.gameInfo.week1Average,
                    yearData.gameInfo.EPA_STD || yearData.gameInfo.week1STD
                ))
        );

        if (
            !fs.existsSync(`${year}/events/${eventCode}/matches/${matchName}.json`) ||
            readJson(`${year}/events/${eventCode}/matches/${matchName}.json`).actualWinner == null
        ) {
            writeJson(`${year}/events/${eventCode}/matches/${matchName}.json`, matchData);
            redTeamsData.forEach((obj) => obj.totalEPAOverTime.push(obj.totalEPA));
            blueTeamsData.forEach((obj) => obj.totalEPAOverTime.push(obj.totalEPA));

            redTeamsData.forEach((obj) => obj.teleOpEPAOverTime.push(obj.teleOpEPA));
            blueTeamsData.forEach((obj) => obj.teleOpEPAOverTime.push(obj.teleOpEPA));

            redTeamsData.forEach((obj) => obj.autonEPAOverTime.push(obj.autonEPA));
            blueTeamsData.forEach((obj) => obj.autonEPAOverTime.push(obj.autonEPA));

            redTeamsData.forEach((obj) => obj.endGameEPAOverTime.push(obj.endgameEPA));
            blueTeamsData.forEach((obj) => obj.endGameEPAOverTime.push(obj.endgameEPA));

            redTeamsData.forEach((obj) => obj.unitlessEPAOverTime.push(obj.unitlessEPA));
            blueTeamsData.forEach((obj) => obj.unitlessEPAOverTime.push(obj.unitlessEPA));

            if (matchData["actualWinner"] == "Red") {
                redTeamsData.forEach((obj) => {
                    if (!surrogates.includes(obj.teamNumber)) {
                        obj.wins++;
                    } else {
                        console.log(obj.teamNumber, "is a surgorate");
                    }
                });
                blueTeamsData.forEach((obj) => {
                    if (!surrogates.includes(obj.teamNumber)) {
                        obj.loss++;
                    } else {
                        console.log(obj.teamNumber, "is a surgorate");
                    }
                });
            } else if (matchData["actualWinner"] == "Blue") {
                blueTeamsData.forEach((obj) => {
                    if (!surrogates.includes(obj.teamNumber)) {
                        obj.wins++;
                    } else {
                        console.log(obj.teamNumber, "is a surgorate");
                    }
                });
                redTeamsData.forEach((obj) => {
                    if (!surrogates.includes(obj.teamNumber)) {
                        obj.loss++;
                    } else {
                        console.log(obj.teamNumber, "is a surgorate");
                    }
                });
            } else {
                redTeamsData.forEach((obj) => {
                    if (!surrogates.includes(obj.teamNumber)) {
                        obj.ties++;
                    } else {
                        console.log(obj.teamNumber, " is a surgorate");
                    }
                });
                blueTeamsData.forEach((obj) => {
                    if (!surrogates.includes(obj.teamNumber)) {
                        obj.ties++;
                    } else {
                        console.log(obj.teamNumber, "is a surgorate");
                    }
                });
            }
            if (iterate) i = 0;
        }
        setTeamData(year, redTeamsData);
        setTeamData(year, blueTeamsData);
    }
    const allTeamsEventData = getTeamData(year, teamNumbers);
    if (iterate) {
        allTeamsEventData.forEach((obj) => obj.totalEPAOverTime.push(obj.totalEPA));
        allTeamsEventData.forEach((obj) => obj.teleOpEPAOverTime.push(obj.teleOpEPA));
        allTeamsEventData.forEach((obj) => obj.autonEPAOverTime.push(obj.autonEPA));
        allTeamsEventData.forEach((obj) => obj.unitlessEPAOverTime.push(obj.unitlessEPA));
        allTeamsEventData.forEach((obj) => obj.endGameEPAOverTime.push(obj.endgameEPA));
    }

    setTeamData(year, allTeamsEventData);

    for (let teamData of allTeamsEventData) {
        if (!yearData.competedTeams.includes(teamData.teamNumber)) {
            yearData.competedTeams.push(teamData.teamNumber);
        }
    }

    const competedTeamsEPA = getTeamEPA(year, yearData.competedTeams);
    const newStats = getStats(competedTeamsEPA);
    console.log(newStats);
    yearData.gameInfo.averageEPA = newStats.average * 2;
    yearData.gameInfo.EPA_STD = newStats.std * 2;

    writeJson(`${year}/yearData.json`, yearData);
}
function setTeamData(year, teamsData) {
    for (let team of teamsData) {
        writeJson(`${year}/teams/${team.teamNumber}.json`, team);
    }
}
export function getTeamData(year, teamNumbers) {
    let teamsData = [];
    for (let teamNumber of teamNumbers) {
        try {
            let teamData = readJson(`${year}/teams/${teamNumber}.json`);
            teamsData.push(teamData);
        } catch (error) {
            console.error(error);
        }
    }
    return teamsData;
}
function getTeamEPA(year, teamNumbers) {
    let epas = [];
    for (let teamNumber of teamNumbers) {
        try {
            let teamData = readJson(`${year}/teams/${teamNumber}.json`);
            epas.push(teamData.totalEPA);
        } catch (error) {
            console.error(error);
        }
    }
    return epas;
}
function getPenaltyPoints(year, alliance) {
    switch (year) {
        case 2019:
        case 2021:
            return alliance.penaltyPoints;
        case 2022:
        case 2023:
            return alliance.penaltyPointsCommitted;
        case 2024:
            return alliance.foulPointsCommitted;
    }
}

function getAutonPoints(year, alliance) {
    switch (year) {
        case 2019:
            return alliance.autonomousPoints;
        case 2021:
        case 2022:
        case 2023:
        case 2024:
            return alliance.autoPoints;
    }
}

function getEndGamePoints(year, alliance) {
    switch (year) {
        case 2019:
            return alliance.capstonePoints + alliance.foundationMoved
                ? 15
                : 0 + alliance.robot1Parked
                ? 5
                : 0 + alliance.robot2Parked
                ? 5
                : 0;
        case 2021:
        case 2022:
        case 2023:
            return alliance.endgamePoints;
        case 2024:
            return null;
    }
}

function getPointBreakdown(year, alliances) {
    var redScore, redPenaltyFreeScore, redAuto, redTeleOp, redEndgame;

    var blueScore, bluePenaltyFreeScore, blueAuto, blueTeleOp, blueEndgame;

    for (let alliance of alliances) {
        let allianceColor = alliance.alliance;
        if (allianceColor == "Red") {
            redScore = alliance.totalPoints;
            redPenaltyFreeScore = redScore - getPenaltyPoints(year, alliance);
            redAuto = getAutonPoints(year, alliance);
            redEndgame = getEndGamePoints(year, alliance);
            redTeleOp = redPenaltyFreeScore - redAuto - redEndgame;
        } else if (allianceColor == "Blue") {
            blueScore = alliance.totalPoints;
            bluePenaltyFreeScore = blueScore - getPenaltyPoints(year, alliance);
            blueAuto = getAutonPoints(year, alliance);
            blueEndgame = getEndGamePoints(year, alliance);
            blueTeleOp = bluePenaltyFreeScore - blueAuto - blueEndgame;
        } else {
            console.log(allianceColor, alliance);
            throw new Error("Team is neither blue or red there is an error");
        }
    }
    return {
        redData: { redScore, redPenaltyFreeScore, redAuto, redTeleOp, redEndgame },
        blueData: { blueScore, bluePenaltyFreeScore, blueAuto, blueTeleOp, blueEndgame },
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
        if (station == "Red1" || station == "Red2" || station == "Red3") {
            redTeams.push(teamNumber);
        } else if (station == "Blue1" || station == "Blue2" || station == "Blue3") {
            blueTeams.push(teamNumber);
        } else {
            console.log(station, team);
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
    const teamNameList = await generateListOfTeamsNames(year);
    const week1Average = data.gameInfo.week1Average;
    const week1STD = data.gameInfo.week1STD;

    const week1AverageAuto = data.gameInfo.week1AverageAuto;
    const week1STDAuto = data.gameInfo.week1STDAuto;

    const week1AverageEndGame = data.gameInfo.week1AverageEndGame;
    const week1STDEndGame = data.gameInfo.week1STDEndGame;

    for (let i = 0; i < teamList.length; i++) {
        const teamNumber = teamList[i];
        const teamName = teamNameList[i];
        var teamStartingData = {};

        teamStartingData["teamNumber"] = teamNumber;
        teamStartingData["teamName"] = teamName;

        teamStartingData["wins"] = 0;
        teamStartingData["loss"] = 0;
        teamStartingData["ties"] = 0;
        if (fs.existsSync(`${year - 1}/teams/${teamNumber}.json`)) {
            var lastYearData = readJson(`${year - 1}/teams/${teamNumber}.json`);
            teamStartingData["elo"] = lastYearData.elo;
        } else {
            teamStartingData["elo"] = 1500;
        }
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

        if (week1AverageEndGame == null) {
            teamStartingData["endgameEPA"] = 0;
        } else {
            teamStartingData["endgameEPA"] = eloToEPA(
                teamStartingData["elo"],
                week1AverageEndGame,
                week1STDEndGame
            );
        }

        teamStartingData["unitlessEPA"] = teamStartingData["elo"];
        teamStartingData["teleOpEPA"] =
            teamStartingData["totalEPA"] -
            teamStartingData["autonEPA"] -
            teamStartingData["endgameEPA"];

        teamStartingData["totalEPAOverTime"] = [teamStartingData["totalEPA"]];
        teamStartingData["teleOpEPAOverTime"] = [teamStartingData["teleOpEPA"]];
        teamStartingData["autonEPAOverTime"] = [teamStartingData["autonEPA"]];
        teamStartingData["endGameEPAOverTime"] = [teamStartingData["endgameEPA"]];
        teamStartingData["unitlessEPAOverTime"] = [teamStartingData["unitlessEPA"]];

        writeJson(`${year}/teams/${teamNumber}.json`, teamStartingData);
    }
}

async function calculateAverageAndSTD(year, eventCodes) {
    var matchScores = [];
    var autoScores = [];
    var endGameScores = [];
    for (let eventCode of eventCodes) {
        const matches = await callApiRequest(`${apiUrl}${year}/scores/${eventCode}/qual/`);
        writeJson("exampe match.json", matches);
        for (let match of matches.matchScores) {
            for (let alliance of match.alliances) {
                console.log(alliance);
                matchScores.push(alliance.totalPoints - getPenaltyPoints(year, alliance));

                autoScores.push(getAutonPoints(year, alliance));
                endGameScores.push(getEndGamePoints(year, alliance));
            }
        }
    }
    matchScores.sort((a, b) => a - b);
    var eventStats = getStats(matchScores);
    console.log("EventCode Stats", eventStats);
    console.log("Auto Stats", getStats(autoScores));
    console.log("Endgame Stats", getStats(endGameScores));
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
    yearData["competedTeams"] = [];
    yearData["gameInfo"] = {
        week1Average: null,
        week1STD: null,
        averageEPA: null,
        EPA_STD: null,
        week1AverageAuto: null,
        week1STDAuto: null,
        week1AverageEndGame: null,
        week1STDEndGame: null,
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

async function generateListOfTeamsNames(year) {
    const numberOfPages = (await callApiRequest(`${apiUrl}${year}/teams?state=MI`)).pageTotal;

    var names = [];
    for (let page = 1; page <= numberOfPages; page++) {
        const data = await callApiRequest(`${apiUrl}${year}/teams?state=MI&page=${page}`);
        for (let team of data.teams) {
            names.push(team.nameShort);
        }
        console.log(`Page ${page}`);
    }
    return names;
}

async function generateListOfTeamsAtEvent(year, eventCode) {
    const numberOfPages = (await callApiRequest(`${apiUrl}${year}/teams?eventCode=${eventCode}`))
        .pageTotal;

    var teams = [];
    for (let page = 1; page <= numberOfPages; page++) {
        const data = await callApiRequest(`${apiUrl}${year}/teams?eventCode=${eventCode}`);
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
