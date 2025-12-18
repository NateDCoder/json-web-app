import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT; // DO NOT hardcode

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/api/Event_Names", (req, res) => {
  res.json(["event1", "event2"]);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});

app.get('/', (req, res) => res.send('It works!'));

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