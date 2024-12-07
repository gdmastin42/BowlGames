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
let db_exists = fs.existsSync('tblScore.db')

/*----------------------- SQL Commands -----------------------*/

if (!db_exists) {
    fs.openSync('tblScore.db', 'w')
}

let db = new sqlite3.Database('tblScore.db')

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

// function finds the answers google form poll and writes the answers to a json file
;(async function () {
    try {
        const token = await auth_client.authorize()
        auth_client.setCredentials(token)

        // specify the spreadsheet and range to get the data from
        const res = await service.spreadsheets.values.get({
            auth: auth_client,
            spreadsheetId: SHEET_ID_POLL,
            range: "A:AM",
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

                // fix the hard coded bowl games when done with finals
                const game_details = {
                    bowl_game_1: row[3],
                    bowl_game_2: row[4],
                    bowl_game_3: row[5],
                    bowl_game_4: row[6],
                    bowl_game_5: row[7],
                    bowl_game_6: row[8],
                    bowl_game_7: row[9],
                    bowl_game_8: row[10],
                    bowl_game_9: row[11],
                    bowl_game_10: row[12],
                    bowl_game_11: row[13],
                    bowl_game_12: row[14],
                    bowl_game_13: row[15],
                    bowl_game_14: row[16],
                    bowl_game_15: row[17],
                    bowl_game_16: row[18],
                    bowl_game_17: row[19],
                    bowl_game_18: row[20],
                    bowl_game_19: row[21],
                    bowl_game_20: row[22],
                    bowl_game_21: row[23],
                    bowl_game_22: row[24],
                    bowl_game_23: row[25],
                    bowl_game_24: row[26],
                    bowl_game_25: row[27],
                    bowl_game_26: row[28],
                    bowl_game_27: row[29],
                    bowl_game_28: row[30],
                    bowl_game_29: row[31],
                    bowl_game_30: row[32],
                    bowl_game_31: row[33],
                    bowl_game_32: row[34],
                    bowl_game_33: row[35],
                    bowl_game_34: row[36],
                    bowl_game_35: row[37],
                    bowl_game_36: row[38]
                }

                answers_json.push({
                    user_info,
                    game_details
                })
            }
        } 

        fs.writeFileSync("answers.json", JSON.stringify(answers_json, null, 2))

    } catch (error) {
        console.error('Error with Poll:', error.message);
    }
})()

/*---------------- College Football API ----------------------*/

const default_client = cfb.ApiClient.instance

const api_key_auth = default_client.authentications['ApiKeyAuth']
api_key_auth.apiKey = API_KEY

const api_instance = new cfb.GamesApi()
const year = 2024

// gets the results of the games for the CollegeFootball API and writes it to results.json
async function fetch_games() {
    try {
        // search filter for the games 
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
        console.error('Error calling API:', error.message);
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

        // fix the hard coded bowl games when done with finals
        const bowl_games = [
            'bowl_game_1', 'bowl_game_2', 'bowl_game_3', 'bowl_game_4', 'bowl_game_5',
            'bowl_game_6', 'bowl_game_7', 'bowl_game_8', 'bowl_game_9', 'bowl_game_10',
            'bowl_gmae_11', 'bowl_game_12', 'bowl_game_13', 'bowl_game_14', 'bowl_game_15',
            'bowl_game_16', 'bowl_game_17', 'bowl_game_18', 'bowl_game_19', 'bowl_game_20',
            'bowl_game_21', 'bowl_game_22', 'bowl_game_23', 'bowl_game_24', 'bowl_game_25',
            'bowl_game_26', 'bowl_game_27', 'bowl_game_28', 'bowl_game_29', 'bowl_game_30',
            'bowl_game_31', 'bowl_game_32', 'bowl_game_33', 'bowl_game_34', 'bowl_game_35'
        ]

        // Loop through each user
        for (let current_user = 0; current_user < answers.length; current_user++) {

            let total_points_to_player = 0

            // Loop through each bowl game
            for (let current_user_choice = 0; current_user_choice < bowl_games.length; current_user_choice++) {

                //finds current user's prediction for the current bowl game
                let user_prediction = answers[current_user].game_details[bowl_games[current_user_choice]]
                let correct_prediction = false

                // Loop through each game result
                for (let current_game = 0; current_game < result.length; current_game++) {
                    let winner

                    // finds who won the game and make its equal to "winner"
                    if (result[current_game].homePoints > result[current_game].awayPoints) {
                        winner = result[current_game].homeTeam
                    } else if (result[current_game].homePoints < result[current_game].awayPoints) {
                        winner = result[current_game].awayTeam
                    }

                    // checks if the winner of the game is equal to the user's prediction
                    if (winner === user_prediction) {
                        correct_prediction = true
                        break
                    }
                }

                // gives points to the user if they predicted the winner of the game
                if (correct_prediction) {
                    console.log(total_points_to_player)
                    total_points_to_player++
                }
            }

            // pushes the user's first name, last name, and total points to the info_for_update array
            info_for_update.push([
                answers[current_user].user_info.first_name,
                answers[current_user].user_info.last_name,
                total_points_to_player
            ])

            // inserts data to tblScore
            db.run('INSERT OR IGNORE INTO tblScore (time_stamp, first_name, last_name, score) VALUES (?, ?, ?, ?)', [
                answers[current_user].user_info.time_stamp,
                answers[current_user].user_info.first_name,
                answers[current_user].user_info.last_name,
                total_points_to_player
            ])
        }

        await update_sheet()
    })
})

/*--------------------- Update Sheet ------------------------*/

// function that updates the google sheet 
async function update_sheet() {
    try {
        await service.spreadsheets.values.update({
            auth: auth_client,
            // specify the spreadsheet and range to update the data
            spreadsheetId: SHEET_ID_SCORES,
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