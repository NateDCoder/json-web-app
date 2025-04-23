const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const cors = require("cors");
const { pathToFileURL } = require("url");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and serve static files
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.json());
const years = [2019]
const teamListInfoPath = "./data/All Team Data.json";
const eventNamesPath = "./data/EventCode To Name.json";

// Helper functions to read/write JSON files
const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf-8"));
const writeJson = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2));
app.get("/api/Year_List", (req, res) => {
    res.json(years)
})

function safeJsonRead(path, res, exceptionError) {
    try {
        const data = readJson(path);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: exceptionError});
    }
}
app.get("/api/Team_List", (req, res) => {
    safeJsonRead(teamListInfoPath, res, "Error reading Team List");
});

app.get("/api/Event_Names", (req, res) => {
    try {
        const data = readJson(eventNamesPath);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error reading eventNamesPath" });
    }
});

app.post("/api/update", (req, res) => {
    const newData = req.body;

    if (!newData || !newData.username || !newData.authorizationKey) {
        return res.status(400).json({ error: "Invalid data format" });
    }
    const token = btoa(`${newData.username}:${newData.authorizationKey}`);
    update(token);
});
async function update(token) {
    await updateAllEventData(token);
    await updateTeamData(token);
}

const eventCodesGlobal = JSON.parse(fs.readFileSync("./data/Event Codes.json", "utf8"));
for (let eventCode of eventCodesGlobal) {
    app.get("/api/" + eventCode, (req, res) => {
        try {
            const data = readJson("./data/Event Details/" + eventCode + ".json");
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: "Error reading eventNamesPath" });
        }
    });
}
// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

