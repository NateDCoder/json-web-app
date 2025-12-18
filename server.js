import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import cors from "cors";
import { pathToFileURL } from "url";
import { getTeamData } from "./redoing.js";
const app = express();
app.use(cors());
const PORT = process.env.PORT || 8080;

// Middleware to parse JSON and serve static files
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  next();
});

const years = [2025, 2024, 2023, 2022, 2021, 2019];
const teamListInfoPath = "./data/All Team Data.json";
const eventNamesPath = "./data/EventCode To Name.json";

// Helper functions to read/write JSON files
const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf-8"));
const writeJson = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2));
app.get("/api/Year_List", (req, res) => {
    res.json(years);
});

function safeJsonRead(path, res, exceptionError) {
    try {
        const data = readJson(path);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: exceptionError });
    }
}
for (let year of years) {
    app.get(`/api/${year}/Total_Teams_Count`, (req, res) => {
        try {
            const data = readJson(`./${year}/yearData.json`);
            res.json(data.competedTeams.length);
        } catch (error) {
            res.status(500).json({ error: "Could not get that years team count" });
        }
    });
    app.get(`/api/${year}/Team_List`, (req, res) => {
        try {
            const data = readJson(`./${year}/yearData.json`);
            const teams = data.competedTeams;
            const teamData = getTeamData(year, teams);
            res.json(teamData);
        } catch (error) {
            console.log;
            res.status(500).json({ error: "Could not get team list" });
        }
    });
    app.get(`/api/${year}/Event_List`, (req, res) => {
        try {
            const data = readJson(`./${year}/yearData.json`);
            res.json(data.events);
        } catch (error) {
            res.status(500).json({ error: "Could not get event list" });
        }
    });
    app.get("/api/:year/:eventCode", (req, res) => {
        const { year, eventCode } = req.params;
        try {
            const data = readJson(`./${year}/events/${eventCode}/${eventCode}.json`);
            res.json(data);
        } catch {
            res.status(404).json({ error: "Event not found" });
        }
    });

    app.get("/api/:year/:eventCode/quals", (req, res) => {
        const { year, eventCode } = req.params;
        try {
            const matches = [];
            let i = 1;
            while (true) {
                const matchPath = `./${year}/events/${eventCode}/matches/Qualification ${i}.json`;
                if (!fs.existsSync(matchPath)) break;
                matches.push(readJson(matchPath));
                i++;
            }
            res.json(matches);
        } catch {
            res.status(500).json({ error: "Failed to load quals" });
        }
    });
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

app.get("/", (req, res) => res.send("It works!"));
// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

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
