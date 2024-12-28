const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
const path = require('path');
const osuApiHelper = require(path.resolve(__dirname, './services/OsuApiHelper'));
const rosu = require("rosu-pp-js");

app.use(cors());

app.get('/', async (req, res) => {
    res.send('Hello World!');
});

app.get('/api/MapsetData/:id', async (req, res) => {
    const mapsetId = req.params.id;
    try {
        const data = await osuApiHelper.getMapsetData(mapsetId);
        res.json(data);
    } catch (error) {
        console.error("Ошибка получения данных:", error);
        res.status(500).json({ error: "Ошибка получения данных" });
    }
});

app.get('/api/BeatmapData/:id', async (req, res) => {
    const beatmapId = req.params.id;
    try {
        const data = await osuApiHelper.getBeatmapData(beatmapId);
        res.json(data);
    } catch (error) {
        console.error("Ошибка получения данных:", error);
        res.status(500).json({ error: "Ошибка получения данных" });
    }
});

app.post('/api/BeatmapPP/:id', express.json(), async (req, res) => {
    const { id } = req.params;
    const { beatmap } = req.body;
    try {
        console.log("ID:", id);
        console.log("Beatmap:", beatmap);
        const map = new rosu.Beatmap(beatmap);
        const maxAttrs = new rosu.Performance({ mods: "CL" }).calculate(map);
        res.json(maxAttrs);
    } catch (error) {
        console.error("Ошибка получения данных:", error);
        res.status(500).json({ error: "Ошибка получения данных" });
    }
});

app.listen(port, async () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
    try {
        await osuApiHelper.init();
        console.log("OsuApiHelper инициализирован.");
    } catch (error) {
        console.error("Ошибка при инициализации OsuApiHelper:", error);
    }
});
