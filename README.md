# Bowl Predictor

Bowl Predictor is a program that uses Google Sheets API, CollegeFootballData.com's API, Node.js and SQLite.
It collects college football bowl game predictions from a google form and finds out who got the most predictions correct.

## Prerequisites

 - Google Account
 - Google Cloud Platform
 - Node.js
 - SQLite

## Setup Google API

1. Create a google account.
2. Create google cloud platform project.
3. Enable google sheets API.
4. Generate API Key.
5. Create a google service account.
6. Create google form.
7. Share the connected google sheet with your service account.

## Setup CollegeFootballData.com API

1. Go to https://collegefootballdata.com
2. Click the API Keys button.
3. Enter your email and check your email for your api key.

## Setup Google Form

- Create a google form with the following format
  - Question 1: What is your first name? (Short Answer)
  - Question 2: What is your last name? (Short Answer) 
  - Question 3: Who wins this game? (Multiple Choice)
  - Question 4 and beyond repeat the Question 3 format

## Setup Coding environment

1. Run the following install commands in your code IDE.
```
npm install dotenv
```
```
npm install googleapis
```
```
npm install sqlite3
```
2. Add the credientials.json you got from google into your program folder.
3. Create a .env file and fill it in with the following Information.
```
API_KEY_CFB="Bearer YOUR_CollegeFootballData_API_KEY"
API_KEY="YOUR_GOOGLE_CLOUD_PLATFORM_API_KEY"
CLIENT_ID="YOUR_CLIENT_ID"
SHEET_ID_SCORES="YOUR_SPREADSHEET_ID_FOR_RESULTS_OF_PREDICTIONS"
SHEET_ID_POLL="YOUR_SPREADSHEET_ID_FOR_POLL_RESULTS"
```

## Usage

1. To run the program make sure you all the following steps completed properly.
2. Run the command in the terminal.
```
node cfb.js
```
- Once the program is finished executing it will output the data into the following files.
  - answers.json
  - results.json
  - tblScore.db
- answers.json
  - Results of the google from poll.
- results.json
  - Results of the CollegeFootballData.com API search results.
- tblScore.db
  - The database that holds the results  for each user and their score
## Notes 
- Some arrays are hard coded sizes and not dynamic (I plan to fix this in the future)

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

## Contact information

If you have Problems Running the Program or with the setup contact me at mastingarrett20@gmail.com
