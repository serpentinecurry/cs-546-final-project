import { google } from 'googleapis';
import fetch from 'node-fetch'; // make sure to install this
import dotenv from 'dotenv';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const KEY_URL = 'https://gist.githubusercontent.com/anikdoshi2003/9f3368554f8797e30a149e2838d0c7db/raw/scholario-459602-2996118ff3d3.json'; // use raw URL

async function getCalendarInstance() {
  const response = await fetch(KEY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch key file: ${response.statusText}`);
  }

  const credentials = await response.json();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  const calendar = google.calendar({ version: 'v3', auth });

  return calendar;
}

export default await getCalendarInstance();