async function updateAllEventData(token) {
    const eventCodes = JSON.parse(fs.readFileSync("./data/Event Codes.json", "utf8"));
    // Define the API URL you want to call
    for (let event_code of eventCodes) {
        const apiUrlQuals =
            "https://ftc-api.firstinspires.org/v2.0/2024/scores/" + event_code + "/qual"; // Replace with the actual endpoint
        var quals;
        await fetch(apiUrlQuals, {
            method: "GET",
            headers: {
                Authorization: `Basic ${token}`,
                "Content-Type": "application/json",
            },
        })
            .then((response) => {
                console.log("Response Status:", response.status); // Log the status code
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text(); // Get response as text
            })
            .then((data) => {
                quals = data;
            })
            .catch((error) => {
                console.error("Error fetching the API:", error);
            });
        const apiUrlElim =
            "https://ftc-api.firstinspires.org/v2.0/2024/scores/" + event_code + "/playoff"; // Replace with the actual endpoint
        var elim;
        await fetch(apiUrlElim, {
            method: "GET",
            headers: {
                Authorization: `Basic ${token}`,
                "Content-Type": "application/json",
            },
        })
            .then((response) => {
                console.log("Response Status:", response.status); // Log the status code
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text(); // Get response as text
            })
            .then((data) => {
                elim = data;
            })
            .catch((error) => {
                console.error("Error fetching the API:", error);
            });
        var data = JSON.parse(quals);
        data.matchScores = data.matchScores.concat(JSON.parse(elim).matchScores);
        fs.writeFileSync(
            "./data/Event Matches/" + event_code + ".json",
            JSON.stringify(data, null, 2)
        );
    }
    for (let event_code of eventCodes) {
        const apiUrl = "https://ftc-api.firstinspires.org/v2.0/2024/matches/" + event_code; // Replace with the actual endpoint
        // Make the API request
        await fetch(apiUrl, {
            method: "GET",
            headers: {
                Authorization: `Basic ${token}`,
                "Content-Type": "application/json",
            },
        })
            .then((response) => {
                console.log("Response Status:", response.status); // Log the status code
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text(); // Get response as text
            })
            .then((data) => {
                fs.writeFileSync("./data/Event Matches/" + event_code + "_Team.json", data);
            })
            .catch((error) => {
                console.error("Error fetching the API:", error);
            });
    }
}
async function updateTeamData(token) {
    const gameMean = 36.52564102564103;
    const autoMean = 2.7083333333333335;
    const teleOpMean = 21.166666666666668;
    const endgameMean = 9;
    const std = 25.282160621427234;
    const allTeams = JSON.parse(fs.readFileSync("./data/Team List.json", "utf8"));
    const eventCodes = JSON.parse(fs.readFileSync("./data/Event Codes.json", "utf8"));
    const numberToName = JSON.parse(fs.readFileSync("./data/Number To Team.json", "utf8"));

    var teamData = {};
    var eloRatingsOverTime = {};
    // await getMatchInfo(await getAllEvents())
    allTeams.forEach((team) => {
        teamData[team] = {
            "Unitless EPA": 1500,
            EPA: gameMean / 2,
            "EPA Over Time": [],
            "Auto EPA": autoMean / 2,
            "TeleOp EPA": teleOpMean / 2,
            "Endgame EPA": endgameMean / 2,
            "Played Matches": 0,
        };
    });
    var allTeamData = updateEloAndEPARank(allTeams, teamData, numberToName);
    for (let eventCode of eventCodes) {
        let matches = JSON.parse(fs.readFileSync(`./data/Event Matches/${eventCode}.json`, "utf8"));
        let matchesTeams = JSON.parse(
            fs.readFileSync(`./data/Event Matches/${eventCode}_Team.json`, "utf8")
        );
        var eventData = {};

        var teams = await getTeamsAtEvent(eventCode, token);
        var schedule = await getScheduleAtEvent(eventCode, token);
        var ranks = await getRanks(eventCode, token);

        var teamNumbers = teams.teams.map((team) => team.teamNumber);
        if (teamNumbers.length == 0) {
            eventData["hasTeamList"] = false;
        } else {
            eventData["hasTeamList"] = true;
        }

        if (schedule.schedule.length == 0) {
            eventData["hasScheduleList"] = false;
        } else {
            eventData["hasScheduleist"] = true;
        }

        if (ranks.rankings.length == 0) {
            eventData["hasRankings"] = false;
        } else {
            eventData["hasRankings"] = true;
        }

        if (eventData["hasTeamList"]) {
            eventData["preEloTeamList"] = getTeamData([...allTeamData], teamNumbers, [
                ...ranks.rankings,
            ]);
        }

        eventData["teams"] = teamNumbers;
        eventData["schedule"] = schedule.schedule;
        eventData["Predictions"] = [];
        for (let i = 0; i < schedule.schedule.length; i++) {
            let matchData = null;
            try {
                matchData = matches.matchScores[i].alliances;
            } catch (error) {}
            let blueScore = 0;
            let redScore = 0;

            let blueAuto = 0;
            let redAuto = 0;

            let blueTeleOp = 0;
            let redTeleOp = 0;

            let blueEndgame = 0;
            let redEndgame = 0;

            let blue1 = "";
            let blue2 = "";

            let red1 = "";
            let red2 = "";

            var participants = schedule.schedule[i].teams;
            participants.forEach((participant) => {
                const key = participant.station;
                switch (key) {
                    case "Blue1":
                        blue1 = participant.teamNumber;
                        break;
                    case "Blue2":
                        blue2 = participant.teamNumber;
                        break;
                    case "Red1":
                        red1 = participant.teamNumber;
                        break;
                    case "Red2":
                        red2 = participant.teamNumber;
                        break;
                }
            });
            let redPredictedScore = Math.round(teamData[red1]["EPA"] + teamData[red2]["EPA"]);
            let bluePredictedScore = Math.round(teamData[blue1]["EPA"] + teamData[blue2]["EPA"]);
            let predictedTeamWin = "Tie";
            if (redPredictedScore > bluePredictedScore) {
                predictedTeamWin = "Red";
            } else if (redPredictedScore < bluePredictedScore) {
                predictedTeamWin = "Blue";
            }
            let eloDifference = -Math.abs(
                Math.round(teamData[red1]["Unitless EPA"] + teamData[red2]["Unitless EPA"]) -
                    Math.round(teamData[blue1]["Unitless EPA"] + teamData[blue2]["Unitless EPA"])
            );
            let winPercentage = 1 / (1 + Math.pow(10, eloDifference / 400));
            let predictionData = {
                "Red Pred Score": redPredictedScore,
                "Blue Pred Score": bluePredictedScore,
                "Predicted Team Win": predictedTeamWin,
                "Win Percentage": winPercentage,
            };
            eventData["Predictions"].push(predictionData);
            if (matchData) {
                if (matchData[0].alliance == "Blue") {
                    blueScore = matchData[0].preFoulTotal;
                    redScore = matchData[1].preFoulTotal;

                    blueAuto = matchData[0].autoPoints;
                    redAuto = matchData[1].autoPoints;

                    blueTeleOp =
                        matchData[0].teleopPoints -
                        matchData[0].teleopAscentPoints -
                        matchData[0].teleopParkPoints;
                    redTeleOp =
                        matchData[1].teleopPoints -
                        matchData[1].teleopAscentPoints -
                        matchData[1].teleopParkPoints;

                    blueEndgame = matchData[0].teleopAscentPoints + matchData[0].teleopParkPoints;
                    redEndgame = matchData[1].teleopAscentPoints + matchData[1].teleopParkPoints;
                } else {
                    console.log("Urm what the sigma");
                }

                teamData[blue1]["Played Matches"]++;
                teamData[blue2]["Played Matches"]++;

                teamData[red1]["Played Matches"]++;
                teamData[red2]["Played Matches"]++;

                let bluePointDifference =
                    blueScore - (teamData[blue1]["EPA"] + teamData[blue2]["EPA"]);
                let redPointDifference = redScore - (teamData[red1]["EPA"] + teamData[red2]["EPA"]);

                teamData[blue1]["EPA"] +=
                    getK(teamData[blue1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    bluePointDifference;
                teamData[blue2]["EPA"] +=
                    getK(teamData[blue2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    bluePointDifference;

                teamData[red1]["EPA"] +=
                    getK(teamData[red1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redPointDifference;
                teamData[red2]["EPA"] +=
                    getK(teamData[red2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redPointDifference;

                let blueAutoDifference =
                    blueAuto - (teamData[blue1]["Auto EPA"] + teamData[blue2]["Auto EPA"]);
                let redAutoDifference =
                    redAuto - (teamData[red1]["Auto EPA"] + teamData[red2]["Auto EPA"]);

                teamData[blue1]["Auto EPA"] +=
                    getK(teamData[blue1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    blueAutoDifference;
                teamData[blue2]["Auto EPA"] +=
                    getK(teamData[blue2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    blueAutoDifference;

                teamData[red1]["Auto EPA"] +=
                    getK(teamData[red1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redAutoDifference;
                teamData[red2]["Auto EPA"] +=
                    getK(teamData[red2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redAutoDifference;

                let blueTeleOpDifference =
                    blueTeleOp - (teamData[blue1]["TeleOp EPA"] + teamData[blue2]["TeleOp EPA"]);
                let redTeleOpDifference =
                    redTeleOp - (teamData[red1]["TeleOp EPA"] + teamData[red2]["TeleOp EPA"]);

                teamData[blue1]["TeleOp EPA"] +=
                    getK(teamData[blue1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    blueTeleOpDifference;
                teamData[blue2]["TeleOp EPA"] +=
                    getK(teamData[blue2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    blueTeleOpDifference;

                teamData[red1]["TeleOp EPA"] +=
                    getK(teamData[red1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redTeleOpDifference;
                teamData[red2]["TeleOp EPA"] +=
                    getK(teamData[red2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redTeleOpDifference;

                let blueEndgameDifference =
                    blueEndgame - (teamData[blue1]["Endgame EPA"] + teamData[blue2]["Endgame EPA"]);
                let redEndgameDifference =
                    redEndgame - (teamData[red1]["Endgame EPA"] + teamData[red2]["Endgame EPA"]);

                teamData[blue1]["Endgame EPA"] +=
                    getK(teamData[blue1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    blueEndgameDifference;
                teamData[blue2]["Endgame EPA"] +=
                    getK(teamData[blue2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    blueEndgameDifference;

                teamData[red1]["Endgame EPA"] +=
                    getK(teamData[red1]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redEndgameDifference;
                teamData[red2]["Endgame EPA"] +=
                    getK(teamData[red2]["Played Matches"], matches.matchScores[i].matchLevel) *
                    redEndgameDifference;
                allTeamData = updateEloAndEPARank(allTeams, { ...teamData }, numberToName);

                teamData[red1]["EPA Over Time"].push(Math.floor(10 * teamData[red1]["EPA"]) / 10);
                teamData[red2]["EPA Over Time"].push(Math.floor(10 * teamData[red2]["EPA"]) / 10);
                teamData[blue1]["EPA Over Time"].push(Math.floor(10 * teamData[blue1]["EPA"]) / 10);
                teamData[blue2]["EPA Over Time"].push(Math.floor(10 * teamData[blue2]["EPA"]) / 10);
            }
        }

        if (eventData["hasTeamList"]) {
            eventData["afterEloTeamList"] = getTeamData([...allTeamData], teamNumbers, [
                ...ranks.rankings,
            ]);
        }
        eventData["rankings"] = ranks.rankings;

        fs.writeFileSync(
            "./data/Event Details/" + eventCode + ".json",
            JSON.stringify(eventData, null, 2)
        );
    }

    fs.writeFileSync(teamListInfoPath, JSON.stringify(allTeamData, null, 2));
}
function updateEloAndEPARank(allTeams, _teamData, numberToName) {
    var teamData = { ..._teamData };
    let allEPA = [];
    for (let teamNumber of allTeams) {
        allEPA.push(teamData[teamNumber]["EPA"]);
    }
    let averageEPA =
        allEPA.reduce((accumulator, currentValue) => accumulator + currentValue, 0) / allEPA.length;
    const normalizedEPA = allEPA.map((element) => (element - averageEPA) * (element - averageEPA));
    const standardDevation = Math.sqrt(
        normalizedEPA.reduce((accumulator, currentValue) => accumulator + currentValue, 0) /
            (allEPA.length - 1)
    );
    console.log(averageEPA, standardDevation);
    let allTeamData = [];
    for (let teamNumber of allTeams) {
        let untilessEPA =
            1500 + (250 * (teamData[teamNumber]["EPA"] - averageEPA)) / standardDevation;
        _teamData[teamNumber]["Unitless EPA"] = untilessEPA;
        allTeamData.push({
            Number: teamNumber,
            Name: numberToName[teamNumber],
            "Unitless EPA": untilessEPA,
            EPA: teamData[teamNumber]["EPA"],
            "Auto EPA": teamData[teamNumber]["Auto EPA"],
            "TeleOp EPA": teamData[teamNumber]["TeleOp EPA"],
            "Endgame EPA": teamData[teamNumber]["Endgame EPA"],
            "EPA Over Time": teamData[teamNumber]["EPA Over Time"],
        });
    }

    allTeamData.sort((a, b) => b["Auto EPA"] - a["Auto EPA"]);

    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["Auto EPA Rank"] = index + 1;
    });

    allTeamData.sort((a, b) => b["TeleOp EPA"] - a["TeleOp EPA"]);

    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["TeleOp EPA Rank"] = index + 1;
    });

    allTeamData.sort((a, b) => b["Endgame EPA"] - a["Endgame EPA"]);

    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["Endgame EPA Rank"] = index + 1;
    });

    allTeamData.sort((a, b) => b["EPA"] - a["EPA"]);

    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["EPA Rank"] = index + 1;
    });
    return allTeamData;
}
function getK(gamesPlayed, matchLevel) {
    if (matchLevel == "PLAYOFF") return 0;
    if (gamesPlayed <= 6) {
        return 0.33;
    } else if (gamesPlayed <= 12) {
        return 0.33 - (13 / 600) * (gamesPlayed - 6);
    } else {
        return 0.2;
    }
}

async function getTeamsAtEvent(event_code, token) {
    const apiUrl = "https://ftc-api.firstinspires.org/v2.0/2024/teams?eventCode=" + event_code; // Replace with the actual endpoint
    console.log(apiUrl);
    var teams;
    await fetch(apiUrl, {
        method: "GET",
        headers: {
            Authorization: `Basic ${token}`,
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            console.log("Response Status:", response.status); // Log the status code
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text(); // Get response as text
        })
        .then((data) => {
            teams = JSON.parse(data);
        })
        .catch((error) => {
            console.error("Error fetching the API:", error);
        });
    return teams;
}
async function getScheduleAtEvent(event_code, token) {
    const apiUrl =
        "https://ftc-api.firstinspires.org/v2.0/2024/schedule/" + event_code + "/qual/hybrid"; // Replace with the actual endpoint
    var schedule;
    await fetch(apiUrl, {
        method: "GET",
        headers: {
            Authorization: `Basic ${token}`,
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            console.log("Response Status:", response.status); // Log the status code
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text(); // Get response as text
        })
        .then((data) => {
            schedule = JSON.parse(data);
        })
        .catch((error) => {
            console.error("Error fetching the API:", error);
        });
    return schedule;
}
async function getRanks(event_code, token) {
    const apiUrl = "https://ftc-api.firstinspires.org/v2.0/2024/rankings/" + event_code; // Replace with the actual endpoint
    var ranks;
    await fetch(apiUrl, {
        method: "GET",
        headers: {
            Authorization: `Basic ${token}`,
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            console.log("Response Status:", response.status); // Log the status code
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text(); // Get response as text
        })
        .then((data) => {
            ranks = JSON.parse(data);
        })
        .catch((error) => {
            console.error("Error fetching the API:", error);
        });
    return ranks;
}
function getTeamData(allTeamData, teamNumbers, ranks) {
    // console.log(allTeamData)
    let teamDataArray = [];
    var numberToRank = {};
    var numberToData = {};
    if (ranks.length > 0) {
        ranks.forEach((item) => {
            numberToRank[item.teamNumber] = item.rank;
        });
    }
    allTeamData.forEach((item) => {
        numberToData[item.Number] = item;
    });
    for (let teamNumber of teamNumbers) {
        if (!numberToData[teamNumber]) {
            console.log(teamNumber);
        }
        var teamData1 = { ...numberToData[teamNumber] };
        if (ranks.length > 0) {
            teamData1["Rank"] = numberToRank[teamNumber];
        }
        teamDataArray.push(teamData1);
    }

    teamDataArray.sort((a, b) => b["EPA"] - a["EPA"]);

    if (ranks.length > 0) {
        teamDataArray.sort((a, b) => a["Rank"] - b["Rank"]);
    }
    return teamDataArray;
}
