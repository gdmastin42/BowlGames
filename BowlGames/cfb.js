/* 
Garrett Mastin
Last Edited: 11/30/2024
College Football Bowl Game Prediction Program
*/

/*------------------- .env File Dependencies -----------------*/

require('dotenv').config()

const API_KEY = process.env.API_KEY_CFB
const SHEET_ID_SCORES = process.env.SHEET_ID_SCORES
const SHEET_ID_POLL = process.env.SHEET_ID_POLL

/*-------------------- CFBD Dependencies ---------------------*/

const cfb = require('cfb.js')
const fs = require('fs')

/*---------------- Google Sheets API Dependencies ------------*/

const { google } = require("googleapis")
const service = google.sheets("v4")
const credentials = require("./credentials.json")

/*-------------------- SQLite Dependencies -------------------*/

const sqlite3 = require('sqlite3').verbose()
var db_exists = fs.existsSync('tblScore.db')

/*----------------------- SQL Commands -----------------------*/

if (!db_exists) {
    fs.openSync('tblScore.db', 'w')
}

var db = new sqlite3.Database('tblScore.db')

const create_table = `
    CREATE TABLE tblScore (
        time_stamp TEXT PRIMARY KEY UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        score INTEGER NOT NULL
    )`

if (!db_exists) {
    db.run(create_table)
}

/*------------------- Google Sheets API ----------------------*/

const auth_client = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
)

;(async function () {
    try {
        const token = await auth_client.authorize()
        auth_client.setCredentials(token)

        const res = await service.spreadsheets.values.get({
            auth: auth_client,
            spreadsheetId: SHEET_ID_POLL,
            range: "A:M",
        })

        const answers_json = []
        const rows = res.data.values

        if (rows.length) {
            rows.shift()

            for (const row of rows) {
                const user_info = {
                    time_stamp: row[0],
                    first_name: row[1],
                    last_name: row[2]
                }

                const game_details = {}
                
                for(let i = 3; i < row.length; i++) {
                    const game = 'bowl_game_' + (i - 2)
                    game_details[game] = row[i]
                }

                answers_json.push({
                    user_info,
                    game_details
                })
            }
        } 

        fs.writeFileSync("answers.json", JSON.stringify(answers_json, null, 2))
    } catch (error) {
        console.log(error)
        process.exit(1)
    }
})()

/*---------------- College Football API ----------------------*/

const default_client = cfb.ApiClient.instance

const api_key_auth = default_client.authentications['ApiKeyAuth']
api_key_auth.apiKey = API_KEY

const api_instance = new cfb.GamesApi()
const year = 2024

async function fetch_games() {
    try {
        const games = await api_instance.getGames(year)

        const opts = {
            week: 13,
            seasonType: "regular",
            conference: "SEC",
        }

        const games_with_opts = await api_instance.getGames(year, opts);

        fs.writeFile('results.json', JSON.stringify(games_with_opts, null, 2), (err) => {
            if (err) {
                console.error('Error writing results.json:', err);
            }
        })
    } catch (error) {
        console.error('Error calling API:', error);
    }
}

fetch_games()

/*--------------------- Reading JSONs ------------------------*/

const info_for_update = []

fs.readFile('results.json', 'utf-8', (err, results_data) => {
    if (err) {
        console.error('Error reading results.json:', err)
        return
    }

    const result = JSON.parse(results_data)

    fs.readFile('answers.json', 'utf-8', async (err, answers_data) => {
        if (err) {
            console.error('Error reading answers.json:', err)
            return
        }

        const answers = JSON.parse(answers_data)

        const bowl_games = [
            'bowl_game_1', 'bowl_game_2', 'bowl_game_3', 'bowl_game_4', 'bowl_game_5',
            'bowl_game_6', 'bowl_game_7', 'bowl_game_8', 'bowl_game_9', 'bowl_game_10'
        ]

        // Loop through each user
        for (let current_user = 0; current_user < answers.length; current_user++) {

            let time_stamp = answers[current_user].user_info.time_stamp
            let total_points_to_player = 0

            // Loop through each bowl game
            for (let current_user_choice = 0; current_user_choice < bowl_games.length; current_user_choice++) {

                const user_prediction = answers[current_user].game_details[bowl_games[current_user_choice]]

                let correct_prediction = false

                // Loop through each game result
                for (let current_game = 0; current_game < result.length; current_game++) {
                    let winner
                    if (result[current_game].homePoints > result[current_game].awayPoints) {
                        winner = result[current_game].homeTeam
                    } else if (result[current_game].homePoints < result[current_game].awayPoints) {
                        winner = result[current_game].awayTeam
                    }

                    if (winner === user_prediction) {
                        correct_prediction = true
                        break
                    }
                }

                if (correct_prediction) {
                    total_points_to_player++
                }
            }

            info_for_update.push([
                answers[current_user].user_info.first_name,
                answers[current_user].user_info.last_name,
                total_points_to_player
            ])

            db.run('INSERT OR IGNORE INTO tblScore (time_stamp, first_name, last_name, score) VALUES (?, ?, ?, ?)', [
                time_stamp,
                answers[current_user].user_info.first_name,
                answers[current_user].user_info.last_name,
                total_points_to_player
            ])
        }

        await update_sheet()
    })
})

/*--------------------- Update Sheet ------------------------*/

async function update_sheet() {
    try {
        const response = await service.spreadsheets.values.update({
            auth: auth_client,
            spreadsheetId: SHEET_ID_SCORES
            ,
            range: 'A:C',
            valueInputOption: 'RAW',

            requestBody: {
                values: info_for_update,
            },
        })

    } catch (error) {
        console.error('Error updating sheet:', error.message)
    }
}