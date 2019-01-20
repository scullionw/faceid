'use strict';

const fs = require('fs');
const util = require('util');
const request = require('request-promise');
const cheerio = require('cheerio');
const parseArgs = require('minimist');
const API_URL = require('./config.js').API_URL;

const readdir = util.promisify(fs.readdir);

main();

function main() {
    const argv = parseArgs(process.argv.slice(2));
    let faces_path = argv['_'][0];
    if (faces_path != undefined) {
        identify(faces_path).then(console.log);
    } else {
        console.error("No path provided.");
    }
}

async function similar_faces(full_path) {
    const form_data = { imageUploadForm: fs.createReadStream(full_path) };
    const options = { url: API_URL, formData: form_data };
    const response = await request.post(options);
    const $ = cheerio.load(response);
    const results = new Map();
    $(".realCandidate").each((i, elem) => {
        let sim = +$(elem).find(".progress-bar").attr("similarity");
        let name = $(elem).find(".candidate-main p").first().text();
        results.set(name, sim);
    });
    return results;
}

function limiter(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function counter(maps) {
    const counter = new Map();
    for (let map of maps) {
        for (let name of map.keys()) {
            let score = map.get(name);
            if (counter.has(name)) {
                let sum = counter.get(name);
                counter.set(name, sum + score);
            } else {
                counter.set(name, score)
            }
        }
    }
    return counter;
}

async function identifyDelay(base_path, delay) {   
    const file_names = fs.readdirSync(base_path);
    let maps = [];
    for (let file_name of file_names) {
        const full_path = base_path + file_name;
        console.log(full_path);
        const map = await similar_faces(full_path);
        maps.push(map);
        await limiter(delay);
    }
    const counts = counter(maps);
    return Array.from(counts).sort((a, b) => b[1] - a[1]);
}

async function identify(base_path) {   
    const file_names = await readdir(base_path);
    const maps = await Promise.all(file_names.map(f => similar_faces(base_path + f)))
    const counts = counter(maps);
    return Array.from(counts).sort((a, b) => b[1] - a[1]);
}
