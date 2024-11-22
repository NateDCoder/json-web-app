const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors())
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and serve static files
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.json())

// Data storage
const dataPath = './data/Match Info.json';

// Helper to read/write JSON file
const readData = () => JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const writeData = (data) => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// GET endpoint to fetch data
app.get('/api/data', (req, res) => {
    const data = readData();
    res.json(data);
});

// POST endpoint to add data to data1 and update data2
app.post('/api/data', (req, res) => {
    const newData = req.body;

    if (!newData || !newData.blueScore || !newData.redScore || !newData.blueTeams || !newData.redTeams) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    console.log(newData); // Logs the newData for debugging

    const data = readData();
    data.push(newData); // Push new data into the existing data array

    writeData(data); // Save the updated data
    updateEloRatingsOverTime(data);

    res.json({ message: 'Data updated successfully', data });
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
        if (redTeam[0]==null) continue;
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
    fs.writeFileSync('./data/Elo Rating Over Time.json', JSON.stringify(eloRatingsOverTime, null, 2))
}
