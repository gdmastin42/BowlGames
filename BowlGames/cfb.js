/* 
Garrett Mastin
Last Edited: 12/8/2024
College Football Bowl Game Prediction Program
*/

/*------------------- .env File Dependencies -----------------*/

require('dotenv').config()

const API_KEY = process.env.API_KEY_CFB
const SHEET_ID_SCORES = process.env.SHEET_ID_SCORES
const SHEET_ID_POLL = process.env.SHEET_ID_POLL
const TITLE_WINNER = "Set Equal to Winner"

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
            range: "A:AN",
        })
        
        const answers_json = []
        const rows = res.data.values

        if (rows.length) {
            rows.shift()

            for (const row of rows) {
                const user_info = {
                    time_stamp: row[0],
                    first_name: row[1],
                    last_name: row[2],
                    title_winner: row[3]
                }

                // adds the bowl games dynamically from the google form 
                const game_details = {}
                    for (let i = 4; i < row.length; i++) {
                        game_details['bowl_game_' + (i-3)] = row[i];
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

        const bowl_games = []

        // Loops through each user
        for (let current_user = 0; current_user < answers.length; current_user++) {
            
            // makes sure to reset the points at the begining of each player loop to ensure everyone has their own score
            let total_points_to_player = 0

            // TITLE_WINNER is worth 5 points and is updated at the top of the file where the .env file depencicies are
            if (answers[current_user].user_info.title_winner == TITLE_WINNER) {
                total_points_to_player += 5
            }

            // Loops through each bowl game
            for (let current_user_choice = 0; current_user_choice < bowl_games.length; current_user_choice++) {

                //finds current user's prediction for the current bowl game
                let user_prediction = answers[current_user].game_details[bowl_games[current_user_choice]]
                let correct_prediction = false

                // Loops through each game result
                for (let current_game = 0; current_game < result.length; current_game++) {

                    // finds who won the game and make its equal to "winner" by comparing away and home points 
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
                } // ends for loop that finds the winner

                // gives points to the user if they predicted the winner of the game
                if (correct_prediction) {
                    total_points_to_player++
                }

            } // ends for loop for each bowl game

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
        }// ends for loop for each player

        await update_sheet()

    })// ends answers.json read function
})// ends results.json read function

/*--------------------- Update Sheet ------------------------*/

// function that updates the google sheet 
async function update_sheet() {
    try {
        await service.spreadsheets.values.update({
            auth: auth_client,
            // specify the spreadsheet and range to update the data
            spreadsheetId: SHEET_ID_SCORES,
            range: 'A2:C',//A2 makes sure it doesnt overwrite the header of the sheet
            valueInputOption: 'RAW',

            requestBody: {
                values: info_for_update,
            },
        })

    } catch (error) {
        console.error('Error updating sheet:', error.message)
    }
}