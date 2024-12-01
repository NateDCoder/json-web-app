const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and serve static files
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.json());

// Paths for the main and copy data
const data1Path = './data/Match Info.json';
const data2Path = './data/Elo Rating Over Time.json';
const teamListInfoPath = './data/All Team Data.json';
const eventNamesPath = './data/EventCode To Name.json';
const data1CopyPath = './data copy/Match Info.json';
const data2CopyPath = './data copy/Elo Rating Over Time.json';

// Helper functions to read/write JSON files
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf-8'));
const writeJson = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2));

app.get('/api/data1', (req, res) => {
    try {
        const data = readJson(data1Path);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error reading data1' });
    }
});

app.get('/api/Team_List', (req, res) => {
    try {
        const data = readJson(teamListInfoPath);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error reading Team List' });
    }
});

app.get('/api/Event_Names', (req, res) => {
    try {
        const data = readJson(eventNamesPath);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error reading eventNamesPath' });
    }
});

// GET endpoint for data2
app.get('/api/data2', (req, res) => {
    try {
        const data = readJson(data2Path);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error reading data2' });
    }
});

// POST endpoint to add data to data1 and update data2
app.post('/api/data', (req, res) => {
    const newData = req.body;

    if (!newData || !newData.blueScore || !newData.redScore || !newData.blueTeams || !newData.redTeams) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    console.log(newData); // Logs the newData for debugging

    try {
        const data = readJson(data1Path);
        data.push(newData); // Push new data into the existing data array

        writeJson(data1Path, data); // Save the updated data
        updateEloRatingsOverTime(data);

        res.json({ message: 'Data updated successfully', data });
    } catch (error) {
        res.status(500).json({ error: 'Error updating data' });
    }
});

