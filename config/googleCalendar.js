import { google } from 'googleapis';
import { readFileSync } from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const auth = new google.auth.GoogleAuth({
  keyFile: 'internal-private-files/scholario-459602-2996118ff3d3.json', // downloaded key
  scopes: SCOPES,
});

const calendar = google.calendar({ version: 'v3', auth });

export default calendar;
