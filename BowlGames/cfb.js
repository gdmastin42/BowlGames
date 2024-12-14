/**
 * Garrett Mastin
 * Last Edited: 12/10/2024
 * College Football Bowl Game Prediction Program
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

const { google } = require('googleapis')
const service = google.sheets('v4')
const credentials = require('./credentials.json')
  
const auth_client = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
)
/*----------------------- SQL Commands -----------------------*/

const sqlite3 = require('sqlite3').verbose()
let db_exists = fs.existsSync('tblScore.db')
let db = new sqlite3.Database('tblScore.db')

if (!db_exists) {
    const create_table = `
        CREATE TABLE tblScore (
            time_stamp TEXT PRIMARY KEY UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            score INTEGER NOT NULL
        )`

    db.run(create_table)
}

/**
 * This function uses the Google Sheets API to retrieve all responses from
 * a Google Sheets document containing the poll answers. It then processes the
 * data and writes it to a local JSON file ('answers.json') for further
 * processing.
 *
 * @returns {Promise<void>} resolves once the responses are successfully written to answers.json
 */
async function fetch_answers() {
    try {

        const token = await auth_client.authorize()
        auth_client.setCredentials(token)

        const res = await service.spreadsheets.values.get({
            auth: auth_client,
            spreadsheetId: SHEET_ID_POLL,
            range: 'A:AN'
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

                const game_details = {}
                for (let i = 4; i < row.length; i++) {
                    game_details['bowl_game_' + (i - 3)] = row[i]
                }

                answers_json.push({
                    user_info,
                    game_details
                })
            }
        }

        fs.writeFileSync('answers.json', JSON.stringify(answers_json, null, 2), (err) => {
            if (err) {
                console.error('Error writing answers.json:', err)
            }
        })

    } catch (error) {
        console.error('Error With reading poll results:', error.message)
    }
}

fetch_answers()

/**
 * This function interacts with the CollegeFootball API to retrieve the results
 * of all postseason games for the specified year. The relevant results are then
 * filtered and written to a local JSON file ('results.json') for further use.
 *
 * @returns {Promise<void>} resolves when the results are successfully written to the 'results.json' file.
 */
async function fetch_games() {
    try {
        const default_client = cfb.ApiClient.instance

        const api_key_auth = default_client.authentications['ApiKeyAuth']
        api_key_auth.apiKey = API_KEY

        const api_instance = new cfb.GamesApi()

        const year = 2024

        const opts = {
            seasonType: 'postseason'
        }

        const games_with_opts = await api_instance.getGames(year, opts)

        const filtered_bowl_games = games_with_opts.filter((game) =>
                game.notes && !game.notes.includes('College Football Playoff')
        )

        fs.writeFile('results.json', JSON.stringify(filtered_bowl_games, null, 2), (err) => {
            if (err) {
                console.error('Error writing results.json:', err)
            }
        })
        
    } catch (error) {
        console.error('Error calling CollegeFootballData API:', error.message)
    }
}

fetch_games()

/**
 * This function reads both the game results (results.json and user predictions,
 * (answers.json) compares them, and assigns points to each user based on how accurate
 * their predictions were. It then updates the local SQLite database and the Google
 * Sheets document with the calculated scores. 
 * 
 * @returns {Promise<void>} resolves when the prediction results are successfully calculated and stored.
 */
async function fetch_prediction_results() {
    try {
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
                
                let info_for_update = []
                const TITLE_WINNER = 'Set Equal to Winner'

                // Loops through each user
                for (let current_user = 0; current_user < answers.length; current_user++) {
                    let total_points_to_player = 0

                    if (answers[current_user].user_info.title_winner == TITLE_WINNER) {
                        total_points_to_player += 5
                    }

                    const game_details = answers[current_user].game_details
                    const game_keys = Object.keys(game_details)  

                    // Loops through each bowl game
                    for (let current_user_choice = 0; current_user_choice < game_keys.length; current_user_choice++) {
                        
                        const game_key = game_keys[current_user_choice]
                        const user_prediction = game_details[game_key]

                        let correct_prediction = false

                        // Loops through each game result
                        for (let current_game = 0; current_game < result.length; current_game++) {

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
            
                    db.run(
                        'INSERT OR IGNORE INTO tblScore (time_stamp, first_name, last_name, score) VALUES (?, ?, ?, ?)',
                        [
                            answers[current_user].user_info.time_stamp,
                            answers[current_user].user_info.first_name,
                            answers[current_user].user_info.last_name,
                            total_points_to_player
                        ]
                    )
                }

                await update_sheet(info_for_update) // updates the scores spreadsheet
            })
        })

    } catch (error) {
        console.error('Error calulating results:', error.message)
    }
}

fetch_prediction_results()

/**
 * This function updates the Google Sheets document with the
 * score results of all users.
 *
 * @param {Array<Array<string|number>>} info_for_update - An array of arrays where each sub-array
 *  contains the first name (string), last name (string), and score (number) of a user.
 * 
 * @returns {Promise<void>} resolves when the sheet has been updated successfully.
 */
async function update_sheet(info_for_update) {
    try {

        await service.spreadsheets.values.update({
            auth: auth_client,
            spreadsheetId: SHEET_ID_SCORES,
            range: 'A2:C', 
            valueInputOption: 'RAW',

            requestBody: {
                values: info_for_update
            }
        })

    } catch (error) {
        console.error('Error With updating score spreadsheet:', error.message)
    }
}