app.post('/api/update', (req, res) => {
    const newData = req.body;

    if (!newData || !newData.username || !newData.authorizationKey) {
        return res.status(400).json({ error: 'Invalid data format' });
    }
    const token = btoa(`${newData.username}:${newData.authorizationKey}`);
    update(token)

});
async function update(token) {
    await updateAllEventData(token);
    updateTeamData()
}
// POST endpoint to reset data
app.post('/api/reset', (req, res) => {
    try {
        const data1Copy = readJson(data1CopyPath);
        const data2Copy = readJson(data2CopyPath);

        writeJson(data1Path, data1Copy);
        writeJson(data2Path, data2Copy);

        res.json({ message: 'Data reset successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error resetting data' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

async function updateEloRatingsOverTime(data) {
    var leagueTeams = [
        '7360', '8492', '11617', '11618',
        '11679', '11729', '26293', '27155',
        '14015', '9895', '8511', '10644',
        '10645', '15555', '26266', '19925',
        '26538', '26606', '10735', '11193',
        '13748', '19770', '8142', '8656',
        '8734', '9458', '14018', '27277',
        '6811', '10552'
    ];

    var eloRatings = {};
    var eloRatingsOverTime = {};
    // await getMatchInfo(await getAllEvents())
    leagueTeams.forEach(team => {
        eloRatings[team] = 1500; // Assign random Elo values
    });
    leagueTeams.forEach(team => {
        eloRatingsOverTime[team] = []; // Assign random Elo values
    });
    for (let team of leagueTeams) {
        eloRatingsOverTime[team].push(1500)
    }

    var week1STD = 20.730805684966178;
    var matchInfo = data;
    for (let i = 0; i < matchInfo.length; i++) {
        var match = matchInfo[i]
        var redTeam = match.redTeams;
        var blueTeam = match.blueTeams;
        if (redTeam[0] == null) continue;
        var redScore = match.redScore;
        var blueScore = match.blueScore;
        var redElo = eloRatings[redTeam[0]] + eloRatings[redTeam[1]]
        var blueElo = eloRatings[blueTeam[0]] + eloRatings[blueTeam[1]]

        var predictedScoreMargin = 0.004 * (redElo - blueElo);
        var actualScoreMargin = (redScore - blueScore) / week1STD;
        var eloDelta = 12 * (actualScoreMargin - predictedScoreMargin)

        eloRatings[redTeam[0]] += eloDelta;
        eloRatings[redTeam[1]] += eloDelta;

        eloRatings[blueTeam[0]] -= eloDelta;
        eloRatings[blueTeam[1]] -= eloDelta;

        eloRatingsOverTime[redTeam[0]].push(Math.floor(eloRatings[redTeam[0]]))
        eloRatingsOverTime[redTeam[1]].push(Math.floor(eloRatings[redTeam[1]]))

        eloRatingsOverTime[blueTeam[0]].push(Math.floor(eloRatings[blueTeam[0]]))
        eloRatingsOverTime[blueTeam[1]].push(Math.floor(eloRatings[blueTeam[1]]))
    }
    writeJson(data2Path, eloRatingsOverTime)
}
async function updateAllEventData(token) {
    const eventCodes = JSON.parse(fs.readFileSync("./data/Event Codes.json", "utf8"));
    // Define the API URL you want to call
    for (let event_code of eventCodes) {
        const apiUrl = "https://ftc-api.firstinspires.org/v2.0/2024/scores/" + event_code + "/qual"; // Replace with the actual endpoint
        // Make the API request
        await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Authorization": `Basic ${token}`,
                "Content-Type": "application/json"
            }
        })
            .then(response => {
                console.log("Response Status:", response.status);  // Log the status code
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text(); // Get response as text
            })
            .then(data => {
                fs.writeFileSync("./data/Event Matches/" + event_code + ".json", data)
            })
            .catch(error => {
                console.error("Error fetching the API:", error);
            });
    }
    for (let event_code of eventCodes) {
        const apiUrl = "https://ftc-api.firstinspires.org/v2.0/2024/matches/" + event_code; // Replace with the actual endpoint
        // Make the API request
        await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Authorization": `Basic ${token}`,
                "Content-Type": "application/json"
            }
        })
            .then(response => {
                console.log("Response Status:", response.status);  // Log the status code
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text(); // Get response as text
            })
            .then(data => {
                fs.writeFileSync("./data/Event Matches/" + event_code + "_Team.json", data)
            })
            .catch(error => {
                console.error("Error fetching the API:", error);
            });
    }
}
function updateTeamData() {
    const gameMean = 36.52564102564103;
    const autoMean = 2.7083333333333335;
    const teleOpMean = 21.166666666666668;
    const endgameMean = 9;
    const std = 25.282160621427234;
    const allTeams = JSON.parse(fs.readFileSync("./data/Team List.json", "utf8"));
    const eventCodes = JSON.parse(fs.readFileSync("./data/Event Codes.json", "utf8"));
    const numbterToName = JSON.parse(fs.readFileSync("./data/Number To Team.json", "utf8"));

    var teamData = {};
    var eloRatingsOverTime = {};
    // await getMatchInfo(await getAllEvents())
    allTeams.forEach(team => {
        teamData[team] = {
            "Unitless EPA": 1500,
            "EPA": gameMean / 2,
            "Auto EPA": autoMean / 2,
            "TeleOp EPA": teleOpMean / 2,
            "Endgame EPA": endgameMean / 2,
            "Played Matches": 0
        };
    });

    console.log(eventCodes)
    for (let eventCode of eventCodes) {
        let matches = JSON.parse(fs.readFileSync(`./data/Event Matches/${eventCode}.json`, "utf8"));
        let matchesTeams = JSON.parse(fs.readFileSync(`./data/Event Matches/${eventCode}_Team.json`, "utf8"));
        for (let i = 0; i < matches.matchScores.length; i++) {
            let matchData = matches.matchScores[i].alliances;
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
            var participants = matchesTeams.matches[i].teams
            participants.forEach(participant => {
                const key = participant.station;
                switch (key) {
                    case "Blue1":
                        blue1 = participant.teamNumber
                        break;
                    case "Blue2":
                        blue2 = participant.teamNumber;
                        break;
                    case "Red1":
                        red1 = participant.teamNumber;
                        break;
                    case "Red2":
                        red2 = participant.teamNumber;
                        break
                }
            });

            if (matchData[0].alliance == "Blue") {
                blueScore = matchData[0].preFoulTotal;
                redScore = matchData[1].preFoulTotal;

                blueAuto = matchData[0].autoPoints;
                redAuto = matchData[1].autoPoints;

                blueTeleOp = matchData[0].teleopPoints - matchData[0].teleopAscentPoints - matchData[0].teleopParkPoints
                redTeleOp = matchData[1].teleopPoints - matchData[1].teleopAscentPoints - matchData[1].teleopParkPoints

                blueEndgame = matchData[0].teleopAscentPoints + matchData[0].teleopParkPoints
                redEndgame = matchData[1].teleopAscentPoints + matchData[1].teleopParkPoints
            } else {
                console.log("Urm what the sigma")
            }

            teamData[blue1]["Played Matches"]++;
            teamData[blue2]["Played Matches"]++;

            teamData[red1]["Played Matches"]++;
            teamData[red2]["Played Matches"]++;

            let bluePointDifference = blueScore - (teamData[blue1]["EPA"] + teamData[blue2]["EPA"])
            let redPointDifference = redScore - (teamData[red1]["EPA"] + teamData[red2]["EPA"])

            teamData[blue1]["EPA"] += getK(teamData[blue1]["Played Matches"]) * bluePointDifference;
            teamData[blue2]["EPA"] += getK(teamData[blue2]["Played Matches"]) * bluePointDifference;

            teamData[red1]["EPA"] += getK(teamData[red1]["Played Matches"]) * redPointDifference;
            teamData[red2]["EPA"] += getK(teamData[red2]["Played Matches"]) * redPointDifference;


            let blueAutoDifference = blueAuto - (teamData[blue1]["Auto EPA"] + teamData[blue2]["Auto EPA"])
            let redAutoDifference = redAuto - (teamData[red1]["Auto EPA"] + teamData[red2]["Auto EPA"])

            teamData[blue1]["Auto EPA"] += getK(teamData[blue1]["Played Matches"]) * blueAutoDifference;
            teamData[blue2]["Auto EPA"] += getK(teamData[blue2]["Played Matches"]) * blueAutoDifference;

            teamData[red1]["Auto EPA"] += getK(teamData[red1]["Played Matches"]) * redAutoDifference;
            teamData[red2]["Auto EPA"] += getK(teamData[red2]["Played Matches"]) * redAutoDifference;


            let blueTeleOpDifference = blueTeleOp - (teamData[blue1]["TeleOp EPA"] + teamData[blue2]["TeleOp EPA"])
            let redTeleOpDifference = redTeleOp - (teamData[red1]["TeleOp EPA"] + teamData[red2]["TeleOp EPA"])

            teamData[blue1]["TeleOp EPA"] += getK(teamData[blue1]["Played Matches"]) * blueTeleOpDifference;
            teamData[blue2]["TeleOp EPA"] += getK(teamData[blue2]["Played Matches"]) * blueTeleOpDifference;

            teamData[red1]["TeleOp EPA"] += getK(teamData[red1]["Played Matches"]) * redTeleOpDifference;
            teamData[red2]["TeleOp EPA"] += getK(teamData[red2]["Played Matches"]) * redTeleOpDifference;


            let blueEndgameDifference = blueEndgame - (teamData[blue1]["Endgame EPA"] + teamData[blue2]["Endgame EPA"])
            let redEndgameDifference = redEndgame - (teamData[red1]["Endgame EPA"] + teamData[red2]["Endgame EPA"])

            teamData[blue1]["Endgame EPA"] += getK(teamData[blue1]["Played Matches"]) * blueEndgameDifference;
            teamData[blue2]["Endgame EPA"] += getK(teamData[blue2]["Played Matches"]) * blueEndgameDifference;

            teamData[red1]["Endgame EPA"] += getK(teamData[red1]["Played Matches"]) * redEndgameDifference;
            teamData[red2]["Endgame EPA"] += getK(teamData[red2]["Played Matches"]) * redEndgameDifference;
        }
    }
    let allEPA = [];
    for (let teamNumber of allTeams) {
        allEPA.push(teamData[teamNumber]["EPA"])
    }
    let averageEPA = allEPA.reduce((accumulator, currentValue) => accumulator + currentValue, 0) / allEPA.length;
    const normalizedEPA = allEPA.map(element => (element - averageEPA) * (element - averageEPA));
    const standardDevation = Math.sqrt(normalizedEPA.reduce((accumulator, currentValue) => accumulator + currentValue, 0) / (allEPA.length - 1));
    console.log(averageEPA, standardDevation)
    let allTeamData = [];
    for (let teamNumber of allTeams) {
        let untilessEPA = 1500 + 250 * (teamData[teamNumber]["EPA"] - averageEPA) / standardDevation
        allTeamData.push({ "Number": teamNumber, "Name": numbterToName[teamNumber], "Unitless EPA": untilessEPA, "EPA": teamData[teamNumber]["EPA"], "Auto EPA": teamData[teamNumber]["Auto EPA"], "TeleOp EPA": teamData[teamNumber]["TeleOp EPA"], "Endgame EPA": teamData[teamNumber]["Endgame EPA"] })
    }

    allTeamData.sort((a, b) => b["Auto EPA"] - a["Auto EPA"]);
    
    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["Auto EPA Rank"] = index + 1
    });

    allTeamData.sort((a, b) => b["TeleOp EPA"] - a["TeleOp EPA"]);
    
    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["TeleOp EPA Rank"] = index + 1
    });

    allTeamData.sort((a, b) => b["Endgame EPA"] - a["Endgame EPA"]);
    
    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["Endgame EPA Rank"] = index + 1
    });

    allTeamData.sort((a, b) => b["EPA"] - a["EPA"]);

    // Add ranked rows
    allTeamData.forEach((event, index) => {
        event["EPA Rank"] = index + 1
    });

    fs.writeFileSync("./data/All Team Data.json", JSON.stringify(allTeamData, null, 2))
}
function getK(gamesPlayed) {
    if (gamesPlayed <= 6) {
        return 0.5;
    } else if (gamesPlayed <= 12) {
        return 0.5 - (1 / 30 * (gamesPlayed - 6))
    } else {
        return 0.3
    }
}
